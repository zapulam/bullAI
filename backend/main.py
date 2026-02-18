"""
bullAI Internal Chat - FastAPI application.

Written by: zapulam
"""

import ast
import os
import json
import uuid
import traceback
import uvicorn

from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from openai import AsyncOpenAI
from typing import Any, Dict, List, AsyncGenerator, Optional

from service import ChatService
from models import (
    TurnRequest,
    MemoryGetResponse,
    MemoryPutRequest,
    OpenAIKeyRequest,
    OpenAIKeyResponse,
    AlphaVantageKeyRequest,
    AlphaVantageKeyResponse,
    ChartSaveRequest,
)
from memory import (
    get_conversations,
    get_conversation_messages,
    delete_conversation,
    initialize_sqlite_db,
)
from repositories import ChartRepository, SettingsRepository
from settings import settings
from tools import execute_chart_call
from streaming import (
    ChatChunkEvent,
    ChatToolInput,
    ChatToolOutput,
    ChatComplete,
    ChatError,
    StructuredOutputStreamParser,
)

class AppRuntime:
    """Runtime for admin chat service."""
    def __init__(
            self,
            chat_service: Optional[ChatService],
            openai_api_key: Optional[str],
            alpha_vantage_api_key: Optional[str],
        ):
        self.chat_service = chat_service
        self.openai_api_key = openai_api_key
        self.alpha_vantage_api_key = alpha_vantage_api_key

    async def close(self):
        """Clean up resources."""
        pass


def get_cors_origins() -> List[str]:
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def get_runtime(request: Request):
    """Dependency to get runtime from app state."""
    rt = getattr(request.app.state, "runtime", None)
    if rt is None:
        raise HTTPException(503, "Runtime not initialized")
    return rt


def _mask_api_key(api_key: str) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:4]}...{api_key[-4:]}"


def _build_runtime(
        openai_api_key: str,
        alpha_vantage_api_key: Optional[str]
    ) -> AppRuntime:
    chat_service = ChatService(
        openai_client = AsyncOpenAI(api_key=openai_api_key),
        alpha_vantage_key=alpha_vantage_api_key
    )
    return AppRuntime(
        chat_service=chat_service,
        openai_api_key=openai_api_key,
        alpha_vantage_api_key=alpha_vantage_api_key,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Initialize SQLite database
    db_path = settings.db_path
    if db_path:
        initialize_sqlite_db(db_path)

    repo = SettingsRepository()
    openai_api_key = repo.get_openai_api_key()
    alpha_vantage_api_key = repo.get_alpha_vantage_api_key()
    if openai_api_key:
        app.state.runtime = _build_runtime(openai_api_key, alpha_vantage_api_key)
    else:
        app.state.runtime = AppRuntime(
            chat_service=None,
            openai_api_key=None,
            alpha_vantage_api_key=alpha_vantage_api_key,
        )

    try:
        yield
    finally:
        await app.state.runtime.close()


# Create FastAPI app
app = FastAPI(title="bullAI Service", lifespan=lifespan)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/chat/generate")
async def create_chat(
        req: TurnRequest,
        rt: AppRuntime = Depends(get_runtime),
    ) -> StreamingResponse:
    """
    Calls the agentic chat module to answer user questions with streaming response.

    Args:
        req (TurnRequest): The TurnRequest API payload containing conversation_id, and user_input.
        rt (AppRuntime): The AppRuntime object containing the chat module.

    Returns:
        StreamingResponse: Server-Sent Events stream of the response.
    """
    async def generate_stream() -> AsyncGenerator[str, None]:
        """Generate SSE stream from the chat service."""
        conversation_id = req.conversation_id or str(uuid.uuid4())
        parser = StructuredOutputStreamParser()
        last_tool_name = None

        try:
            async for chunk in rt.chat_service.run_turn(
                conversation_id=conversation_id,
                user_input=req.user_input
            ):
                if chunk.get("type") == "tool_call":
                    last_tool_name = chunk.get("content")
                    parser.reset()
                    event = ChatToolInput(
                        type="tool_call",
                        tool_name=chunk.get("name", chunk.get("content", "")),
                        content=chunk.get("arguments", {}),
                    )
                    yield f"data: {event.model_dump_json()}\n\n"

                if chunk.get("type") == "chunk":
                    delta = chunk.get("content", "")
                    for evt in parser.feed(delta):
                        event = ChatChunkEvent(type=evt.field, content=evt.text)
                        yield f"data: {event.model_dump_json()}\n\n"

                elif chunk.get("type") == "tool_output":
                    tool_output_content = chunk.get("content", "")
                    content = tool_output_content
                    tool_name = last_tool_name or ""
                    if isinstance(tool_output_content, dict):
                        tool_name = tool_output_content.get("name", last_tool_name) or tool_name
                        content = tool_output_content.get("content", tool_output_content)

                    event = ChatToolOutput(
                        type="tool_output",
                        tool_name=tool_name,
                        content=content,
                    )
                    yield f"data: {event.model_dump_json()}\n\n"

                elif chunk.get("type") == "complete":
                    content_str = chunk.get("content", "")
                    thought = parser.thought
                    response = parser.response
                    status = None

                    try:
                        content_json = json.loads(content_str)
                        if isinstance(content_json, dict):
                            thought = content_json.get("thought", thought) or thought
                            response = content_json.get("response", response) or response
                            status = content_json.get("status", status) or status
                    except json.JSONDecodeError:
                        pass

                    event = ChatComplete(
                        type="complete",
                        conversation_id=conversation_id,
                        thought=thought,
                        response=response,
                        status=status,
                    )
                    yield f"data: {event.model_dump_json()}\n\n"

            done_event = {"type": "done"}
            yield f"data: {json.dumps(done_event)}\n\n"

        except Exception as e:
            detail = f"{type(e).__name__}: {e}".strip()
            if not detail or detail.endswith(":"):
                detail = "Unexpected error during chat generation."
            traceback.print_exc()
            event = ChatError(type="error", content=detail)
            yield f"data: {event.model_dump_json()}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@app.get("/chat/sessions")
async def get_sessions(
        rt: AppRuntime = Depends(get_runtime),
    ) -> Dict[str, Any]:
    """
    Get all chat sessions for a specific user.

    Args:
        rt: AppRuntime dependency.

    Returns:
        Dictionary containing list of sessions.
    """
    sessions = await get_conversations()
    return {"sessions": sessions}


@app.delete("/chat/sessions/{conversation_id}")
async def delete_session(
        conversation_id: str,
        rt: AppRuntime = Depends(get_runtime),
    ) -> Response:
    """
    Delete a chat session and all its messages.

    Args:
        conversation_id: Session identifier to delete.
        rt: AppRuntime dependency.

    Returns:
        204 No Content on success.
    """
    await delete_conversation(conversation_id)
    return Response(status_code=204)


@app.post("/charts")
async def save_chart(
    req: ChartSaveRequest,
) -> Dict[str, Any]:
    """
    Save a chart to the database.

    Args:
        req: Chart save request with title, visualization_data, call_data.

    Returns:
        Saved chart with id.
    """
    repo = ChartRepository()
    chart = repo.save_chart(
        title=req.title,
        visualization_data=req.visualization_data,
        call_data=req.call_data,
    )
    return chart


@app.get("/charts")
async def list_charts() -> Dict[str, Any]:
    """
    List all saved charts.

    Returns:
        List of saved charts.
    """
    repo = ChartRepository()
    charts = repo.list_charts()
    return {"charts": charts}


@app.post("/charts/{chart_id}/refresh")
async def refresh_chart(chart_id: str) -> Dict[str, Any]:
    """
    Refresh a chart by re-executing its call_data and updating visualization.

    Args:
        chart_id: Chart identifier.

    Returns:
        Updated chart with fresh visualization_data.
    """
    chart_repo = ChartRepository()
    settings_repo = SettingsRepository()
    chart = chart_repo.get_chart(chart_id)
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    call_data = chart.get("call_data") or {}
    if not call_data or not call_data.get("func"):
        raise HTTPException(status_code=400, detail="Chart has no valid call_data")
    alpha_vantage_key = settings_repo.get_alpha_vantage_api_key()
    if not alpha_vantage_key:
        raise HTTPException(
            status_code=400,
            detail="Alpha Vantage API key not configured. Add it in Settings.",
        )
    try:
        result = await execute_chart_call(call_data, alpha_vantage_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Failed to fetch chart data: {e}")
    viz = result.get("visualization")
    if not viz:
        raise HTTPException(status_code=502, detail="No visualization data returned")
    visualization_data = {
        "chartData": viz.get("chartData", []),
        "chartType": viz.get("chartType", "simple"),
        "screens": viz.get("screens", []),
        "meta": viz.get("meta", {}),
    }
    updated = chart_repo.update_chart(chart_id, visualization_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Chart not found")
    return updated


@app.delete("/charts/{chart_id}")
async def delete_chart(chart_id: str) -> Response:
    """
    Delete a saved chart.

    Args:
        chart_id: Chart identifier.

    Returns:
        204 No Content on success, 404 if not found.
    """
    repo = ChartRepository()
    deleted = repo.delete_chart(chart_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chart not found")
    return Response(status_code=204)


@app.get("/chat/history")
async def get_chat_history(
        conversation_id: str,
        rt: AppRuntime = Depends(get_runtime),
    ) -> Dict[str, Any]:
    """
    Get chat history for a specific session.

    Args:
        conversation_id: Session identifier.
        rt: AppRuntime dependency.

    Returns:
        Dictionary containing list of messages.
    """
    try:
        items = await get_conversation_messages(conversation_id)
    except Exception as e:
        # Return empty messages instead of failing
        return {"messages": []}
    
    # Convert items to message format. Process in sequence; tool outputs
    # with visualization are attached to the next assistant message.
    messages = []
    pending_visualization = None
    for item in items:
        created_at = None
        if isinstance(item, dict) and "data" in item:
            raw = item.get("data") or {}
            created_at = item.get("created_at")
        else:
            raw = item

        if isinstance(raw, dict):
            role = raw.get("role", "user")
            content = raw.get("content", "")
        else:
            role = getattr(raw, "role", "user")
            content = getattr(raw, "content", "")
            created_at = created_at or getattr(raw, "created_at", None)

        # Tool output items: extract visualization for next assistant message.
        # Agents SDK stores with type="function_call_output" and output (string).
        if raw.get("type") == "function_call_output":
            output_raw = raw.get("output", raw.get("content", ""))
            parsed = None
            if isinstance(output_raw, dict) and "visualization" in output_raw:
                parsed = output_raw
            elif isinstance(output_raw, str) and output_raw.strip():
                try:
                    parsed = json.loads(output_raw)
                except json.JSONDecodeError:
                    try:
                        parsed = ast.literal_eval(output_raw)
                    except (ValueError, SyntaxError):
                        parsed = None
            if isinstance(parsed, dict) and "visualization" in parsed:
                pending_visualization = parsed.get("visualization")
            continue
        if role == "tool":
            if isinstance(content, dict) and "visualization" in content:
                pending_visualization = content.get("visualization")
            continue
        if raw.get("type") in ("reasoning", "function_call"):
            continue

        thought = None
        status = None

        # Handle assistant messages where content might be a structured Output,
        # or legacy text/list/dict structures.
        if role == "assistant":
            # First, try to interpret content as structured Output with thought/response/status
            structured = None

            if isinstance(content, dict) and (
                "thought" in content or "response" in content or "status" in content
            ):
                structured = content
            elif isinstance(content, str):
                # Try to parse JSON string into structured dict
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and (
                        "thought" in parsed or "response" in parsed or "status" in parsed
                    ):
                        structured = parsed
                except Exception:
                    structured = None

            if structured is not None:
                # Extract structured fields
                thought_val = structured.get("thought")
                response_val = structured.get("response")
                status_val = structured.get("status")

                thought = (
                    thought_val
                    if isinstance(thought_val, str)
                    else (json.dumps(thought_val) if thought_val is not None else None)
                )
                # Response/content shown to user
                if isinstance(response_val, str):
                    content = response_val
                elif response_val is not None:
                    content = json.dumps(response_val)
                else:
                    # Fallback to empty string if response is missing
                    content = ""

                if isinstance(status_val, str):
                    status = status_val
                elif status_val is not None:
                    status = str(status_val)
            else:
                # Legacy handling: content as list/dict with 'text' field or other types
                if isinstance(content, list) and len(content) > 0:
                    # Handle list of dicts like [{"text": "...", ...}]
                    first_item = content[0]
                    if isinstance(first_item, dict):
                        content = first_item.get("text", "")
                    else:
                        content = str(first_item)
                elif isinstance(content, dict):
                    # Extract text from dict structure like {'text': '...', 'annotations': ..., 'type': ..., 'logprobs': ...}
                    content = content.get("text", "")
                elif not isinstance(content, str):
                    # Fallback: convert to string if it's not already a string
                    content = str(content)
        elif not isinstance(content, str):
            # For non-assistant messages, convert to string if needed
            content = str(content)
        
        message_data: Dict[str, Any] = {
            "role": role,
            "content": content,
        }

        # Prefer the stored created_at as the canonical timestamp for history
        if created_at is not None:
            message_data["created_at"] = created_at
            # Also expose it as a generic timestamp field for frontend convenience
            message_data["timestamp"] = created_at

        # Only attach thought/status for assistant messages when present so
        # the frontend can render them like live streamed chats.
        if role == "assistant":
            if thought is not None and str(thought).strip():
                message_data["thought"] = thought
            if status is not None:
                message_data["status"] = status
            if pending_visualization is not None:
                message_data["visualization"] = pending_visualization
                pending_visualization = None

        messages.append(message_data)
    
    return {"messages": messages}


@app.get("/settings/openai-api-key", response_model=OpenAIKeyResponse)
async def get_openai_api_key_status() -> OpenAIKeyResponse:
    repo = SettingsRepository()
    api_key = repo.get_openai_api_key()
    return OpenAIKeyResponse(
        has_key=bool(api_key),
        masked_key=_mask_api_key(api_key) if api_key else None,
    )


@app.put("/settings/openai-api-key", response_model=OpenAIKeyResponse)
async def update_openai_api_key(
        req: OpenAIKeyRequest,
        request: Request,
    ) -> OpenAIKeyResponse:
    api_key = req.api_key.strip()
    repo = SettingsRepository()
    repo.set_openai_api_key(api_key)
    alpha_vantage_api_key = repo.get_alpha_vantage_api_key()
    request.app.state.runtime = _build_runtime(api_key, alpha_vantage_api_key)
    return OpenAIKeyResponse(
        has_key=True,
        masked_key=_mask_api_key(api_key),
    )


@app.delete("/settings/openai-api-key", response_model=OpenAIKeyResponse)
async def clear_openai_api_key(request: Request) -> OpenAIKeyResponse:
    repo = SettingsRepository()
    repo.clear_openai_api_key()
    os.environ.pop("OPENAI_API_KEY", None)
    alpha_vantage_api_key = repo.get_alpha_vantage_api_key()
    request.app.state.runtime = AppRuntime(
        chat_service=None,
        openai_api_key=None,
        alpha_vantage_api_key=alpha_vantage_api_key,
    )
    return OpenAIKeyResponse(
        has_key=False,
        masked_key=None,
    )


@app.get("/settings/alpha-vantage-api-key", response_model=AlphaVantageKeyResponse)
async def get_alpha_vantage_api_key_status() -> AlphaVantageKeyResponse:
    repo = SettingsRepository()
    api_key = repo.get_alpha_vantage_api_key()
    return AlphaVantageKeyResponse(
        has_key=bool(api_key),
        masked_key=_mask_api_key(api_key) if api_key else None,
    )


@app.put("/settings/alpha-vantage-api-key", response_model=AlphaVantageKeyResponse)
async def update_alpha_vantage_api_key(
        req: AlphaVantageKeyRequest,
        request: Request,
    ) -> AlphaVantageKeyResponse:
    api_key = req.api_key.strip()
    repo = SettingsRepository()
    repo.set_alpha_vantage_api_key(api_key)
    openai_api_key = repo.get_openai_api_key()
    if openai_api_key:
        request.app.state.runtime = _build_runtime(openai_api_key, api_key)
    else:
        request.app.state.runtime = AppRuntime(
            chat_service=None,
            openai_api_key=None,
            alpha_vantage_api_key=api_key,
        )
    return AlphaVantageKeyResponse(
        has_key=True,
        masked_key=_mask_api_key(api_key),
    )


@app.delete("/settings/alpha-vantage-api-key", response_model=AlphaVantageKeyResponse)
async def clear_alpha_vantage_api_key(request: Request) -> AlphaVantageKeyResponse:
    repo = SettingsRepository()
    repo.clear_alpha_vantage_api_key()
    openai_api_key = repo.get_openai_api_key()
    if openai_api_key:
        request.app.state.runtime = _build_runtime(openai_api_key, None)
    else:
        request.app.state.runtime = AppRuntime(
            chat_service=None,
            openai_api_key=None,
            alpha_vantage_api_key=None,
        )
    return AlphaVantageKeyResponse(
        has_key=False,
        masked_key=None,
    )


@app.get("/settings/memories", response_model=MemoryGetResponse)
async def get_memory() -> MemoryGetResponse:
    repo = SettingsRepository()
    content = repo.get_user_memory()
    return MemoryGetResponse(content=content or "")


@app.put("/settings/memories", response_model=MemoryGetResponse)
async def put_memory(req: MemoryPutRequest) -> MemoryGetResponse:
    repo = SettingsRepository()
    repo.set_user_memory(req.content)
    return MemoryGetResponse(content=req.content)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "admin_chat"}


if __name__ == "__main__":
    port = 5000
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)


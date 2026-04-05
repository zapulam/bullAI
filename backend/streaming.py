"""
Stream parsing functionality for OpenAI RunResult and structured output.

Written by zapulam
"""

import json

from agents.stream_events import RawResponsesStreamEvent, RunItemStreamEvent, AgentUpdatedStreamEvent
from openai.types.responses.response_text_delta_event import ResponseTextDeltaEvent
from pydantic import BaseModel
from typing import Any, List, Literal, Optional

from models import get_call_id


# --- SSE Event Models (for chat streaming) ---
class ChatChunkEvent(BaseModel):
    """
    SSE chunk event during streaming for thought, response, table, or options content.
    """
    type: Literal["thought", "response", "options"]
    content: Any


class ChatToolInput(BaseModel):
    """
    SSE tool input event when a tool is called from an agent.
    """
    type: Literal["tool_call"]
    tool_name: str
    content: Any


class ChatToolOutput(BaseModel):
    """
    SSE tool output event when a tool completes execution.
    """
    type: Literal["tool_output"]
    tool_name: str
    content: Any


class ChatComplete(BaseModel):
    """
    SSE complete event when streaming finishes.
    """
    type: Literal["complete"]
    conversation_id: str
    thought: str
    response: str
    options: Optional[List[dict[str, Any]]] = None
    status: str


class ChatError(BaseModel):
    """
    SSE error event when an error occurs during chat generation.
    """
    type: Literal["response"]
    content: str


async def stream_result_events(result):
    """
    Stream events from a RunResult and yield formatted chunks.
    
    Args:
        result: The RunResult from Runner.run_streamed
        
    Yields:
        dict: Formatted event chunks with type and content
    """
    call_id_to_tool_name: dict[str, str] = {}
    async for event in result.stream_events():
        # Check most common type first for performance
        if isinstance(event, RawResponsesStreamEvent):
            if isinstance(event.data, ResponseTextDeltaEvent):
                delta = event.data.delta
                yield {
                    "type": "chunk",
                    "content": delta
                }
        elif isinstance(event, RunItemStreamEvent):
            if event.item.type == "tool_call_item":
                raw = event.item.raw_item
                tool_name = getattr(raw, "name", None)
                tool_args = getattr(raw, "arguments", None)
                if isinstance(raw, dict):
                    tool_name = tool_name or raw.get("name", "web_search")
                    tool_args = tool_args if tool_args is not None else raw.get("arguments", {})
                call_id = get_call_id(raw)
                if call_id and tool_name:
                    call_id_to_tool_name[call_id] = tool_name
                yield {
                    "type": "tool_call",
                    "content": tool_name,
                    "arguments": tool_args
                }
            elif event.item.type == "tool_call_output_item":
                call_id = get_call_id(event.item.raw_item)
                tool_name = call_id_to_tool_name.get(call_id)
                yield {
                    "type": "tool_output",
                    "content": event.item.output,
                    "tool_name": tool_name
                }
        elif isinstance(event, AgentUpdatedStreamEvent):
            yield {
                "type": "agent_update",
                "content": event.new_agent.name
            }


class StructuredOutputStreamParser:
    """
    Streaming parser for assistant outputs shaped like:
        {"thought":"...","response":"...","options":[{...}],"status":"complete"}

    `thought` and `response` stream incrementally. The full `options` array (list of
    objects with type, prompt, choices) is emitted once when the closing `]` is seen,
    using string-aware bracket matching so `]` inside strings does not end the array.

    Emits ChatChunkEvent instances (thought/response string chunks; one options event
    with content as a list of dicts).

    This parser is robust to arbitrary streaming delta boundaries and supports
    JSON escape sequences inside string values (e.g. \\n, \\\", \\\\).
    """

    _ESCAPE_MAP: dict[str, str] = {
        '"': '"',
        "\\": "\\",
        "/": "/",
        "b": "\b",
        "f": "\f",
        "n": "\n",
        "r": "\r",
        "t": "\t",
    }

    def __init__(self, max_tail: int = 256) -> None:
        self._max_tail = max_tail
        self.reset()


    def reset(self) -> None:
        self._buf = ""
        self._state = "seek_thought_key"
        self._escaped = False
        self._current_field: Literal["thought", "response"] | None = None

        self.thought = ""
        self.response = ""
        self.thought_done = False
        self.response_done = False
        self.options: Optional[List[dict[str, Any]]] = None
        self.options_done = False


    def feed(self, delta: str) -> list[ChatChunkEvent]:
        if not delta or self._state == "done":
            return []

        self._buf += delta
        out: list[ChatChunkEvent] = []

        while True:
            if self._state == "seek_thought_key":
                if self._seek_key("thought") is None:
                    return out
                self._state = "seek_thought_value"

            elif self._state == "seek_thought_value":
                if self._seek_string_value_start() is None:
                    return out
                self._current_field = "thought"
                self._escaped = False
                self._state = "in_string"

            elif self._state == "seek_response_key":
                if self._seek_key("response") is None:
                    return out
                self._state = "seek_response_value"

            elif self._state == "seek_response_value":
                if self._seek_string_value_start() is None:
                    return out
                self._current_field = "response"
                self._escaped = False
                self._state = "in_string"

            elif self._state == "seek_options_key":
                result = self._seek_optional_key("options")
                if result is None:
                    return out
                if result is False:
                    self._state = "done"
                    return out
                self._state = "seek_options_value"

            elif self._state == "seek_options_value":
                kind = self._seek_options_value_start()
                if kind is None:
                    return out
                if kind == "null":
                    self.options = None
                    self.options_done = True
                    self._state = "done"
                    return out
                self._state = "accumulate_options_array"

            elif self._state == "accumulate_options_array":
                extracted = self._try_consume_complete_json_array()
                if extracted is None:
                    return out
                try:
                    parsed = json.loads(extracted)
                except json.JSONDecodeError:
                    parsed = []
                if not isinstance(parsed, list):
                    parsed = []
                normalized: List[dict[str, Any]] = []
                for item in parsed:
                    if isinstance(item, dict):
                        normalized.append(item)
                self.options = normalized
                self.options_done = True
                out.append(ChatChunkEvent(type="options", content=normalized))
                self._state = "done"
                return out

            elif self._state == "in_string":
                field = self._current_field
                if field is None:
                    self._state = "done"
                    return out

                chunk_text, done = self._consume_string_chars()
                if chunk_text:
                    if field == "thought":
                        self.thought += chunk_text
                    else:
                        self.response += chunk_text
                    out.append(ChatChunkEvent(type=field, content=chunk_text))

                if not done:
                    return out

                if field == "thought":
                    self.thought_done = True
                    self._state = "seek_response_key"
                else:
                    self.response_done = True
                    self._state = "seek_options_key"

            elif self._state == "done":
                return out


    def _seek_key(self, key: str) -> int | None:
        needle = f"\"{key}\""
        idx = self._buf.find(needle)
        if idx == -1:
            self._buf = self._buf[-self._max_tail :]
            return None
        self._buf = self._buf[idx + len(needle) :]
        return idx


    def _seek_optional_key(self, key: str) -> bool | None:
        """
        Seek an optional JSON key. Returns:
          True  — key found (buffer advanced past key)
          None  — need more data
          False — closing '}' found before key (key is absent)
        """
        needle = f"\"{key}\""
        key_idx = self._buf.find(needle)
        brace_idx = self._buf.find("}")

        if key_idx != -1:
            if brace_idx == -1 or key_idx < brace_idx:
                self._buf = self._buf[key_idx + len(needle):]
                return True

        if brace_idx != -1:
            return False

        self._buf = self._buf[-self._max_tail:]
        return None


    def _seek_string_value_start(self) -> int | None:
        """
        Move buffer to the first character *inside* the opening quote of the value.
        Returns None if not enough buffer yet.
        """
        colon = self._buf.find(":")
        if colon == -1:
            self._buf = self._buf[-self._max_tail :]
            return None

        j = colon + 1
        while j < len(self._buf) and self._buf[j] in " \t\r\n":
            j += 1
        if j >= len(self._buf):
            self._buf = self._buf[-self._max_tail :]
            return None

        if self._buf[j] != '"':
            self._buf = self._buf[-self._max_tail :]
            return None

        self._buf = self._buf[j + 1 :]
        return j


    def _seek_options_value_start(self) -> Literal["array", "null"] | None:
        """
        After \"options\" key, find ':' then either '[' (array) or 'null'.
        For '[', consume it and leave buffer inside the array.
        For 'null', consume it and return 'null'.
        """
        colon = self._buf.find(":")
        if colon == -1:
            self._buf = self._buf[-self._max_tail:]
            return None

        j = colon + 1
        while j < len(self._buf) and self._buf[j] in " \t\r\n":
            j += 1
        if j >= len(self._buf):
            self._buf = self._buf[-self._max_tail:]
            return None

        if self._buf[j] == "[":
            self._buf = self._buf[j + 1:]
            return "array"

        if self._buf[j:j + 4] == "null":
            self._buf = self._buf[j + 4:]
            return "null"

        rest = self._buf[j:]
        if len(rest) < 4 and "null".startswith(rest):
            self._buf = self._buf[-self._max_tail:]
            return None

        self._buf = self._buf[-self._max_tail:]
        return None


    def _try_consume_complete_json_array(self) -> str | None:
        """
        _buf is immediately after the opening '[' of the options array.
        Returns full JSON array text including brackets, or None if incomplete.
        """
        buf = self._buf
        depth = 1
        in_string = False
        escaped = False
        i = 0
        while i < len(buf):
            ch = buf[i]
            if in_string:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == '"':
                    in_string = False
            else:
                if ch == '"':
                    in_string = True
                elif ch == "[":
                    depth += 1
                elif ch == "]":
                    depth -= 1
                    if depth == 0:
                        inner = buf[: i + 1]
                        self._buf = buf[i + 1:]
                        return "[" + inner
            i += 1

        return None


    def _consume_string_chars(self) -> tuple[str, bool]:
        """
        Consume as much of the current JSON string value as possible.
        Returns:
            (text, done)
        - text: decoded text chunk to emit (may be empty)
        - done: True if we hit the closing quote of the string
        """
        if not self._buf:
            return "", False

        emitted: list[str] = []
        i = 0
        while i < len(self._buf):
            ch = self._buf[i]
            i += 1

            if self._escaped:
                emitted.append(self._ESCAPE_MAP.get(ch, ch))
                self._escaped = False
                continue

            if ch == "\\":
                self._escaped = True
                continue

            if ch == '"':
                self._buf = self._buf[i:]
                return "".join(emitted), True

            emitted.append(ch)

        self._buf = ""
        return "".join(emitted), False

"""
bullAI Internal Chat - service.

Written by: zapulam
"""

import inspect
import json
import string

from agents import (
    Agent,
    ModelSettings,
    RunConfig,
    Runner,
    RunContextWrapper,
    ToolsToFinalOutputFunction,
    ToolsToFinalOutputResult,
    WebSearchTool
)
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX
from agents.mcp import MCPServerStdio, create_static_tool_filter
from agents.models.openai_provider import OpenAIProvider
from agents.tool import HostedMCPTool, FunctionToolResult

from dataclasses import dataclass, field
from openai import AsyncOpenAI
from openai.types.responses.web_search_tool import Filters
from openai.types.shared import Reasoning
from typing import AsyncGenerator, Optional

from prompts import *
from models import ChatContext, Output
from tools import *
from memory import (
    create_session_and_load_state,
    get_session_has_summary,
    update_session_summary
)
from repositories import SettingsRepository
from streaming import stream_result_events


@dataclass
class ChatService:
    openai_client: AsyncOpenAI
    alpha_vantage_key: Optional[str] = None
    model: str = "gpt-5-mini"
    summary_model: str = "gpt-4.1-nano"

    def __post_init__(self):
        """
        Initialize ChatService agentic system

        Args:
            client (OpenAI): OpenAI client
            model (str): OpenAI model to use for agents.
        """
        self.base_tools = [
            WebSearchTool(),
            time_series_daily,
            time_series_weekly,
            time_series_monthly
        ]


    def tool_handler(
            context: RunContextWrapper[ChatContext],
            results: List[FunctionToolResult]
        ):
        """
        """
        for result in results:
            output = json.loads(result.output)
            if not output["follow_up"]:
                return ToolsToFinalOutputResult(
                    is_final_output=True,
                    final_output=output["content"]
                )



    async def generate_summary(
            self,
            user_input: str,
            assistant_response: str,
        ) -> str:
        """
        Generate a short summary of a conversation based on the first exchange.
        
        Args:
            user_input (str): The first user message.
            assistant_response (str): The assistant's response to the first message.
            
        Returns:
            str: A 5-8 word summary of the conversation topic.
        """
        system_prompt = (
            "Generate a very brief summary (4-6 words max) of this conversation topic."
            "The summary should capture the main intent or question from the user."
            "Do not include phrases like 'User asked about' or 'Conversation about'."
            "Just provide a direct, concise description."
        )

        input_text = (
            f"User: {user_input}\n"
            f"Assistant: {assistant_response}"
        )
        
        # Generate summary
        response = await self.openai_client.responses.create(
            model=self.summary_model,
            instructions=system_prompt,
            input=input_text,
            max_output_tokens=20,
            store=False
        )

        return response.output_text.strip().rstrip(string.punctuation)


    async def run_turn(
            self,
            conversation_id: str,
            user_input: str
        ) -> AsyncGenerator[dict, None]:
        """
        Run a single user turn with streaming response.

        Args:
            conversation_id: Identifier for conversation state storage.
            user_input: The user's message for this turn.
            user: User identifier for this session.

        Yields:
            dict: Streaming chunks with 'type' and 'content' keys.
        """
        provider = OpenAIProvider(openai_client=self.openai_client)

        settings_repo = SettingsRepository()
        memory_content = settings_repo.get_user_memory()
        memories_block = ""
        if memory_content and memory_content.strip():
            memories_block = "\n\n## User Memories\n" + memory_content.strip()

        triage = Agent(
            name="Triage agent",
            instructions=f"""{RECOMMENDED_PROMPT_PREFIX}\n{TRIAGE_PROMPT}\n{memories_block}""",
            tools=self.base_tools,
            output_type=Output,
            model=self.model,
            model_settings=ModelSettings(
                reasoning=Reasoning(effort="medium"),
                verbosity="medium",
                parallel_tool_calls=True,
                store=False,
                response_include=["reasoning.encrypted_content"]
            ),
            tool_use_behavior=self.tool_handler
        )
        
        # Load session
        session = await create_session_and_load_state(
            conversation_id=conversation_id
        )

        try:
            # Run with streaming and yield chunks as they come
            result = Runner.run_streamed(
                starting_agent=triage,
                input=user_input,
                session=session,
                max_turns=20,
                context=ChatContext(
                    alpha_vantage_key=self.alpha_vantage_key
                ),
                run_config=RunConfig(
                    model_provider=provider,
                    tracing_disabled=True
                )
            )

            # Stream the response content using stream_events()
            accumulated_text = ""
            async for chunk in stream_result_events(result):
                if chunk["type"] == "chunk":
                    accumulated_text += chunk["content"]
                yield chunk

            # Send final message with complete response
            yield {
                "type": "complete",
                "content": accumulated_text,
                "finished": True
            }

            # Generate summary after the first exchange if not already generated
            has_summary = await get_session_has_summary(conversation_id)
            if not has_summary and accumulated_text:
                summary = await self.generate_summary(
                    user_input=user_input,
                    assistant_response=accumulated_text,
                )
                await update_session_summary(conversation_id, summary)

        finally:
            # Close the session to clean up connections
            if hasattr(session, 'close'):
                if inspect.iscoroutinefunction(session.close):
                    await session.close()
                else:
                    session.close()

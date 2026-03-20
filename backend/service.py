"""
bullAI Internal Chat - service.

Written by: zapulam
"""

import inspect
import string

from agents import (
    Agent,
    ModelSettings,
    RunConfig,
    Runner,
    RunContextWrapper,
    ToolsToFinalOutputResult,
    WebSearchTool,
)
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX
from agents.mcp import create_static_tool_filter
from agents.models.openai_provider import OpenAIProvider
from agents.tool import FunctionToolResult

from dataclasses import dataclass
from openai import AsyncOpenAI
from openai.types.responses.web_search_tool import Filters
from openai.types.shared import Reasoning
from typing import AsyncGenerator, List, Optional

from prompts import *
from models import ChatContext, Output
from tools import *
from memory import (
    create_session_and_load_state,
    get_session_has_summary,
    update_session_summary
)
from context import (
    build_memory,
    create_cb,
)
from repositories import SettingsRepository
from streaming import stream_result_events


def tool_handler(
        context: RunContextWrapper[ChatContext],
        results: List[FunctionToolResult]
    ):
    """
    Adds option to stop tool call on chart call if agent desires.
    """
    for result in results:
        output = result.output
        if not output.get("follow_up", True):
            return ToolsToFinalOutputResult(
                is_final_output=True,
                final_output=output
            )
    return ToolsToFinalOutputResult(
        is_final_output=False,
        final_output=None
    )


@dataclass
class ChatService:
    openai_client: AsyncOpenAI
    alpha_vantage_key: Optional[str] = None
    model: str = "gpt-5.4-mini"
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
            google_finance_search,
            earnings,
            gainers_and_losers,
            ipo,
            quote,
            time_series_daily,
            time_series_weekly,
            time_series_monthly
        ]

        self.premium_tools = [
            WebSearchTool(),
            google_finance_search,
            bulk_quote,
            earnings,
            gainers_and_losers,
            ipo,
            options,
            quote,
            time_series_daily,
            time_series_weekly,
            time_series_monthly
        ]

        base_instructions = f"{RECOMMENDED_PROMPT_PREFIX}\n{TRIAGE_PROMPT}"
        model_settings = ModelSettings(
            reasoning=Reasoning(effort="medium"),
            verbosity="medium",
            parallel_tool_calls=True,
            store=False,
            response_include=["reasoning.encrypted_content"],
        )

        self.basic = Agent(
            name="Triage agent",
            instructions=base_instructions,
            tools=self.base_tools,
            output_type=Output,
            model=self.model,
            model_settings=model_settings,
            tool_use_behavior=tool_handler,
        )

        self.premium = Agent(
            name="Premium agent",
            instructions=base_instructions,
            tools=self.premium_tools,
            output_type=Output,
            model=self.model,
            model_settings=model_settings,
            tool_use_behavior=tool_handler,
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

        memories_block = build_memory(settings_repo)
        session_cb = create_cb(memories_block)

        key_type = settings_repo.get_alpha_vantage_key_type()
        starting_agent = self.premium if key_type == "premium" else self.basic

        session = await create_session_and_load_state(
            conversation_id=conversation_id
        )

        try:
            result = Runner.run_streamed(
                starting_agent=starting_agent,
                input=user_input,
                session=session,
                max_turns=20,
                context=ChatContext(
                    alpha_vantage_key=self.alpha_vantage_key,
                    key_type=key_type
                ),
                run_config=RunConfig(
                    model_provider=provider,
                    tracing_disabled=True,
                    call_model_input_filter=session_cb,
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
            if not has_summary:
                assistant_for_summary = (
                    accumulated_text.strip()
                    if accumulated_text and accumulated_text.strip()
                    else ""
                )
                summary = await self.generate_summary(
                    user_input=user_input,
                    assistant_response=assistant_for_summary,
                )
                await update_session_summary(conversation_id, summary)

        finally:
            # Close the session to clean up connections
            if hasattr(session, 'close'):
                if inspect.iscoroutinefunction(session.close):
                    await session.close()
                else:
                    session.close()

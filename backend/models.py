"""
bullAI Internal Chat - API models

Written by: zapulam
"""

from pydantic import BaseModel, Field, model_validator
from typing import Optional, Any, Literal, List


# Chat Context
class ChatContext(BaseModel):
    alpha_vantage_key: str
    key_type: str = "free"


# Structured output for bullAI triage agent
class NextStep(BaseModel):
    type: Literal["choice_question", "open_question"] = Field(
        description=(
            "`choice_question`: each listed choice should be enough for the agent to act without more free text "
            "(single selection by default; set `allow_multiple` true if the user may pick several). "
            "`open_question`: the user should supply more detail."
        )
    )
    prompt: str = Field(
        description=(
            "User-facing question or next suggested step; should align with `type`; for `choice_question`, choices "
            "work best as self-contained branches rather than broad categories that need more explanation after a pick."
        )
    )
    choices: Optional[List[str]] = Field(
        default=None,
        description=(
            "2-4 strings when type is `choice_question`; each should be a specific option the agent can use without "
            "extra clarification (user picks one unless `allow_multiple` is true, then one or more); otherwise null."
        )
    )
    allow_multiple: bool = Field(
        default=False,
        description=(
            "For `choice_question` only: if true, the user may select more than one of `choices`; if false, single "
            "select. Always false for `open_question`."
        )
    )
    allow_other: bool = Field(
        default=False,
        description=(
            "For `choice_question` only: if true, the user may type their own anwer to the question. "
            "Always false for `open_question`."
        )
    )

    @model_validator(mode="before")
    @classmethod
    def _coerce_allow_multiple_for_open_question(cls, data: Any) -> Any:
        if isinstance(data, dict) and data.get("type") == "open_question":
            out = dict(data)
            out["allow_multiple"] = False
            return out
        return data


class Output(BaseModel):
    """
    Orchestration Agent structured output.
    """
    thought: str = Field(
        description="A highly-detailed explantion of the internal process of the actions you took and why, written in complete sentences."
    )
    response: str = Field(
        description=(
            "Detailed, user-facing answer in structured markdown. Do not list discrete pick-one follow-ups "
            "Use the `options with type choice_question and those strings as choices."
        )
    )
    options: Optional[List[NextStep]] = Field(
        description=(
            "Optional follow-up next steps or questions for the user. "
            "Use `choice_question` for 2-4 concrete paths or answers the user can pick; set `allow_multiple` true only "
            "when multiple selections are valid. "
            "Use `choice_question` when each choice is a complete, actionable branch; otherwise prefer `open_question` "
            "with choices null, which allows the user to respond directly."
        )
    )
    status: Literal["incomplete", "awaiting_approval", "complete"] = Field(
        default="incomplete",
        description=(
            "Set to: "
            "`complete` when the turn is fully answered and you are not waiting on the user (typically options null or omitted). "
            "`awaiting_approval` when options are present and you expect a user reply. "
            "`incomplete` for partial turns."
        ),
    )


def get_call_id(raw_item: Any) -> Optional[str]:
    """
    Extract call_id from tool call or output raw_item.
    Hosted tools (e.g. web search, file search) use `id` instead of `call_id`.
    """
    if isinstance(raw_item, dict):
        return raw_item.get("call_id") or raw_item.get("id")

    cid = getattr(raw_item, "call_id", None)
    if cid:
        return cid
    return getattr(raw_item, "id", None)


# --- Chat generation ---
class TurnRequest(BaseModel):
    """
    FastAPI payload
    """
    conversation_id: str
    user_input: str


# Memories
class MemoryGetResponse(BaseModel):
    content: str


class MemoryPutRequest(BaseModel):
    content: str = Field(max_length=5000)


# Settings 
class OpenAIKeyRequest(BaseModel):
    api_key: str = Field(min_length=1)


class OpenAIKeyResponse(BaseModel):
    has_key: bool
    masked_key: Optional[str] = None


class AlphaVantageKeyRequest(BaseModel):
    api_key: str = Field(min_length=1)


class AlphaVantageKeyTypeRequest(BaseModel):
    key_type: Literal["free", "premium"]


class AlphaVantageKeyResponse(BaseModel):
    has_key: bool
    masked_key: Optional[str] = None
    key_type: Literal["free", "premium"] = "free"


# User preferences
class PreferredChartTypeRequest(BaseModel):
    chart_type: Literal["simple", "candlestick"]


class DefaultTimeSeriesRequest(BaseModel):
    time_series: Literal["daily", "weekly", "monthly"]


class DefaultTechnicalIndicatorRequest(BaseModel):
    indicator: Literal["none", "sma:20", "sma:50", "ema:20", "ema:50", "wma:20", "wma:50"]


class ResponseVerbosityRequest(BaseModel):
    verbosity: Literal["brief", "standard", "detailed"]


class UserPreferencesResponse(BaseModel):
    preferred_chart_type: Literal["simple", "candlestick"] = "simple"
    default_time_series: Literal["daily", "weekly", "monthly"] = "daily"
    default_technical_indicator: Literal["none", "sma:20", "sma:50", "ema:20", "ema:50", "wma:20", "wma:50"] = "none"
    response_verbosity: Literal["brief", "standard", "detailed"] = "standard"


# Time series models
class TimeSeriesMeta(BaseModel):
    symbol: Optional[str] = None
    interval: Optional[str] = None
    lastRefreshed: Optional[str] = None
    timeZone: Optional[str] = None
    outputSize: Optional[str] = None
    source: Optional[str] = None


class TimeSeriesPoint(BaseModel):
    timestamp: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[int] = None


class TimeSeriesResponse(BaseModel):
    meta: TimeSeriesMeta
    points: List[TimeSeriesPoint]


# Charts
class ChartSaveRequest(BaseModel):
    title: str = Field(min_length=1)
    visualization_data: dict
    call_data: dict

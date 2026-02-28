"""
bullAI Internal Chat - API models

Written by: zapulam
"""

from pydantic import BaseModel, Field
from typing import Optional, Any, Literal, List


# Chat Context
class ChatContext(BaseModel):
    alpha_vantage_key: str
    key_type: str = "free"


# Structured output for bullAI triage agent
class Output(BaseModel):
    """
    Structured output for the bullAI triage agent.
    """
    thought: str = Field(
        default=None,
        description=(
            "Internal process of how you came to your response, written in complete sentences. "
            "This is shown separately from the final response."
        ),
    )
    response: str = Field(
        description="Detailed, user-facing response, written in complete sentences."
    )
    status: Literal["incomplete", "awaiting_approval", "complete"] = Field(
        default="incomplete"
    )


# Chat generation
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

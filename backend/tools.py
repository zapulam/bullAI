"""
bullAI Internal Chat - agent tools.

Written by: zapulam
"""

from agents import RunContextWrapper, function_tool
from typing import Any, List, Literal, Optional

from models import ChatContext
from visualization import build_visualization
from utils import build_url, get_data

from settings import settings


### Chart Refresh (standalone, no agent)
async def execute_chart_call(call_data: dict, alpha_vantage_key: str) -> dict:
    """
    Execute a time-series chart call using call_data. Used for chart refresh.

    Args:
        call_data: Dict with func, ticker, chart_type, screens, time_periods.
        alpha_vantage_key: Alpha Vantage API key.

    Returns:
        Tool result dict with visualization key.

    Raises:
        ValueError: If call_data is invalid or func is unsupported.
    """
    if not call_data or not isinstance(call_data, dict):
        raise ValueError("call_data is required and must be a dict")
    func = call_data.get("func")
    ticker = call_data.get("ticker")
    chart_type = call_data.get("chart_type", "simple")
    screens = call_data.get("screens") or []
    time_periods = call_data.get("time_periods") or []

    if not func or not ticker:
        raise ValueError("call_data must include func and ticker")

    if func not in ("time_series_daily", "time_series_weekly", "time_series_monthly"):
        raise ValueError(f"Unsupported func: {func}")

    func_map = {
        "time_series_daily": ("TIME_SERIES_DAILY", "Time Series (Daily)", "daily"),
        "time_series_weekly": ("TIME_SERIES_WEEKLY", "Weekly Time Series", "weekly"),
        "time_series_monthly": ("TIME_SERIES_MONTHLY", "Monthly Time Series", "monthly"),
    }
    av_function, ts_key, interval = func_map[func]
    url = build_url({
        "function": av_function,
        "symbol": ticker,
        "apikey": alpha_vantage_key,
    })

    data = await get_data(url)

    result = {
        "metadata": data.get("Meta Data"),
        "viz": True,
        "call": {
            "func": func,
            "ticker": ticker,
            "chart_type": chart_type,
            "screens": screens,
            "time_periods": time_periods,
        },
    }

    if screens and time_periods:
        result["screen_data"] = []
        for s in zip(screens, time_periods):
            d = await get_screen_data(s, interval, alpha_vantage_key, ticker)
            result["screen_data"].append(d)

    viz_obj = build_visualization(result)
    if viz_obj is not None:
        result["visualization"] = viz_obj

    return result


### Function Tool Helper Functions
async def get_screen_data(
        s,
        interval,
        key,
        ticker: str,
    ) -> dict:
    """
    Get screen data.

    Args:
        s (list): Screen and interval.
        interval (int): Screen type (daily, weekly, monthly).
        key (str): Alpha Vantage key.
        ticker (str): Stock ticker symbol.

    Returns:
        dict: Screen data.
    """
    if s[0] == 'ema':
        url = build_url({
            "function": "EMA",
            "symbol": ticker,
            "interval": interval,
            "time_period": s[1],
            "series_type": "open",
            "apikey": key,
        })
        data = await get_data(url)
        if "Technical Analysis: EMA" not in data:
            error_msg = data.get("Error Message") or data.get("Note") or "Invalid API response"
            raise ValueError(error_msg)
        raw = data["Technical Analysis: EMA"]
        rows = [(date, float(payload["EMA"])) for date, payload in raw.items()]
        rows.sort(key=lambda x: x[0])
        data = {"title": "ema", "data": rows}
        return data

    if s[0] == 'sma':
        url = build_url({
            "function": "SMA",
            "symbol": ticker,
            "interval": interval,
            "time_period": s[1],
            "series_type": "open",
            "apikey": key,
        })
        data = await get_data(url)
        if "Technical Analysis: SMA" not in data:
            error_msg = data.get("Error Message") or data.get("Note") or "Invalid API response"
            raise ValueError(error_msg)
        raw = data["Technical Analysis: SMA"]
        rows = [(date, float(payload["SMA"])) for date, payload in raw.items()]
        rows.sort(key=lambda x: x[0])
        data = {"title": "sma", "data": rows}
        return data

    if s[0] == 'wma':
        url = build_url({
            "function": "WMA",
            "symbol": ticker,
            "interval": interval,
            "time_period": s[1],
            "series_type": "open",
            "apikey": key,
        })
        data = await get_data(url)
        if "Technical Analysis: WMA" not in data:
            error_msg = data.get("Error Message") or data.get("Note") or "Invalid API response"
            raise ValueError(error_msg)
        raw = data["Technical Analysis: WMA"]
        rows = [(date, float(payload["WMA"])) for date, payload in raw.items()]
        rows.sort(key=lambda x: x[0])
        data = {"title": "wma", "data": rows}
        return data


### Function Tools

# premium
@function_tool()
async def bulk_quote(
        wrapper: RunContextWrapper[ChatContext],
        tickers: List[str],
    ) -> dict[str, Any]:
    """
    Get current prices data of the global equities specified.

    Args:
        ticker (str): Stock ticker.
    """
    url = build_url({
        "function": "REALTIME_BULK_QUOTE",
        "symbol": ",".join(tickers),
        "apikey": wrapper.context.alpha_vantage_key,
    })

    result = {
        "data": [],
        "follow_up": True
    }

    data = await get_data(url)
    
    for d in data["data"]:
        result["data"].append({
            "ticker": d["symbol"],
            "time": d["timestamp"],
            "current_price": d["close"],
            "open": d["open"],
            "high": d["high"],
            "low": d["low"],
            "previous_close": d["previous_close"],
            "change": d["change"],
            "percent_change": d["change_percent"],
            "volume": d["volume"]
        })

    return result


# basic
@function_tool()
async def earnings(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        quarter: str
    ) -> dict[str, Any]:
    """
    Get the earnings call transcript for a given company in a specific quarter.

    Args:
        ticker (str): Stock ticker.
        quarter (str): Fiscal quarter in YYYYQM format (i.e. `quarter=2024Q1`).
    """
    url = build_url({
        "function": "EARNINGS_CALL_TRANSCRIPT",
        "symbol": ticker,
        "quarter": quarter,
        "apikey": wrapper.context.alpha_vantage_key,
    })

    result = {
        "data": None,
        "follow_up": True
    }

    data = await get_data(url)
    
    result["data"] = data

    return result


# basic
@function_tool()
async def gainers_and_losers(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        quarter: str
    ) -> dict[str, Any]:
    """
    Get top 20 gainers, losers, and the most active traded tickers in the US market.

    Args:
        ticker (str): Stock ticker.
        quarter (str): Fiscal quarter in YYYYQM format (i.e. `quarter=2024Q1`).
    """
    url = build_url({
        "function": "TOP_GAINERS_LOSERS",
        "symbol": ticker,
        "quarter": quarter,
        "apikey": wrapper.context.alpha_vantage_key,
    })

    result = {
        "data": {},
        "follow_up": True
    }

    data = await get_data(url)
    
    result["data"]["top_gainers"] = data["top_gainers"]
    result["data"]["top_losers"] = data["top_losers"]

    return result


# basic
@function_tool()
async def ipo(
        wrapper: RunContextWrapper[ChatContext],
    ) -> dict[str, Any]:
    """
    Get a list of IPOs expected in the next 3 months.
    """
    url = build_url({
        "function": "IPO_CALENDAR",
        "apikey": wrapper.context.alpha_vantage_key,
    })

    result = {
        "data": None,
        "follow_up": True
    }

    data = await get_data(url)
    
    result["data"] = data

    return result


# premium
@function_tool()
async def options(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
    ) -> dict[str, Any]:
    """
    Get realtime options data.

    Args:
        ticker (str): Stock ticker.
    """
    url = build_url({
        "function": "REALTIME_OPTIONS",
        "symbol": ticker,
        "apikey": wrapper.context.alpha_vantage_key,
    })

    result = {
        "data": [],
        "follow_up": True
    }

    data = await get_data(url)
    
    for d in data["data"]:
        result["data"].append({
            "expiration": d["expiration"],
            "type": d["type"],
            "strike": d["strike"],
            "last": d["last"],
            "mark": d["mark"],
            "bid": d["bid"],
            "bid_size": d["bid_size"],
            "ask": d["ask"],
            "ask_size": d["ask_size"],
            "volume": d["volume"],
            "open_interest": d["open_interest"],
        })

    return result


# basic
@function_tool()
async def overview(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
    ) -> dict[str, Any]:
    """
    Get company information, financial ratios, and other key metrics for the equity specified.

    Args:
        ticker (str): Stock ticker.
    """
    url = build_url({
        "function": "OVERVIEW",
        "symbol": ticker,
        "apikey": wrapper.context.alpha_vantage_key,
    })

    result = {
        "data": None,
        "follow_up": True
    }

    data = await get_data(url)
    
    result["data"] = data

    return result


# basic
@function_tool()
async def quote(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
    ) -> dict[str, Any]:
    """
    Get current price data of the global equity specified.

    Args:
        ticker (str): Stock ticker.
    """
    url = build_url({
        "function": "GLOBAL_QUOTE",
        "symbol": ticker,
        "apikey": wrapper.context.alpha_vantage_key,
    })

    result = {
        "data": None,
        "follow_up": True
    }

    data = await get_data(url)
    
    result["data"] = {
        "ticker": data["Global Quote"]["01. symbol"],
        "last_trading_day": data["Global Quote"]["07. latest trading day"],
        "current_price": data["Global Quote"]["05. price"],
        "open": data["Global Quote"]["02. open"],
        "high": data["Global Quote"]["03. high"],
        "low": data["Global Quote"]["04. low"],
        "previous_close": data["Global Quote"]["08. previous close"],
        "change": data["Global Quote"]["09. change"],
        "percent_change": data["Global Quote"]["10. change percent"],
        "volume": data["Global Quote"]["06. volume"]
    }

    return result


# basic
@function_tool()
async def search(
        wrapper: RunContextWrapper[ChatContext],
        keyword: str
    ) -> dict[str, Any]:
    """
    Search for a ticker based on a keyword.

    Args:
        keyword (str): Keyword used for search.
    """
    url = build_url({
        "function": "SYMBOL_SEARCH",
        "keywords": keyword,
        "apikey": wrapper.context.alpha_vantage_key,
    })

    data = await get_data(url)
    matches = data["bestMatches"]

    result = {"best_matches": [
        {
            "ticker": match["1. symbol"],
            "name": match["2. name"],
            "region": match["3. region"],
            "currency": match["8. currency"]
        } for match in matches]}
    
    return result


# basic
@function_tool()
async def sentiment(
        wrapper: RunContextWrapper[ChatContext],
        tickers: Optional[List[str]],
        topics: Optional[List[Literal[
            "blockchain",
            "earnings",
            "ipo",
            "mergers_and_acquisitions",
            "financial_markets",
            "economy_fiscal",
            "economy_monetary",
            "economy_macro",
            "energy_transportation",
            "finance",
            "life_sciences",
            "manufacturing",
            "real_estate",
            "retail_wholesale",
            "technology"]]],
        time_from: Optional[str],
        time_to: Optional[str]
    ) -> dict[str, Any]:
    """
    Seearch for a ticker based on a keyword

    Args:
        tickers (List[str]): List of tickers to search
        topics (List[str]): List of topics to search
        time_from (str): Starting time range formatted like `YYYYMMDD`
        time_to (str): Ending time range formatted like `YYYYMMDD`
    """
    params = {
        "function": "NEWS_SENTIMENT",
        "topics": ",".join(topics) if topics else None,
        "tickers": ",".join(tickers) if tickers else None,
        "time_from": time_from + "T0000" if time_from else None,
        "time_to": time_to + "T0000" if time_to else None,
        "limit": settings.sentiment_limit,
        "apikey": wrapper.context.alpha_vantage_key,
    }
    url = build_url(params)
    result = await get_data(url)
    
    return result


# basic
@function_tool()
async def time_series_daily(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        chart_type: Literal["simple", "candlestick"],
        screens: Optional[List[Literal["sma", "ema", "wma"]]] = None,
        time_periods: Optional[List[int]] = None
    ) -> dict[str, Any]:
    """
    Get past 100 days of daily time series data + chart of the global equity specified. Returns chart to the user and data to you.

    Args:
        ticker (str): Stock ticker.
        chart_type (str): "simple" for line chart of close prices, "candlestick" for OHLC candlestick chart.
        screens (List[str]): Optional screens to add to a visualization
        time_periods (List[int]): Time period for each screen added. This list should be the same length as `screens`.
    """
    url = build_url({
        "function": "TIME_SERIES_DAILY",
        "symbol": ticker,
        "apikey": wrapper.context.alpha_vantage_key,
    })

    result = {
        "metadata": None,
        "follow_up": False
    }

    data = await get_data(url)

    if data.get('Information', "").startswith("We have detected your API key as"):
        result = {"warning": "Your Alpha Vantage API key has met its daily rate limit."}
    result["metadata"] = data["Meta Data"]
    result["timeseries_data"] = data["Time Series (Daily)"]
    
    if wrapper.context.key_type == "premium":
        if screens and time_periods:
            result["screen_data"] = []
            for s in zip(screens, time_periods):
                d = await get_screen_data(s, "daily", wrapper.context.alpha_vantage_key, ticker)
                result["screen_data"].append(d)

    result["call"] = {
        "func": "time_series_daily",
        "ticker": ticker,
        "chart_type": chart_type,
        "screens": screens or [],
        "time_periods": time_periods or [],
    }

    viz_obj = build_visualization(result)
    if viz_obj is not None:
        result["visualization"] = viz_obj
        del result["timeseries_data"]

    return result


# basic
@function_tool()
async def time_series_weekly(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        chart_type: Literal["simple", "candlestick"],
        screens: Optional[List[Literal["sma", "ema", "wma"]]] = None,
        time_periods: Optional[List[int]] = None
    ) -> dict[str, Any]:
    """
    Get past 100 weeks of weekly time series data + chart of the global equity specified. Returns chart to the user and data to you.

    Args:
        ticker (str): Stock ticker.
        chart_type (str): "simple" for line chart of close prices, "candlestick" for OHLC candlestick chart.
        screens (List[str]): Optional screens to add to a visualization
        time_periods (List[int]): Time period for each screen added. This list should be the same length as `screens`.
    """
    url = build_url({
        "function": "TIME_SERIES_WEEKLY",
        "symbol": ticker,
        "apikey": wrapper.context.alpha_vantage_key,
    })

    result = {
        "metadata": None,
        "follow_up": False
    }

    data = await get_data(url)

    if data.get('Information', "").startswith("We have detected your API key as"):
        result = {"warning": "Your Alpha Vantage API key has met its daily rate limit."}
    result["metadata"] = data["Meta Data"]
    result["timeseries_data"] = data["Weekly Time Series"]
    
    if wrapper.context.key_type == "premium":
        if screens and time_periods:
            result["screen_data"] = []
            for s in zip(screens, time_periods):
                d = await get_screen_data(s, "weekly", wrapper.context.alpha_vantage_key, ticker)
                result["screen_data"].append(d)

    result["call"] = {
        "func": "time_series_weekly",
        "ticker": ticker,
        "chart_type": chart_type,
        "screens": screens or [],
        "time_periods": time_periods or [],
    }

    viz_obj = build_visualization(result)
    if viz_obj is not None:
        result["visualization"] = viz_obj
        del result["timeseries_data"]

    return result


# basic
@function_tool()
async def time_series_monthly(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        chart_type: Literal["simple", "candlestick"],
        screens: Optional[List[Literal["sma", "ema", "wma"]]] = None,
        time_periods: Optional[List[int]] = None
    ) -> dict[str, Any]:
    """
    Get past 100 months of monthly time series data + chart of the global equity specified. Returns chart to the user and data to you.

    Args:
        ticker (str): Stock ticker.
        chart_type (str): "simple" for line chart of close prices, "candlestick" for OHLC candlestick chart.
        screens (List[str]): Optional screens to add to a visualization
        time_periods (List[int]): Time period for each screen added. This list should be the same length as `screens`.
    """
    url = build_url({
        "function": "TIME_SERIES_MONTHLY",
        "symbol": ticker,
        "apikey": wrapper.context.alpha_vantage_key,
    })

    result = {
        "metadata": None,
        "follow_up": False
    }

    data = await get_data(url)

    if data.get('Information', "").startswith("We have detected your API key as"):
        result = {"warning": "Your Alpha Vantage API key has met its daily rate limit."}
    
    result["metadata"] = data["Meta Data"]
    result["timeseries_data"] = data["Monthly Time Series"]
    
    if wrapper.context.key_type == "premium":
        if screens and time_periods:
            result["screen_data"] = []
            for s in zip(screens, time_periods):
                d = await get_screen_data(s, "monthly", wrapper.context.alpha_vantage_key, ticker)
                result["screen_data"].append(d)

    result["call"] = {
        "func": "time_series_monthly",
        "ticker": ticker,
        "chart_type": chart_type,
        "screens": screens or [],
        "time_periods": time_periods or [],
    }

    viz_obj = build_visualization(result)
    if viz_obj is not None:
        result["visualization"] = viz_obj
        del result["timeseries_data"]

    return result

"""
bullAI Internal Chat - agent tools.

Written by: zapulam
"""

import requests

from agents import RunContextWrapper, function_tool
from typing import Any, Dict, List, Literal, Optional, Tuple

from models import ChatContext
from settings import settings
from visualization import build_visualization


async def get_screen_data(
        s,
        interval,
        key,
        ticker: str = "IBM",
    ) -> dict:
    """
    Get screen data.

    Args:
        s (list): Screen and interval.
        interval (int): Data points composed in an interval.
        key (str): Alpha Vantage key.
        ticker (str): Stock ticker symbol.

    Returns:
        dict: Screen data.
    """
    if s[0] == 'sma':
        url = f"https://www.alphavantage.co/query?function=SMA&symbol={ticker}&interval={interval}&time_period={s[1]}&series_type=open&apikey={key}"
        raw = requests.get(url).json()["Technical Analysis: SMA"]
        rows = [(date, float(payload["SMA"])) for date, payload in raw.items()]
        rows.sort(key=lambda x: x[0])
        data = {"title": "sma", "data": rows}
        return data
    if s[0] == 'wma':
        url = f"https://www.alphavantage.co/query?function=WMA&symbol={ticker}&interval={interval}&time_period={s[1]}&series_type=open&apikey={key}"
        raw = requests.get(url).json()["Technical Analysis: WMA"]
        rows = [(date, float(payload["WMA"])) for date, payload in raw.items()]
        rows.sort(key=lambda x: x[0])
        data = {"title": "wma", "data": rows}
        return data
    if s[0] == 'ema':
        url = f"https://www.alphavantage.co/query?function=EMA&symbol={ticker}&interval={interval}&time_period={s[1]}&series_type=open&apikey={key}"
        raw = requests.get(url).json()["Technical Analysis: EMA"]
        rows = [(date, float(payload["EMA"])) for date, payload in raw.items()]
        rows.sort(key=lambda x: x[0])
        data = {"title": "ema", "data": rows}
        return data


@function_tool()
async def time_series_daily(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        visual: bool,
        chart_type: Literal["simple", "candlestick"],
        screens: Optional[List[Literal["sma", "ema", "wma"]]] = None,
        time_periods: Optional[List[int]] = None
    ) -> dict[str, Any]:
    """
    Returns daily time series of the global equity specified.

    Args:
        ticker (str): Stock ticker.
        visual (bool): Do you wish to create a visual?
        chart_type (str): "simple" for line chart of close prices, "candlestick" for OHLC candlestick chart.
        screens (List[str]): Optional screens to add to a visualization
        time_periods (List[int]): Time period for each screen added
    """
    url = f'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={ticker}&apikey={wrapper.context.alpha_vantage_key}'

    result = {
        "viz": visual,
        "metadata": None,
        "timeseries_data": None
    }

    data = requests.get(url).json()
    result["metadata"] = data["Meta Data"]
    result["timeseries_data"] = data["Time Series (Daily)"]
    
    if screens and time_periods:
        result["screen_data"] = []
        for s in zip(screens, time_periods):
            d = get_screen_data(s, "daily", wrapper.context.alpha_vantage_key, ticker)
            result["screen_data"].append(d)

    result["call"] = {
        "func": "time_series_daily",
        "ticker": ticker,
        "chart_type": chart_type,
        "screens": screens or [],
        "time_periods": time_periods or [],
    }

    if visual:
        viz_obj = build_visualization(result)
        if viz_obj is not None:
            result["visualization"] = viz_obj

    return result


@function_tool()
async def time_series_weekly(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        visual: bool,
        chart_type: Literal["simple", "candlestick"],
        screens: Optional[List[Literal["sma", "ema", "wma"]]] = None,
        time_periods: Optional[List[int]] = None
    ) -> dict[str, Any]:
    """
    Returns weekly time series of the global equity specified.

    Args:
        ticker (str): Stock ticker.
        visual (bool): Do you wish to create a visual?
        chart_type (str): "simple" for line chart of close prices, "candlestick" for OHLC candlestick chart.
        screens (List[str]): Optional screens to add to a visualization
        time_periods (List[int]): Time period for each screen added
    """
    url = f'https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol={ticker}&apikey={wrapper.context.alpha_vantage_key}'

    result = {
        "viz": visual,
        "metadata": None,
        "timeseries_data": None
    }

    data = requests.get(url).json()
    result["metadata"] = data["Meta Data"]
    result["timeseries_data"] = data["Weekly Time Series"]
    
    if screens and time_periods:
        result["screen_data"] = []
        for s in zip(screens, time_periods):
            d = get_screen_data(s, "weekly", wrapper.context.alpha_vantage_key, ticker)
            result["screen_data"].append(d)

    result["call"] = {
        "func": "time_series_weekly",
        "ticker": ticker,
        "chart_type": chart_type,
        "screens": screens or [],
        "time_periods": time_periods or [],
    }

    if visual:
        viz_obj = build_visualization(result)
        if viz_obj is not None:
            result["visualization"] = viz_obj

    return result


@function_tool()
async def time_series_monthly(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        visual: bool,
        chart_type: Literal["simple", "candlestick"],
        screens: Optional[List[Literal["sma", "ema", "wma"]]] = None,
        time_periods: Optional[List[int]] = None
    ) -> dict[str, Any]:
    """
    Returns monthly time series of the global equity specified.

    Args:
        ticker (str): Stock ticker.
        visual (bool): Do you wish to create a visual?
        chart_type (str): "simple" for line chart of close prices, "candlestick" for OHLC candlestick chart.
        screens (List[str]): Optional screens to add to a visualization
        time_periods (List[int]): Time period for each screen added
    """
    url = f'https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol={ticker}&apikey={wrapper.context.alpha_vantage_key}'

    result = {
        "viz": visual,
        "metadata": None,
        "timeseries_data": None
    }

    data = requests.get(url).json()
    result["metadata"] = data["Meta Data"]
    result["timeseries_data"] = data["Monthly Time Series"]
    
    if screens and time_periods:
        result["screen_data"] = []
        for s in zip(screens, time_periods):
            d = get_screen_data(s, "monthly", wrapper.context.alpha_vantage_key, ticker)
            result["screen_data"].append(d)

    result["call"] = {
        "func": "time_series_monthly",
        "ticker": ticker,
        "chart_type": chart_type,
        "screens": screens or [],
        "time_periods": time_periods or [],
    }

    if visual:
        viz_obj = build_visualization(result)
        if viz_obj is not None:
            result["visualization"] = viz_obj

    return result

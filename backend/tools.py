"""
bullAI Internal Chat - agent tools.

Written by: zapulam
"""

import requests

from agents import RunContextWrapper, function_tool
from typing import Any, Dict, List, Literal, Optional, Tuple

from models import ChatContext
from settings import settings


async def get_screen_data(
        s,
        interval,
        key
    ) -> dict:
    """
    Get screen data.

    Args:
        s (list): Screen and interval.
        interval (int): Data points composed in an interval.
        key (str): Alpha Vantage key.

    Returns:
        dict: Screen data. 
    """
    if s[0] == 'sma':
        url = f"https://www.alphavantage.co/query?function=SMA&symbol=IBM&interval={interval}&time_period={s[1]}&series_type=open&apikey={key}"
        data = requests.get(url).json()["Technical Analysis: SMA"]
        return data
    if s[0] == 'wma':
        url = f"https://www.alphavantage.co/query?function=WMA&symbol=IBM&interval={interval}&time_period={s[1]}&series_type=open&apikey={key}"
        data = requests.get(url).json()["Technical Analysis: WMA"]
        return data
    if s[0] == 'ema':
        url = f"https://www.alphavantage.co/query?function=EMA&symbol=IBM&interval={interval}&time_period={s[1]}&series_type=open&apikey={key}"
        data = requests.get(url).json()["Technical Analysis: EMA"]
        return data


@function_tool()
async def time_series_daily(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        visual: bool,
        screens: Optional[List[Literal["sma", "ema", "wma"]]] = None,
        time_periods: Optional[List[int]] = None
    ) -> dict[str, Any]:
    """
    Returns daily time series of the global equity specified.

    Args:
        ticker (str): Stock ticker.
        visual (str): Do you wish to create a visual?
        screens (List[str]): Optional screens to add to a visualization
        time_period (List[int]): Time period for each screen added
    """
    url = f'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={ticker}&apikey={wrapper.context.alpha_vantage_key}'

    result = {
        "viz": visual,
        "metadata": None,
        "timeseries_data": None
    }

    data = requests.get(url).json()
    result["metadata"] = data["Meta Data"]
    result["data"] = data["Time Series (Daily)"]
    
    if screens:
        result["screen_data"] = []
        for s in zip(screens, time_periods):
            d = get_screen_data(s, "daily", wrapper.context.alpha_vantage_key)
            result["screen_data"].append(d)

    return result


@function_tool()
async def time_series_weekly(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        visual: bool,
        screens: Optional[List[Literal["sma", "ema", "wma"]]] = None,
        time_periods: Optional[List[int]] = None
    ) -> dict[str, Any]:
    """
    Returns weekly time series of the global equity specified.

    Args:
        ticker (str): Stock ticker.
        visual (str): Do you wish to create a visual?
        screens (List[str]): Optional screens to add to a visualization
        time_period (List[int]): Time period for each screen added
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
    
    if screens:
        result["screen_data"] = []
        for s in zip(screens, time_periods):
            d = get_screen_data(s, "daily", wrapper.context.alpha_vantage_key)
            result["screen_data"].append(d)

    return result


@function_tool()
async def time_series_monthly(
        wrapper: RunContextWrapper[ChatContext],
        ticker: str,
        visual: bool,
        screens: Optional[List[Literal["sma", "ema", "wma"]]] = None,
        time_periods: Optional[List[int]] = None
    ) -> dict[str, Any]:
    """
    Returns monthly time series of the global equity specified.

    Args:
        ticker (str): Stock ticker.
        visual (str): Do you wish to create a visual?
        screens (List[str]): Optional screens to add to a visualization
        time_period (List[int]): Time period for each screen added
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
    
    if screens:
        result["screen_data"] = []
        for s in zip(screens, time_periods):
            d = get_screen_data(s, "daily", wrapper.context.alpha_vantage_key)
            result["screen_data"].append(d)

    return result

"""
bullAI Internal Chat - agent tools.

Written by: zapulam
"""

import json
import requests

from typing import Any


class RateLimitExceededError(Exception):
    """Base exception for API client errors."""
    pass


async def get_data(
        url: str
    ) -> dict[str, Any]:
    """

    """
    try:
        data = requests.get(url, timeout=10).json()
    except json.JSONDecodeError:
        raise ValueError("Alpha Vantage's API request timed out.")
    except requests.exceptions.Timeout:
        raise ValueError("Alpha Vantage's API request timed out.")
    if data.get('Information', "").startswith("We have detected your API key as"):
        raise RateLimitExceededError("Your Alpha Vantage API key has met its daily rate limit.")
    return data

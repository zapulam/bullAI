"""
AI admin chat settings.

Written by: zapulam
"""

import json
import os

from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    openai_api_key: str
    alpha_vantage_api_key: str

    db_path: str
    docs_path: str


@lru_cache(maxsize=1)
def get_settings(
        config_file: str = "config.json",
    ) -> Settings:

    # Load config.json once
    with open(config_file, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    return Settings(
        openai_api_key = os.getenv("OPENAI_API_KEY"),
        alpha_vantage_api_key = os.getenv("ALPHA_VANTAGE_API_KEY"),

        db_path = cfg["db_path"],
        docs_path = cfg["docs_path"]
    )


# Convenience alias used by most modules
settings = get_settings()

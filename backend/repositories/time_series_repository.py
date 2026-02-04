"""
Time series normalization repository.

Written by: zapulam
"""

import ast
import json
from typing import Any, Optional


class TimeSeriesRepository:
    def normalize_alpha_vantage_time_series(self, payload: Any) -> Optional[dict]:
        parsed = self._parse_payload(payload)
        if not isinstance(parsed, dict):
            return None

        meta = parsed.get("Meta Data")
        if not isinstance(meta, dict):
            return None

        series_key = self._get_time_series_key(parsed)
        if not series_key:
            return None

        series = parsed.get(series_key)
        if not isinstance(series, dict):
            return None

        normalized_points = []
        for timestamp, values in series.items():
            if not isinstance(values, dict):
                continue
            normalized_points.append(
                {
                    "timestamp": timestamp,
                    "open": self._to_float(values.get("1. open")),
                    "high": self._to_float(values.get("2. high")),
                    "low": self._to_float(values.get("3. low")),
                    "close": self._to_float(values.get("4. close")),
                    "volume": self._to_int(values.get("5. volume")),
                }
            )

        normalized_points.sort(key=lambda point: point["timestamp"])

        interval = meta.get("4. Interval") or self._extract_interval(series_key)

        return {
            "meta": {
                "symbol": meta.get("2. Symbol"),
                "interval": interval,
                "lastRefreshed": meta.get("3. Last Refreshed"),
                "timeZone": meta.get("6. Time Zone"),
                "outputSize": meta.get("5. Output Size"),
                "source": "alpha_vantage",
            },
            "points": normalized_points,
        }

    def _parse_payload(self, payload: Any) -> Optional[dict]:
        if isinstance(payload, dict):
            return payload

        if isinstance(payload, str):
            raw = payload.strip()
            if raw.startswith("Tool output: "):
                raw = raw[len("Tool output: ") :].strip()
            if not raw:
                return None
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                try:
                    return ast.literal_eval(raw)
                except (ValueError, SyntaxError):
                    return None

        return None

    def _get_time_series_key(self, payload: dict) -> Optional[str]:
        for key in payload.keys():
            if isinstance(key, str) and key.lower().startswith("time series"):
                return key
        return None

    def _extract_interval(self, series_key: str) -> Optional[str]:
        if "(" in series_key and ")" in series_key:
            return series_key.split("(", 1)[1].split(")", 1)[0].strip()
        return None

    def _to_float(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _to_int(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

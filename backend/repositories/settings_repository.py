from typing import Optional

from .db import get_connection


class SettingsRepository:
    _OPENAI_API_KEY = "openai_api_key"
    _ALPHA_VANTAGE_API_KEY = "alpha_vantage_api_key"
    _ALPHA_VANTAGE_KEY_TYPE = "alpha_vantage_key_type"
    _USER_MEMORY = "user_memory"
    _PREFERRED_CHART_TYPE = "preferred_chart_type"
    _DEFAULT_TIME_SERIES = "default_time_series"
    _DEFAULT_TECHNICAL_INDICATOR = "default_technical_indicator"
    _RESPONSE_VERBOSITY = "response_verbosity"

    def get_openai_api_key(self) -> Optional[str]:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT setting_value
                FROM settings
                WHERE setting_key = ?
                """,
                (self._OPENAI_API_KEY,),
            )
            row = cursor.fetchone()
        return row[0] if row else None

    def set_openai_api_key(self, api_key: str) -> None:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (self._OPENAI_API_KEY, api_key),
            )
            conn.commit()

    def clear_openai_api_key(self) -> None:
        with get_connection() as conn:
            conn.execute(
                """
                DELETE FROM settings
                WHERE setting_key = ?
                """,
                (self._OPENAI_API_KEY,),
            )
            conn.commit()

    def get_alpha_vantage_api_key(self) -> Optional[str]:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT setting_value
                FROM settings
                WHERE setting_key = ?
                """,
                (self._ALPHA_VANTAGE_API_KEY,),
            )
            row = cursor.fetchone()
        return row[0] if row else None

    def set_alpha_vantage_api_key(self, api_key: str) -> None:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (self._ALPHA_VANTAGE_API_KEY, api_key),
            )
            conn.commit()

    def clear_alpha_vantage_api_key(self) -> None:
        with get_connection() as conn:
            conn.execute(
                """
                DELETE FROM settings
                WHERE setting_key = ?
                """,
                (self._ALPHA_VANTAGE_API_KEY,),
            )
            conn.commit()

    def get_alpha_vantage_key_type(self) -> str:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT setting_value
                FROM settings
                WHERE setting_key = ?
                """,
                (self._ALPHA_VANTAGE_KEY_TYPE,),
            )
            row = cursor.fetchone()
        return row[0] if row and row[0] == "premium" else "free"

    def set_alpha_vantage_key_type(self, key_type: str) -> None:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (self._ALPHA_VANTAGE_KEY_TYPE, key_type),
            )
            conn.commit()

    def get_user_memory(self) -> Optional[str]:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT setting_value
                FROM settings
                WHERE setting_key = ?
                """,
                (self._USER_MEMORY,),
            )
            row = cursor.fetchone()
        return row[0] if row else None

    def set_user_memory(self, content: str) -> None:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (self._USER_MEMORY, content),
            )
            conn.commit()

    def get_preferred_chart_type(self) -> str:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT setting_value
                FROM settings
                WHERE setting_key = ?
                """,
                (self._PREFERRED_CHART_TYPE,),
            )
            row = cursor.fetchone()
        return row[0] if row and row[0] in ("simple", "candlestick") else "simple"

    def set_preferred_chart_type(self, chart_type: str) -> None:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (self._PREFERRED_CHART_TYPE, chart_type),
            )
            conn.commit()

    def get_default_time_series(self) -> str:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT setting_value
                FROM settings
                WHERE setting_key = ?
                """,
                (self._DEFAULT_TIME_SERIES,),
            )
            row = cursor.fetchone()
        return row[0] if row and row[0] in ("daily", "weekly", "monthly") else "daily"

    def set_default_time_series(self, time_series: str) -> None:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (self._DEFAULT_TIME_SERIES, time_series),
            )
            conn.commit()

    def get_default_technical_indicator(self) -> str:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT setting_value
                FROM settings
                WHERE setting_key = ?
                """,
                (self._DEFAULT_TECHNICAL_INDICATOR,),
            )
            row = cursor.fetchone()
        valid = ("none", "sma:20", "sma:50", "ema:20", "ema:50", "wma:20", "wma:50")
        return row[0] if row and row[0] in valid else "none"

    def set_default_technical_indicator(self, indicator: str) -> None:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (self._DEFAULT_TECHNICAL_INDICATOR, indicator),
            )
            conn.commit()

    def get_response_verbosity(self) -> str:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT setting_value
                FROM settings
                WHERE setting_key = ?
                """,
                (self._RESPONSE_VERBOSITY,),
            )
            row = cursor.fetchone()
        return row[0] if row and row[0] in ("brief", "standard", "detailed") else "standard"

    def set_response_verbosity(self, verbosity: str) -> None:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(setting_key) DO UPDATE SET
                    setting_value = excluded.setting_value,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (self._RESPONSE_VERBOSITY, verbosity),
            )
            conn.commit()

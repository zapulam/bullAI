from typing import Optional

from .db import get_connection


class SettingsRepository:
    _OPENAI_API_KEY = "openai_api_key"
    _ALPHA_VANTAGE_API_KEY = "alpha_vantage_api_key"
    _USER_MEMORY = "user_memory"

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

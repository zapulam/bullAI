"""
bullAI Internal Chat - chart repository.

CRUD for saved charts.
"""

import json
import uuid

from typing import Any, Dict, List, Optional

from .db import get_connection

MAX_SAVED_CHARTS = 20

CHART_LIMIT_MESSAGE = (
    "Maximum of 20 saved charts reached. Delete a chart on the Charts page before saving another."
)


class ChartLimitExceeded(Exception):
    """Raised when the charts table already has MAX_SAVED_CHARTS rows."""


class ChartRepository:
    """Repository for saved chart persistence."""

    def save_chart(
        self,
        title: str,
        visualization_data: dict,
        call_data: dict,
    ) -> dict:
        """
        Save a chart to the database.

        Args:
            title: Chart display title.
            visualization_data: JSON-serializable dict (chartData, screens, meta).
            call_data: JSON-serializable dict (func, ticker, screens, time_periods).

        Returns:
            Saved chart dict with id, title, visualization_data, call_data, created_at.
        """
        chart_id = str(uuid.uuid4())
        viz_json = json.dumps(visualization_data)
        call_json = json.dumps(call_data)

        with get_connection() as conn:
            count_row = conn.execute("SELECT COUNT(*) FROM charts").fetchone()
            count = int(count_row[0]) if count_row else 0
            if count >= MAX_SAVED_CHARTS:
                raise ChartLimitExceeded(CHART_LIMIT_MESSAGE)
            conn.execute(
                """
                INSERT INTO charts (id, title, visualization_data, call_data)
                VALUES (?, ?, ?, ?)
                """,
                (chart_id, title, viz_json, call_json),
            )
            conn.commit()

        return {
            "id": chart_id,
            "title": title,
            "visualization_data": visualization_data,
            "call_data": call_data,
            "created_at": None,
        }

    def list_charts(self) -> List[Dict[str, Any]]:
        """
        List all saved charts, newest first.

        Returns:
            List of chart dicts with id, title, visualization_data, call_data, created_at.
        """
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT id, title, visualization_data, call_data, created_at
                FROM charts
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (MAX_SAVED_CHARTS,),
            )
            rows = cursor.fetchall()
        charts = []
        for row in rows:
            try:
                viz = json.loads(row[2]) if row[2] else {}
                call = json.loads(row[3]) if row[3] else {}
            except json.JSONDecodeError:
                viz = {}
                call = {}
            charts.append({
                "id": row[0],
                "title": row[1],
                "visualization_data": viz,
                "call_data": call,
                "created_at": row[4],
            })
        return charts

    def update_chart(self, chart_id: str, visualization_data: dict) -> Optional[Dict[str, Any]]:
        """
        Update a chart's visualization_data.

        Args:
            chart_id: Chart identifier.
            visualization_data: New visualization dict (chartData, chartType, screens, meta).

        Returns:
            Updated chart dict or None if not found.
        """
        viz_json = json.dumps(visualization_data)
        with get_connection() as conn:
            cursor = conn.execute(
                """
                UPDATE charts
                SET visualization_data = ?
                WHERE id = ?
                """,
                (viz_json, chart_id),
            )
            conn.commit()
            if cursor.rowcount == 0:
                return None
        return self.get_chart(chart_id)

    def get_chart(self, chart_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a chart by id.

        Returns:
            Chart dict or None if not found.
        """
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT id, title, visualization_data, call_data, created_at
                FROM charts
                WHERE id = ?
                """,
                (chart_id,),
            )
            row = cursor.fetchone()
        if not row:
            return None
        try:
            viz = json.loads(row[2]) if row[2] else {}
            call = json.loads(row[3]) if row[3] else {}
        except json.JSONDecodeError:
            viz = {}
            call = {}
        return {
            "id": row[0],
            "title": row[1],
            "visualization_data": viz,
            "call_data": call,
            "created_at": row[4],
        }

    def delete_chart(self, chart_id: str) -> bool:
        """
        Delete a chart by id.

        Returns:
            True if deleted, False if not found.
        """
        with get_connection() as conn:
            cursor = conn.execute("DELETE FROM charts WHERE id = ?", (chart_id,))
            conn.commit()
            return cursor.rowcount > 0

"""
bullAI Internal Chat - visualization builder.

Builds chart-ready visualization from tool output when viz=true.
"""

from typing import Any, Dict, List, Optional


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _normalize_timeseries_point(timestamp: str, values: dict) -> dict:
    """Convert Alpha Vantage OHLCV format to normalized point."""
    return {
        "timestamp": timestamp,
        "open": _to_float(values.get("1. open")),
        "high": _to_float(values.get("2. high")),
        "low": _to_float(values.get("3. low")),
        "close": _to_float(values.get("4. close")),
        "volume": _to_int(values.get("5. volume")),
    }


def _screen_to_dict(screen: dict) -> dict:
    """Normalize screen data: title (capitalized) and list of (date, value) tuples."""
    title = screen.get("title", "")
    if isinstance(title, str):
        title = title.upper() if len(title) <= 4 else title.capitalize()
    data = screen.get("data", [])
    if isinstance(data, list):
        return {"title": title, "data": data}
    return {"title": title, "data": []}


def _merge_screens_into_chart_data(
    chart_points: List[dict],
    screen_data: List[dict],
) -> List[dict]:
    """Merge screen values into chart points by timestamp."""
    if not chart_points or not screen_data:
        return chart_points

    points_by_ts = {p["timestamp"]: dict(p) for p in chart_points}

    for screen in screen_data:
        title = screen.get("title", "")
        if not title:
            continue
        data = screen.get("data", [])
        for item in data:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                ts, val = item[0], item[1]
            elif isinstance(item, dict) and "date" in item and "value" in item:
                ts, val = item["date"], item["value"]
            else:
                continue
            ts_str = str(ts)
            if ts_str in points_by_ts:
                points_by_ts[ts_str][title] = _to_float(val)

    return sorted(points_by_ts.values(), key=lambda p: p["timestamp"])


def build_visualization(tool_output: dict) -> Optional[dict]:
    """
    Build a chart-ready visualization from tool output when viz=true.

    Args:
        tool_output: Dict from time_series_* tools with viz, timeseries_data,
            screen_data, call, metadata.

    Returns:
        Visualization dict with title, chartData, screens, meta, call, or None.
    """
    if not isinstance(tool_output, dict):
        return None

    if not tool_output.get("viz"):
        return None

    ts_data = tool_output.get("timeseries_data") or tool_output.get("data")
    if not ts_data or not isinstance(ts_data, dict):
        return None

    call = tool_output.get("call") or {}
    meta = tool_output.get("metadata") or {}
    screen_data_raw = tool_output.get("screen_data") or []

    chart_points = []
    for timestamp, values in ts_data.items():
        if isinstance(values, dict):
            point = _normalize_timeseries_point(timestamp, values)
            chart_points.append(point)

    chart_points.sort(key=lambda p: p["timestamp"])

    screens = [_screen_to_dict(s) for s in screen_data_raw if isinstance(s, dict)]
    chart_points = _merge_screens_into_chart_data(chart_points, screens)

    func_name = call.get("func", "time_series")
    func_label = func_name.replace("_", " ").title()
    screen_titles = [s.get("title", "") for s in screens if s.get("title")]
    if screen_titles:
        title = f"{func_label} ({', '.join(screen_titles)})"
    else:
        title = func_label

    meta_normalized = {}
    if isinstance(meta, dict):
        meta_normalized = {
            "symbol": meta.get("2. Symbol"),
            "interval": meta.get("4. Interval"),
            "lastRefreshed": meta.get("3. Last Refreshed"),
            "timeZone": meta.get("6. Time Zone"),
            "outputSize": meta.get("5. Output Size"),
        }

    chart_type = call.get("chart_type", "simple")
    if chart_type not in ("simple", "candlestick"):
        chart_type = "simple"

    return {
        "title": title,
        "chartData": chart_points,
        "chartType": chart_type,
        "screens": screens,
        "meta": meta_normalized,
        "call": call,
    }

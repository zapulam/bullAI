"""
Shared utilities: Alpha Vantage HTTP helpers and Google Finance HTML parsing.

Written by: zapulam
"""

import json
import re
import requests
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus, urlencode

import httpx
from bs4 import BeautifulSoup

BASE = "https://www.alphavantage.co/query?"


class RateLimitExceededError(Exception):
    """Base exception for API client errors."""
    pass


def build_url(params: dict) -> str:
    """
    Build Alpha Vantage URL from params dict, filtering None and empty values.

    Args:
        params (dict): API params.

    Returns:
        str: Formatted URL. 
    """
    params = {k: v for k, v in params.items() if v not in (None, "")}
    return BASE + urlencode(params)


async def get_data(
        url: str
    ) -> dict[str, Any]:
    """
    Get data from Alpha Vantage.

    Args:
        url (str): Alpha Vantage URL.

    Returns:
        dict: Alpha Vantage API data.
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


_GF_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
_HREF_QUOTE_RE = re.compile(r"/(?:finance/)?quote/([A-Z0-9.\-]+):([A-Z0-9]+)\b", re.I)
_TITLE_RE = re.compile(
    r"^(.+?)\s+\(([A-Z0-9.\-]+)\)\s+Stock\s+Price",
    re.I,
)


def parse_google_finance_html(
    html: str,
    query: str,
    max_results: int = 10,
) -> dict[str, Any]:
    """
    Parse Google Finance search HTML: quote links plus optional title resolution.
    Not a stable API; for tests use saved HTML fixtures.
    """
    q = (query or "").strip()
    if not q:
        return {"results": []}
    cap = max(1, min(max_results, 25))
    soup = BeautifulSoup(html or "", "html.parser")

    rows: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for a in soup.find_all("a", href=True):
        m = _HREF_QUOTE_RE.search(a["href"] or "")
        if not m:
            continue
        t, ex = m.group(1).upper(), m.group(2).upper()
        key = (t, ex)
        if key in seen:
            continue
        seen.add(key)
        name = a.get_text(separator=" ", strip=True) or t
        rows.append(
            {
                "ticker": t,
                "exchange": ex,
                "name": name,
                "url": f"https://www.google.com/finance/quote/{t}:{ex}",
            }
        )

    title_el = soup.find("title")
    title_text = title_el.get_text(strip=True) if title_el else ""
    tm = _TITLE_RE.match(title_text.strip()) if title_text else None

    out: list[dict[str, str]] = []
    used: set[tuple[str, str]] = set()
    skip_ticker: str | None = None

    if tm:
        name_t = tm.group(1).strip()
        sym = tm.group(2).upper()
        for r in rows:
            if r["ticker"] == sym:
                out.append(
                    {
                        "ticker": sym,
                        "exchange": r["exchange"],
                        "name": name_t,
                        "url": r["url"],
                    }
                )
                used.add((sym, r["exchange"]))
                break
        else:
            out.append(
                {
                    "ticker": sym,
                    "exchange": "",
                    "name": name_t,
                    "url": f"https://www.google.com/finance?q={quote_plus(sym)}",
                }
            )
            skip_ticker = sym

    ql, qu = q.lower(), q.upper()
    rest = [
        r
        for r in rows
        if (r["ticker"], r["exchange"]) not in used
        and (skip_ticker is None or r["ticker"] != skip_ticker)
    ]
    preferred = [r for r in rest if r["ticker"] == qu or ql in r["name"].lower()]
    ordered = preferred if preferred else rest

    for r in ordered:
        if len(out) >= cap:
            break
        k = (r["ticker"], r["exchange"])
        if k in used:
            continue
        out.append(dict(r))
        used.add(k)

    return {"results": out[:cap]}


async def fetch_google_finance_search(
    query: str,
    max_results: int = 10,
) -> dict[str, Any]:
    """
    Fetch google.com/finance?q=... and parse instruments. Not for trading.
    """
    q = (query or "").strip()
    beta = f"https://www.google.com/finance/beta?q={quote_plus(q)}&hl=en"
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    note = "Parsed from google.com/finance HTML; beta_search_url is for human review only."

    base: dict[str, Any] = {
        "beta_search_url": beta,
        "retrieved_at": now,
        "source_note": note,
    }

    if not q:
        return {
            **base,
            "error": "query is required",
            "query": "",
            "results": [],
        }

    url = f"https://www.google.com/finance?q={quote_plus(q)}&hl=en"
    headers = {"User-Agent": _GF_UA, "Accept-Language": "en-US,en;q=0.9"}

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
    except httpx.TimeoutException:
        return {**base, "error": "Google Finance request timed out.", "query": q, "results": []}
    except httpx.RequestError as exc:
        return {**base, "error": f"Google Finance request failed: {exc}", "query": q, "results": []}

    if resp.status_code != 200:
        return {
            **base,
            "error": f"Google Finance returned HTTP {resp.status_code}.",
            "query": q,
            "results": [],
        }

    text = resp.text or ""
    if not text.strip():
        return {**base, "error": "Empty response from Google Finance.", "query": q, "results": []}

    parsed = parse_google_finance_html(text, q, max_results=max_results)
    results = parsed.get("results", [])
    out = {**base, "query": q, "results": results}
    if not results:
        out["error"] = "No instruments parsed (ambiguous query or page layout changed)."
    return out

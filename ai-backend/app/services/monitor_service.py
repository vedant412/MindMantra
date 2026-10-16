"""
monitor_service.py
------------------
Lightweight structured performance monitor.
Logs response source, latency, and cache hit rate to stdout.

No external dependencies — uses Python logging only.
"""

import logging
import time
from typing import Dict, Literal

logger = logging.getLogger("vani.monitor")

# In-memory counters (resets on server restart — fine for dev)
_counters: Dict[str, int] = {"cache_hit": 0, "template_hit": 0, "llm_call": 0, "fallback": 0}
_total_ms: Dict[str, float] = {"cache_hit": 0.0, "template_hit": 0.0, "llm_call": 0.0, "fallback": 0.0}

SourceType = Literal["cache_hit", "template_hit", "llm_call", "fallback"]


def log_request_timing(source: SourceType, elapsed_ms: float, user_id: str = "unknown") -> None:
    """
    Log a single request event with source and timing.

    Args:
        source: One of 'cache_hit', 'template_hit', 'llm_call', 'fallback'
        elapsed_ms: Total response time in milliseconds
        user_id: For traceability (not stored, just logged)
    """
    _counters[source] = _counters.get(source, 0) + 1
    _total_ms[source] = _total_ms.get(source, 0.0) + elapsed_ms

    emoji_map = {
        "cache_hit": "⚡",
        "template_hit": "🚀",
        "llm_call": "🧠",
        "fallback": "⚠️",
    }
    emoji = emoji_map.get(source, "📊")

    logger.info(
        f"[PERF] {emoji} [{source.upper()}] | {elapsed_ms:.1f}ms | user={user_id}"
    )


def get_stats_summary() -> dict:
    """Returns aggregated performance stats."""
    stats: Dict[str, object] = {}
    for source in ["cache_hit", "template_hit", "llm_call", "fallback"]:
        count = _counters.get(source, 0)
        total = _total_ms.get(source, 0.0)
        avg_ms = (total / count) if count > 0 else 0.0
        stats[source] = {
            "count": count,
            "avg_ms": round(avg_ms, 1),
        }

    total_requests = sum(_counters.values())
    cache_hits = _counters.get("cache_hit", 0) + _counters.get("template_hit", 0)
    hit_rate = f"{(cache_hits / total_requests * 100):.1f}%" if total_requests > 0 else "0%"
    stats["cache_hit_rate"] = hit_rate
    stats["total_requests"] = total_requests
    return stats


class RequestTimer:
    """
    Context manager for timing a block of code.

    Usage:
        with RequestTimer() as t:
            ... do work ...
        elapsed = t.elapsed_ms
    """
    def __init__(self) -> None:
        self.elapsed_ms: float = 0.0
        self._start: float = 0.0

    def __enter__(self) -> "RequestTimer":
        self._start = time.perf_counter()
        return self

    def __exit__(self, *args: object) -> None:
        self.elapsed_ms = (time.perf_counter() - self._start) * 1000

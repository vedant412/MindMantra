import hashlib
import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

_redis_client = None
_redis_available = False

def _get_redis():
    """Lazy-init Redis client. Returns None if Redis is unavailable."""
    global _redis_client, _redis_available
    if _redis_client is not None:
        return _redis_client if _redis_available else None
    try:
        from redis import Redis, ConnectionError as RedisConnectionError
        client = Redis(host="localhost", port=6379, db=0, socket_connect_timeout=1)
        client.ping()
        _redis_client = client
        _redis_available = True
        logger.info("[CACHE] ✅ Redis connected successfully")
    except Exception as e:
        _redis_client = None
        _redis_available = False
        logger.warning(f"[CACHE] ⚠️ Redis unavailable — caching disabled. ({e})")
    return _redis_client if _redis_available else None


def build_cache_key(user_text: str, language: str, intent: Optional[str] = None) -> str:
    """
    Deterministic SHA-256 cache key from normalized text + language + intent.
    Lowercased & stripped so 'I'm stressed' == 'i'm stressed'.
    """
    normalized = user_text.lower().strip()
    raw = f"{normalized}|{language}|{intent or ''}"
    return "vani:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _is_cacheable(user_text: str) -> bool:
    """
    Only cache short, non-personal queries.
    Skips caching if input is personal (contains I/my/me patterns or is long).
    """
    text = user_text.strip()
    if len(text) > 150:
        return False
    personal_words = {"i'm", "im", "my", "mine", "i feel", "i am", "i was", "i have", "i've"}
    lowered = text.lower()
    for word in personal_words:
        if word in lowered:
            return False
    return True


def get_cached_response(cache_key: str) -> Optional[Dict[str, Any]]:
    """Returns cached response dict, or None if miss/unavailable."""
    client = _get_redis()
    if client is None:
        return None
    try:
        raw = client.get(cache_key)
        if raw:
            return json.loads(raw)
    except Exception as e:
        logger.warning(f"[CACHE] Read error: {e}")
    return None


def set_cached_response(
    cache_key: str,
    response_dict: Dict[str, Any],
    user_text: str,
    ttl: int = 3600
) -> bool:
    """Stores response in Redis with TTL. Returns True on success."""
    if not _is_cacheable(user_text):
        return False
    client = _get_redis()
    if client is None:
        return False
    try:
        client.setex(cache_key, ttl, json.dumps(response_dict, ensure_ascii=False))
        return True
    except Exception as e:
        logger.warning(f"[CACHE] Write error: {e}")
        return False


def invalidate_user_cache(user_id: str) -> int:
    """Optionally clear all keys for a user (future use). Returns count deleted."""
    client = _get_redis()
    if client is None:
        return 0
    try:
        pattern = f"vani:*"
        keys = client.keys(pattern)
        if keys:
            return client.delete(*keys)
    except Exception as e:
        logger.warning(f"[CACHE] Invalidation error: {e}")
    return 0

"""Login rate limiting and revoked-token tracking, backed by Redis instead of MySQL tables —
both are short-lived, TTL'd data with no need to survive in the relational schema."""
import time
from datetime import timedelta

from .db import redis_client

RATE_LIMIT_WINDOW = timedelta(seconds=300)


def count_attempt(key: str) -> int:
    """Atomically bump a fixed-window counter (an IP, or "acct:<hash>" for one account) and return
    the new count. The window resets on its own once the key's TTL expires."""
    pipe = redis_client.pipeline()
    pipe.incr(f"login_attempts:{key}")
    pipe.expire(f"login_attempts:{key}", int(RATE_LIMIT_WINDOW.total_seconds()), nx=True)
    count, _ = pipe.execute()
    return count


def revoke_token(jti: str, expires_at: int) -> None:
    """expires_at is the token's exp claim (unix seconds); the Redis key outlives it by a few
    seconds and then disappears on its own — no housekeeping needed."""
    ttl = max(expires_at - int(time.time()), 1)
    redis_client.setex(f"revoked_tokens:{jti}", ttl, "1")


def is_revoked(jti: str) -> bool:
    return redis_client.exists(f"revoked_tokens:{jti}") == 1

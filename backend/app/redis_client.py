"""Redis connection helper.

Not used anywhere yet — this just establishes the connection pattern for
Phase C (login rate-limiting, optional JWT revocation). See CONTEXT.md
Status for why Redis's scope here is intentionally kept small.
"""

import os

import redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

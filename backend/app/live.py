"""Server-Sent Events: tell open screens that data changed so they re-fetch right away.

Messages carry no data, only what kind of thing changed (and for which event) plus a version number;
screens then reload through the normal API. In-memory, so it assumes one backend process.
"""
import asyncio
import json

_loop: asyncio.AbstractEventLoop | None = None
_queues: set[asyncio.Queue] = set()
_version = 0

STREAM_LIFETIME = 25  # seconds; the browser reconnects at once, so shutdown/reload never waits long


def bind_loop() -> None:
    global _loop
    _loop = asyncio.get_running_loop()


def notify(kind: str, event_id: str | None = None) -> None:
    """Call after a commit. Safe from the sync endpoints' worker threads."""
    global _version
    if _loop is None:
        return
    _version += 1
    msg = json.dumps({"version": _version, "kind": kind, "event_id": event_id})
    for q in list(_queues):
        _loop.call_soon_threadsafe(q.put_nowait, msg)


async def stream():
    q: asyncio.Queue = asyncio.Queue()
    _queues.add(q)
    try:
        yield "retry: 1000\n\n"
        yield f"data: {json.dumps({'version': _version})}\n\n"  # lets a reconnecting screen spot missed changes
        loop = asyncio.get_running_loop()
        deadline = loop.time() + STREAM_LIFETIME
        while (left := deadline - loop.time()) > 0:
            try:
                msg = await asyncio.wait_for(q.get(), timeout=left)
            except asyncio.TimeoutError:
                break
            yield f"data: {msg}\n\n"
    finally:
        _queues.discard(q)

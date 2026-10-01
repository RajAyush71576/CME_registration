"""Local-disk signature storage.

Stand-in for the Cloudinary/S3-compatible storage named in CONTEXT.md's tech
stack — no cloud credentials are configured for local dev yet. Swap this
module's implementation for a cloud upload later; callers only depend on
save_signature() returning an opaque reference string.
"""

import base64
from pathlib import Path

SIGNATURES_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "signatures"


def save_signature(attendance_id: str, stage: str, data_url: str) -> str:
    """Decode a `data:image/png;base64,...` string and store it. Returns a
    reference path relative to the data directory."""
    SIGNATURES_DIR.mkdir(parents=True, exist_ok=True)
    _, _, encoded = data_url.partition(",")
    raw = base64.b64decode(encoded)
    filename = f"{attendance_id}_{stage}.png"
    (SIGNATURES_DIR / filename).write_bytes(raw)
    return f"signatures/{filename}"

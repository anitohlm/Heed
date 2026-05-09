"""
HMAC-signed tokens for X-User-ID requests.

Each user's token = HMAC-SHA256(HEED_AUTH_SECRET, username) base64-encoded.
Tokens are deterministic per (secret, username) — issued at registration,
stored client-side in localStorage, sent back via the X-Auth-Token header.

Enforcement is feature-flagged via HEED_AUTH_REQUIRED:
  - unset / "0"  → tokens issued but not required (backwards-compat)
  - "1"          → all requests for non-demo users must present a valid token

The "demo" user always bypasses verification so the demo mode stays open.

This is interim. The real fix is Entra ID / MSAL — multi-day rewrite.
"""

import os
import hmac
import hashlib
import base64


def _secret() -> bytes | None:
    raw = os.environ.get("HEED_AUTH_SECRET")
    return raw.encode("utf-8") if raw else None


def is_required() -> bool:
    return os.environ.get("HEED_AUTH_REQUIRED", "0") == "1"


def issue_token(username: str) -> str | None:
    """Compute the HMAC token for a username. Returns None if no secret set."""
    secret = _secret()
    if not secret or not username:
        return None
    digest = hmac.new(secret, username.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def verify(username: str, token: str | None) -> bool:
    """
    Constant-time check that token matches the expected HMAC for username.
    Returns True if no secret is configured (bypass for local/demo).
    """
    if not _secret():
        return True
    if not username or not token:
        return False
    expected = issue_token(username)
    if not expected:
        return False
    return hmac.compare_digest(expected, token)

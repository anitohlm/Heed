"""
Azure AI Content Safety prompt shield.

Feature-flagged: if CONTENT_SAFETY_ENDPOINT and CONTENT_SAFETY_KEY are not set,
shield_user_input() returns allow=True so the app keeps working in demo /
local-dev environments without the resource provisioned.

When wired to a real resource, calls the /text:shieldPrompt endpoint and
returns allow=False if any attack category is detected.

See SAFETY.md Risk 1 mitigation: input sanitization at the edge.
"""

import os
import logging
import requests


_ENDPOINT_KEY = "CONTENT_SAFETY_ENDPOINT"
_API_KEY = "CONTENT_SAFETY_KEY"
_API_VERSION = "2024-09-01"
_TIMEOUT = (3.05, 5.0)


def _is_configured() -> bool:
    return bool(os.environ.get(_ENDPOINT_KEY) and os.environ.get(_API_KEY))


def shield_user_input(message: str) -> dict:
    """
    Run Content Safety prompt shield on a user message.

    Returns:
      {"allow": True} when safe or shield not configured.
      {"allow": False, "reason": "..."} when the shield flags the input.

    Never raises — failures fall open with allow=True and a logged warning.
    A future tightening could fail-closed in production.
    """
    if not message or not message.strip():
        return {"allow": True}

    if not _is_configured():
        return {"allow": True}

    endpoint = os.environ[_ENDPOINT_KEY].rstrip("/")
    key = os.environ[_API_KEY]
    url = f"{endpoint}/contentsafety/text:shieldPrompt?api-version={_API_VERSION}"
    body = {"userPrompt": message[:10000], "documents": []}

    try:
        resp = requests.post(
            url,
            headers={
                "Ocp-Apim-Subscription-Key": key,
                "Content-Type": "application/json",
            },
            json=body,
            timeout=_TIMEOUT,
        )
    except (requests.ConnectionError, requests.Timeout) as e:
        logging.warning(f"Content Safety unreachable, failing open: {e}")
        return {"allow": True}

    if resp.status_code != 200:
        logging.warning(
            f"Content Safety returned {resp.status_code}, failing open: {resp.text[:200]}"
        )
        return {"allow": True}

    data = resp.json()
    detected = data.get("userPromptAnalysis", {}).get("attackDetected", False)
    if detected:
        return {"allow": False, "reason": "prompt_shield_detected_attack"}
    return {"allow": True}

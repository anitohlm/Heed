"""
HTTP-triggered Function that streams Advisor agent output to the Next.js frontend.

This is the bridge between the Next.js /api/agent/stream route handler and
the agent code. The route handler proxies requests here; this function calls
the agent and streams events back as Server-Sent Events.

Environment variables (all from Key Vault via Managed Identity):
  AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY
  COSMOS_CONNECTION_STRING, COSMOS_DATABASE
  AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_KEY
  BING_KEY
  OPENAI_DEPLOYMENT_ADVISOR, OPENAI_DEPLOYMENT_KEEPER, OPENAI_DEPLOYMENT_EMBED
"""

import json
import logging
import asyncio
import azure.functions as func
from agents.advisor import stream_response


async def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST /api/advisor_stream
    Body: {"user_id": "...", "message": "...", "history": [...]}
    Response: text/event-stream with events from stream_response()
    """
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body"}),
            status_code=400,
            mimetype="application/json",
        )

    user_id = body.get("user_id")
    message = body.get("message")
    history = body.get("history", [])

    if not user_id or not message:
        return func.HttpResponse(
            json.dumps({"error": "user_id and message required"}),
            status_code=400,
            mimetype="application/json",
        )

    # Defense in depth: bound message length BEFORE the model sees it.
    # See SAFETY.md Risk 1 — large pasted content is a common injection vector.
    if len(message) > 4000:
        return func.HttpResponse(
            json.dumps({"error": "Message too long (max 4000 chars)"}),
            status_code=413,
            mimetype="application/json",
        )

    # TODO: run Azure AI Content Safety prompt shield on `message` here,
    # before reaching the agent. If flagged, return a generic refusal without
    # invoking the agent at all.
    # See SAFETY.md Risk 1 mitigation: input sanitization.

    async def event_stream():
        """Yield SSE-formatted events as the agent produces them."""
        try:
            async for event in stream_response(user_id, message, history):
                # SSE format: "data: <json>\n\n"
                yield f"data: {json.dumps(event)}\n\n".encode("utf-8")
        except Exception as e:
            logging.exception("Agent stream failed")
            error_event = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n".encode("utf-8")
        finally:
            # Tell the client we're done so it can close the connection
            yield b"data: {\"type\": \"close\"}\n\n"

    # TODO: confirm Azure Functions Python streaming response API. As of recent
    # versions there's `func.HttpResponse` with a generator body. Verify the
    # exact signature on your Functions runtime version — this is the single
    # most likely place for a deployment-time surprise.
    #
    # Alternative if streaming HttpResponse isn't available: use Durable
    # Functions with a polling pattern, or front the Function with API
    # Management to handle the SSE adapter.

    raise NotImplementedError(
        "Stub — wire up streaming HttpResponse here. "
        "See TODO above for the two known-working patterns."
    )

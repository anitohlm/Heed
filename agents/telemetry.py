"""
Application Insights wiring.

Feature-flagged: when APPLICATIONINSIGHTS_CONNECTION_STRING is set, the Azure
Monitor OpenTelemetry distro auto-instruments logging, outbound HTTP, and
Cosmos calls. When unset, init() is a no-op so the app boots fine without an
App Insights resource provisioned (demo / local-dev path).

Call init() exactly once at module import time from function_app.py.
"""

import os
import logging

_INITIALIZED = False


def init() -> bool:
    """Configure Azure Monitor if the connection string is present.

    Returns True if instrumentation was wired up, False if skipped.
    Safe to call multiple times; only the first call has effect.
    """
    global _INITIALIZED
    if _INITIALIZED:
        return True
    conn = os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING")
    if not conn:
        return False
    try:
        from azure.monitor.opentelemetry import configure_azure_monitor
        configure_azure_monitor(
            connection_string=conn,
            logger_name="heed",
        )
        _INITIALIZED = True
        logging.getLogger("heed").info("Application Insights instrumentation enabled")
        return True
    except Exception as e:
        # Never let telemetry boot-time errors break the Function host.
        logging.warning(f"Application Insights init failed, continuing without: {e}")
        return False

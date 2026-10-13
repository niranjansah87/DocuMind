import contextvars
import json
import logging
import re
import sys
from datetime import UTC, datetime
from typing import Any

# Global context variable for request tracing
request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

# Patterns for sensitive data redaction
REDACTION_PATTERNS = [
    (re.compile(r"sk-[a-zA-Z0-9_\-]{20,}", re.IGNORECASE), "sk-***[REDACTED]***"),
    (re.compile(r"(Bearer\s+)[a-zA-Z0-9_\-\.]{15,}", re.IGNORECASE), r"\1***[REDACTED]***"),
    (
        re.compile(r"(password[:=]\s*['\"]?)[^'\"\s&]+(['\"]?)", re.IGNORECASE),
        r"\1***[REDACTED]***\2",
    ),
    (
        re.compile(r"(postgresql(?:\+asyncpg)?://[^:]+:)[^@]+(@)", re.IGNORECASE),
        r"\1***[REDACTED]***\2",
    ),
    (
        re.compile(r"(api[_-]?key[:=]\s*['\"]?)[a-zA-Z0-9_\-]{16,}(['\"]?)", re.IGNORECASE),
        r"\1***[REDACTED]***\2",
    ),
]


def redact_sensitive(text: str) -> str:
    """Sanitize sensitive patterns from strings before logging."""
    for pattern, replacement in REDACTION_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class SensitiveDataFilter(logging.Filter):
    """Log filter that scrubs credentials, tokens, and passwords from log messages."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact_sensitive(record.msg)
        if record.args:
            if isinstance(record.args, tuple):
                record.args = tuple(
                    redact_sensitive(str(arg)) if isinstance(arg, str) else arg
                    for arg in record.args
                )
            elif isinstance(record.args, dict):
                record.args = {
                    k: redact_sensitive(str(v)) if isinstance(v, str) else v
                    for k, v in record.args.items()
                }
        return True


class RequestIDFilter(logging.Filter):
    """Inject current request ID from contextvars into every LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get("-")
        return True


class JSONLogFormatter(logging.Formatter):
    """Structured JSON formatter for production and cloud log aggregators."""

    def __init__(
        self, service_name: str = "documind-api", environment: str = "development"
    ) -> None:
        super().__init__()
        self.service_name = service_name
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "env": self.environment,
            "request_id": getattr(record, "request_id", "-"),
            "logger": record.name,
            "message": redact_sensitive(record.getMessage()),
        }

        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": redact_sensitive(str(record.exc_info[1])),
            }

        return json.dumps(log_entry, default=str)


def get_logger(name: str) -> logging.Logger:
    """Helper to return a named logger."""
    return logging.getLogger(name)


def configure_logging(
    level: str = "INFO",
    log_format: str = "text",
    environment: str = "development",
) -> None:
    """Centralized logging configuration for DocuMind API.

    - Supports text (human-readable) and JSON (machine-parseable) formatters.
    - Injects request ID tracking and sensitive credential redaction.
    - Suppresses verbose third-party loggers.
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)

    if log_format.lower() == "json" or environment.lower() == "production":
        formatter: logging.Formatter = JSONLogFormatter(
            service_name="documind-api", environment=environment
        )
    else:
        text_format = "%(asctime)s | %(levelname)-7s | [%(request_id)s] %(name)s - %(message)s"
        formatter = logging.Formatter(fmt=text_format, datefmt="%Y-%m-%d %H:%M:%S")

    console_handler.setFormatter(formatter)
    console_handler.addFilter(RequestIDFilter())
    console_handler.addFilter(SensitiveDataFilter())
    root_logger.addHandler(console_handler)

    # Silence noisy low-level third-party loggers
    logging.getLogger("uvicorn.access").handlers = []
    logging.getLogger("uvicorn.access").propagate = False
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

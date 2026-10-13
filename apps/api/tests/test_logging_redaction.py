import logging

from app.core.logging import SensitiveDataFilter, redact_sensitive


def test_redact_openai_key() -> None:
    raw = "Calling OpenAI API with sk-proj-1234567890abcdefghijklmnop and prompt"
    sanitized = redact_sensitive(raw)
    assert "sk-proj-1234567890abcdefghijklmnop" not in sanitized
    assert "sk-***[REDACTED]***" in sanitized


def test_redact_bearer_token() -> None:
    raw = "User requested with header Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    sanitized = redact_sensitive(raw)
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in sanitized
    assert "Bearer ***[REDACTED]***" in sanitized


def test_redact_postgres_connection_password() -> None:
    raw = "Connecting to postgresql+asyncpg://admin:SuperSecretPass123@localhost:5432/documind"
    sanitized = redact_sensitive(raw)
    assert "SuperSecretPass123" not in sanitized
    assert "postgresql+asyncpg://admin:***[REDACTED]***@localhost:5432/documind" in sanitized


def test_sensitive_data_filter_record() -> None:
    log_filter = SensitiveDataFilter()
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="Leaked key: sk-abcdefghijklmnopqrstuvwxyz123456",
        args=(),
        exc_info=None,
    )
    log_filter.filter(record)
    assert "sk-abcdefghijklmnopqrstuvwxyz123456" not in record.msg
    assert "sk-***[REDACTED]***" in record.msg


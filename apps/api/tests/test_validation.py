import pytest

from app.core.errors import AppError
from app.ingestion.validation import validate_upload


def test_accepts_plain_text() -> None:
    result = validate_upload("notes.txt", "text/plain", b"useful text", 100)

    assert result.mime_type == "text/plain"


@pytest.mark.parametrize(
    ("filename", "content_type", "content", "limit", "code"),
    [
        ("notes.md", "text/markdown", b"text", 100, "DOCUMENT_TYPE_UNSUPPORTED"),
        ("fake.pdf", "application/pdf", b"not a pdf", 100, "DOCUMENT_TYPE_INVALID"),
        ("notes.txt", "text/plain", b"", 100, "DOCUMENT_EMPTY"),
        ("notes.txt", "text/plain", b"too long", 4, "DOCUMENT_TOO_LARGE"),
    ],
)
def test_rejects_invalid_uploads(
    filename: str, content_type: str, content: bytes, limit: int, code: str
) -> None:
    with pytest.raises(AppError) as error:
        validate_upload(filename, content_type, content, limit)

    assert error.value.code == code

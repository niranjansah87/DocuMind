from dataclasses import dataclass
from pathlib import Path

from app.core.errors import AppError

PDF_SIGNATURE = b"%PDF-"


@dataclass(frozen=True, slots=True)
class ValidatedUpload:
    filename: str
    mime_type: str
    content: bytes


def validate_upload(filename: str | None, content_type: str | None, content: bytes, limit: int) -> ValidatedUpload:
    if not filename or not content:
        raise AppError("DOCUMENT_EMPTY", "The uploaded file is empty.", 422)
    if len(content) > limit:
        raise AppError("DOCUMENT_TOO_LARGE", "The file exceeds the configured upload limit.", 413)
    extension = Path(filename).suffix.lower()
    if extension not in {".pdf", ".txt"}:
        raise AppError("DOCUMENT_TYPE_UNSUPPORTED", "Only PDF and TXT files are supported.", 415)
    if extension == ".pdf" and not content.startswith(PDF_SIGNATURE):
        raise AppError("DOCUMENT_TYPE_INVALID", "The file is not a valid PDF.", 415)
    if extension == ".txt" and (b"\x00" in content[:4096] or content_type not in {None, "text/plain", "application/octet-stream"}):
        raise AppError("DOCUMENT_TYPE_INVALID", "The file is not valid plain text.", 415)
    return ValidatedUpload(filename=Path(filename).name, mime_type="application/pdf" if extension == ".pdf" else "text/plain", content=content)

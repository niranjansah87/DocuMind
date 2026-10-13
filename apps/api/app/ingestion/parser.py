from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.core.errors import AppError
from app.ingestion.validation import ValidatedUpload


@dataclass(frozen=True, slots=True)
class ParsedDocument:
    text: str
    page_count: int | None
    pages: list[tuple[int, str]] | None = None


def parse_document(upload: ValidatedUpload) -> ParsedDocument:
    pages: list[tuple[int, str]] | None = None
    try:
        if upload.mime_type == "text/plain":
            text = upload.content.decode("utf-8-sig")
            page_count = 1
            pages = [(1, text)]
        else:
            reader = PdfReader(BytesIO(upload.content), strict=True)
            page_count = len(reader.pages)
            pages = []
            for page_index, page in enumerate(reader.pages, 1):
                page_text = (page.extract_text() or "").rstrip()
                pages.append((page_index, page_text))
            text = "\n\n".join(pt for _, pt in pages if pt)
    except (UnicodeDecodeError, ValueError, OSError, PyPdfError) as exc:
        raise AppError(
            "DOCUMENT_UNPARSEABLE", "The document could not be parsed.", 422
        ) from exc
    normalized = "\n".join(
        line.rstrip() for line in text.replace("\r\n", "\n").splitlines()
    ).strip()
    if not normalized:
        raise AppError(
            "DOCUMENT_UNPARSEABLE", "The document contains no extractable text.", 422
        )
    return ParsedDocument(normalized, page_count, pages)

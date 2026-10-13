import tiktoken

from app.ingestion.chunker import chunk_text


def test_empty_input_returns_no_chunks() -> None:
    assert chunk_text("  ", 50, 10) == []


def test_chunks_preserve_order_and_overlap() -> None:
    text = " ".join(f"token-{index}" for index in range(120))
    chunks = chunk_text(text, 50, 10)
    encoding = tiktoken.get_encoding("cl100k_base")

    assert len(chunks) > 1
    assert [chunk.index for chunk in chunks] == list(range(len(chunks)))
    assert all(0 < chunk.token_count <= 50 for chunk in chunks)
    assert encoding.encode(chunks[0].text)[-10:] == encoding.encode(chunks[1].text)[:10]


def test_invalid_overlap_is_rejected() -> None:
    try:
        chunk_text("text", 10, 10)
    except ValueError as error:
        assert "overlap" in str(error).lower()
    else:
        raise AssertionError("invalid overlap was accepted")


def test_chunks_extract_sections_and_pages() -> None:
    sample = (
        "## Introduction\n\nWelcome to the customer support policy.\n\n"
        "## Returns and Refunds\n\nItems may be returned within 30 days.\n"
    )
    pages = [
        (1, "## Introduction\n\nWelcome to the customer support policy."),
        (2, "## Returns and Refunds\n\nItems may be returned within 30 days."),
    ]
    chunks = chunk_text(sample, 100, 20, pages=pages)
    assert len(chunks) >= 1
    assert chunks[0].section_title in ("Introduction", "Returns and Refunds")
    assert chunks[0].page_start is not None

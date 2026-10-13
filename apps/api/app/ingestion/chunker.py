import re
from dataclasses import dataclass

import tiktoken


@dataclass(frozen=True, slots=True)
class TextChunk:
    index: int
    text: str
    token_count: int
    section_title: str | None = None
    page_start: int | None = None
    page_end: int | None = None


def _find_sections(text: str) -> list[tuple[int, str]]:
    sections: list[tuple[int, str]] = []
    pattern = re.compile(
        r"^(?:#{1,6}\s+(.+)|([0-9]+\.[0-9]*\s+.+)|([A-Z][A-Za-z0-9 ,/\u2013\u2014\-]+))\s*$",
        re.MULTILINE,
    )
    for match in pattern.finditer(text):
        title = (match.group(1) or match.group(2) or match.group(3)).strip()
        if len(title) > 3 and not title.endswith(".") and len(title) < 100:
            sections.append((match.start(), title))
    return sections


def chunk_text(
    text: str,
    target_tokens: int,
    overlap_tokens: int,
    pages: list[tuple[int, str]] | None = None,
) -> list[TextChunk]:
    if not text.strip():
        return []
    if target_tokens <= 0 or overlap_tokens < 0 or overlap_tokens >= target_tokens:
        raise ValueError("Chunk size must be positive and overlap smaller than chunk size")
    encoding = tiktoken.get_encoding("cl100k_base")
    tokens = encoding.encode(text)
    step = target_tokens - overlap_tokens
    chunks: list[TextChunk] = []

    sections = _find_sections(text)
    page_offsets: list[tuple[int, int, int]] = []
    if pages:
        current_char = 0
        for page_num, page_str in pages:
            clean_page = page_str.rstrip()
            if not clean_page:
                continue
            pos = text.find(clean_page[:60], current_char)
            if pos == -1:
                pos = current_char
            length = len(clean_page)
            page_offsets.append((pos, pos + length, page_num))
            current_char = pos + length

    last_pos = 0
    for start in range(0, len(tokens), step):
        token_slice = tokens[start : start + target_tokens]
        if not token_slice:
            break
        chunk = encoding.decode(token_slice).strip()
        if chunk:
            found_pos = text.find(chunk[:50], last_pos)
            if found_pos == -1:
                found_pos = text.find(chunk[:30], 0)
            if found_pos != -1:
                last_pos = found_pos

            active_section: str | None = None
            if found_pos != -1 and sections:
                for s_pos, s_title in sections:
                    if s_pos <= found_pos + 10:
                        active_section = s_title
                    else:
                        break

            page_start: int | None = None
            page_end: int | None = None
            if page_offsets and found_pos != -1:
                end_pos = found_pos + len(chunk)
                for p_start, p_end, p_num in page_offsets:
                    if p_start <= found_pos <= p_end or (
                        p_start <= found_pos and page_start is None
                    ):
                        page_start = p_num
                    if p_start <= end_pos <= p_end:
                        page_end = p_num
                if page_start and not page_end:
                    page_end = page_start
                elif page_end and not page_start:
                    page_start = page_end

            chunks.append(
                TextChunk(
                    len(chunks),
                    chunk,
                    len(token_slice),
                    section_title=active_section,
                    page_start=page_start,
                    page_end=page_end,
                )
            )
        if start + target_tokens >= len(tokens):
            break
    return chunks

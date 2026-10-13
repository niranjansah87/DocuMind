from dataclasses import dataclass

import tiktoken


@dataclass(frozen=True, slots=True)
class TextChunk:
    index: int
    text: str
    token_count: int


def chunk_text(text: str, target_tokens: int, overlap_tokens: int) -> list[TextChunk]:
    if not text.strip():
        return []
    if target_tokens <= 0 or overlap_tokens < 0 or overlap_tokens >= target_tokens:
        raise ValueError("Chunk size must be positive and overlap smaller than chunk size")
    encoding = tiktoken.get_encoding("cl100k_base")
    tokens = encoding.encode(text)
    step = target_tokens - overlap_tokens
    chunks: list[TextChunk] = []
    for start in range(0, len(tokens), step):
        token_slice = tokens[start : start + target_tokens]
        if not token_slice:
            break
        chunk = encoding.decode(token_slice).strip()
        if chunk:
            chunks.append(TextChunk(len(chunks), chunk, len(token_slice)))
        if start + target_tokens >= len(tokens):
            break
    return chunks

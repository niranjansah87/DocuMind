import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_overlap_must_be_smaller_than_chunk_size() -> None:
    with pytest.raises(ValidationError, match="CHUNK_OVERLAP_TOKENS"):
        Settings(chunk_size_tokens=100, chunk_overlap_tokens=100)


def test_embedding_dimensions_must_match_schema() -> None:
    with pytest.raises(ValidationError, match="1536"):
        Settings(embedding_dimensions=768)

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[4] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_ENV, ".env.production", ".env"), extra="ignore", case_sensitive=False
    )

    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8888
    database_url: str = (
        "postgresql+asyncpg://documind:documind-local-only@localhost:5432/documind"
    )
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:7777",
        "http://127.0.0.1:7777",
        "https://documind.niranjansah87.com.np",
    ]
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4.1-mini"
    llm_fallback_model: str | None = None
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, ge=1)
    max_query_chars: int = Field(default=4000, ge=1, le=20000)
    chunk_size_tokens: int = Field(default=800, ge=50, le=4000)
    chunk_overlap_tokens: int = Field(default=50, ge=0)
    retrieval_top_k: int = Field(default=5, ge=1, le=20)
    retrieval_similarity_threshold: float = Field(default=0.35, ge=-1, le=1)
    max_output_tokens: int = Field(default=700, ge=1, le=4000)
    max_tool_steps: int = Field(default=4, ge=1, le=10)
    provider_timeout_seconds: float = Field(default=30, gt=0, le=120)
    provider_max_retries: int = Field(default=2, ge=0, le=5)
    request_timeout_seconds: float = Field(default=60, gt=0, le=300)
    ticket_confirmation_ttl_seconds: int = Field(default=600, ge=60, le=3600)
    log_level: str = "INFO"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("llm_fallback_model", mode="before")
    @classmethod
    def empty_fallback_is_none(cls, value: object) -> object:
        return None if value == "" else value

    @model_validator(mode="after")
    def validate_rag_settings(self) -> "Settings":
        if self.chunk_overlap_tokens >= self.chunk_size_tokens:
            raise ValueError(
                "CHUNK_OVERLAP_TOKENS must be smaller than CHUNK_SIZE_TOKENS"
            )
        if self.embedding_dimensions != 1536:
            raise ValueError(
                "EMBEDDING_DIMENSIONS must match the migration's 1536 dimensions"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

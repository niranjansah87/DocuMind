import os
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_file_parents = Path(__file__).resolve().parents
# Inside Docker container /app/app/core/config.py, parents has length 4 (/app/app/core, /app/app, /app, /)
# In host repo root /DocuMind/apps/api/app/core/config.py, parents[4] is repo root
ROOT_DIR = _file_parents[4] if len(_file_parents) > 4 else (_file_parents[2] if len(_file_parents) > 2 else _file_parents[0])
APP_DIR = _file_parents[2] if len(_file_parents) > 2 else ROOT_DIR

_app_env = os.getenv("APP_ENV", "development").lower()
_env_files: list[str] = [
    str(ROOT_DIR / ".env"),
    str(APP_DIR / ".env"),
]
if _app_env == "production":
    _env_files.extend(
        [
            str(ROOT_DIR / ".env.production"),
            str(APP_DIR / ".env.production"),
        ]
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=tuple(_env_files), extra="ignore", case_sensitive=False
    )

    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8888
    database_url: str = "postgresql+asyncpg://documind:documind-local-only@localhost:5432/documind"
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
    log_format: str = "text"

    # Authentication & Security
    auth_required: bool = False
    api_key: str | None = None
    default_tenant_id: uuid.UUID = Field(
        default_factory=lambda: uuid.UUID("00000000-0000-0000-0000-000000000001")
    )
    tenant_api_keys: Annotated[dict[str, uuid.UUID], NoDecode] = Field(default_factory=dict)
    metrics_token: str | None = None
    trusted_proxies: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["127.0.0.1", "::1", "localhost"]
    )

    # Rate Limiting (sliding window per-IP / per-user)
    rate_limit_enabled: bool = True
    rate_limit_upload_per_minute: int = Field(default=15, ge=1)
    rate_limit_chat_per_minute: int = Field(default=60, ge=1)
    rate_limit_tools_per_minute: int = Field(default=30, ge=1)
    rate_limit_general_per_minute: int = Field(default=120, ge=1)

    # Database Connection Pooling
    db_pool_size: int = Field(default=10, ge=1, le=100)
    db_max_overflow: int = Field(default=20, ge=0, le=100)
    db_pool_recycle_seconds: int = Field(default=1800, ge=60)
    db_pool_timeout_seconds: float = Field(default=30.0, ge=1.0)

    @field_validator("cors_origins", "trusted_proxies", mode="before")
    @classmethod
    def parse_string_lists(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("tenant_api_keys", mode="before")
    @classmethod
    def parse_tenant_keys(cls, value: object) -> object:
        if isinstance(value, str):
            import json
            try:
                raw_dict = json.loads(value)
                return {k: uuid.UUID(str(v)) for k, v in raw_dict.items()}
            except Exception:
                return {}
        return value

    @field_validator("llm_fallback_model", mode="before")
    @classmethod
    def empty_fallback_is_none(cls, value: object) -> object:
        return None if value == "" else value

    @model_validator(mode="after")
    def validate_rag_settings(self) -> "Settings":
        if self.chunk_overlap_tokens >= self.chunk_size_tokens:
            raise ValueError("CHUNK_OVERLAP_TOKENS must be smaller than CHUNK_SIZE_TOKENS")
        if self.embedding_dimensions != 1536:
            raise ValueError("EMBEDDING_DIMENSIONS must match the migration's 1536 dimensions")
        if self.app_env.lower() == "production":
            if not self.auth_required:
                raise ValueError("AUTH_REQUIRED must be true when APP_ENV=production")
            if not self.api_key and not self.tenant_api_keys:
                raise ValueError("API_KEY or TENANT_API_KEYS must be set when APP_ENV=production")
            insecure_keys = {"documind-api-key-here", "secret", "test", "password", "12345"}
            if self.api_key and self.api_key.lower() in insecure_keys:
                raise ValueError("Insecure default API_KEY cannot be used in production")
            if "documind-local-only" in self.database_url:
                raise ValueError("Insecure default database credentials cannot be used in production")
        if self.auth_required and not self.api_key and not self.tenant_api_keys:
            raise ValueError("API_KEY or TENANT_API_KEYS must be configured when AUTH_REQUIRED=true")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

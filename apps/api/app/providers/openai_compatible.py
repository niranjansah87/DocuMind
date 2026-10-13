import asyncio
from collections.abc import Sequence
from typing import Any, cast

import httpx

from app.core.config import Settings
from app.core.errors import ProviderUnavailableError


class OpenAICompatibleProvider:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        payload = {
            "model": self.settings.embedding_model,
            "input": list(texts),
            "dimensions": self.settings.embedding_dimensions,
        }
        data = await self._post("/embeddings", payload)
        vectors = [item["embedding"] for item in sorted(data["data"], key=lambda item: item["index"])]
        if len(vectors) != len(texts) or any(len(vector) != self.settings.embedding_dimensions for vector in vectors):
            raise ProviderUnavailableError()
        return vectors

    async def generate(self, messages: list[dict[str, str]]) -> str:
        for model in filter(None, [self.settings.llm_model, self.settings.llm_fallback_model]):
            try:
                data = await self._post(
                    "/chat/completions",
                    {
                        "model": model,
                        "messages": messages,
                        "temperature": 0,
                        "max_tokens": self.settings.max_output_tokens,
                        "response_format": {"type": "json_object"},
                    },
                )
                return str(data["choices"][0]["message"]["content"])
            except ProviderUnavailableError:
                continue
        raise ProviderUnavailableError()

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.settings.openai_api_key:
            raise ProviderUnavailableError()
        headers = {"Authorization": f"Bearer {self.settings.openai_api_key}"}
        delay = 0.25
        for attempt in range(self.settings.provider_max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    base_url=self.settings.openai_base_url.rstrip("/"),
                    headers=headers,
                    timeout=self.settings.provider_timeout_seconds,
                ) as client:
                    response = await client.post(path, json=payload)
                if response.status_code in {408, 429, 500, 502, 503, 504}:
                    raise httpx.NetworkError("transient provider error", request=response.request)
                if response.is_error:
                    raise ProviderUnavailableError()
                return cast(dict[str, Any], response.json())
            except (httpx.TimeoutException, httpx.NetworkError, KeyError, ValueError):
                if attempt == self.settings.provider_max_retries:
                    break
                await asyncio.sleep(delay)
                delay *= 2
        raise ProviderUnavailableError()

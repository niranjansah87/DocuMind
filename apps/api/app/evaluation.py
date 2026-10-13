import argparse
import asyncio
import hashlib
import json
import re
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from statistics import mean, median
from typing import Any

from sqlalchemy import delete

from app.core.config import get_settings
from app.db.database import SessionFactory
from app.db.models import Document, DocumentChunk
from app.ingestion.chunker import chunk_text
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.repositories.documents import DocumentRepository
from app.services.chat import ChatService
from app.services.orders import OrderService

EVALUATION_OWNER_ID = uuid.UUID("00000000-0000-0000-0000-0000000000e1")
ROOT = Path(__file__).parents[3]
STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}


def answer_overlap(answer: str, expected: str) -> float:
    words = {
        word
        for word in re.findall(r"[a-z0-9]+", expected.lower())
        if word not in STOP_WORDS
    }
    answer_words = set(re.findall(r"[a-z0-9]+", answer.lower()))
    return len(words & answer_words) / len(words) if words else 0.0


async def run_evaluation(chunk_sizes: list[int]) -> dict[str, Any]:
    settings = get_settings()
    provider = OpenAICompatibleProvider(settings)
    text = (ROOT / "data" / "sample_knowledge_document.txt").read_text(encoding="utf-8")
    questions = json.loads(
        (ROOT / "data" / "gold_questions.json").read_text(encoding="utf-8")
    )
    query_vectors = await provider.embed([item["question"] for item in questions])
    runs: list[dict[str, Any]] = []
    async with SessionFactory() as session:
        await session.execute(
            delete(Document).where(Document.owner_id == EVALUATION_OWNER_ID)
        )
        await session.commit()
        try:
            for chunk_size in chunk_sizes:
                chunks = chunk_text(text, chunk_size, settings.chunk_overlap_tokens)
                vectors = await provider.embed([chunk.text for chunk in chunks])
                document = Document(
                    owner_id=EVALUATION_OWNER_ID,
                    filename=f"evaluation-{chunk_size}.txt",
                    content_sha256=hashlib.sha256(
                        f"{chunk_size}:{text}".encode()
                    ).hexdigest(),
                    mime_type="text/plain",
                    byte_size=len(text.encode()),
                    status="ready",
                )
                session.add(document)
                await session.flush()
                session.add_all(
                    DocumentChunk(
                        document_id=document.id,
                        chunk_index=chunk.index,
                        text=chunk.text,
                        token_count=chunk.token_count,
                        embedding=vector,
                        embedding_model=settings.embedding_model,
                        chunk_size_tokens=chunk_size,
                        overlap_tokens=settings.chunk_overlap_tokens,
                    )
                    for chunk, vector in zip(chunks, vectors, strict=True)
                )
                await session.commit()
                repository = DocumentRepository(session)
                service = ChatService(repository, OrderService(session), settings)
                service.provider = provider
                for mode in ("vector", "hybrid"):
                    measurements: list[dict[str, Any]] = []
                    for item, query_vector in zip(
                        questions, query_vectors, strict=True
                    ):
                        started = time.monotonic()
                        rows = (
                            await repository.retrieve_hybrid(
                                EVALUATION_OWNER_ID,
                                [document.id],
                                item["question"],
                                query_vector,
                                settings.retrieval_top_k,
                            )
                            if mode == "hybrid"
                            else await repository.retrieve(
                                EVALUATION_OWNER_ID,
                                [document.id],
                                query_vector,
                                settings.retrieval_top_k,
                            )
                        )
                        relevant = [
                            (chunk, source, 1 - distance)
                            for chunk, source, distance in rows
                            if 1 - distance >= settings.retrieval_similarity_threshold
                        ]
                        evidence_retrieved = any(
                            item["gold_section"].lower() in chunk.text.lower()
                            for chunk, _, _ in rows
                        )
                        if relevant:
                            raw = await provider.generate(
                                service._messages(item["question"], relevant)
                            )
                            response = service._validated_response(
                                raw, relevant, started
                            )
                        else:
                            response = service._abstain(started)
                        candidate_ids = {chunk.id for chunk, _, _ in rows}
                        citations_valid = bool(response.citations) and all(
                            citation.chunk_id in candidate_ids
                            for citation in response.citations
                        )
                        supported = (
                            not response.abstained
                            and citations_valid
                            and answer_overlap(response.answer, item["expected_answer"])
                            >= 0.45
                        )
                        measurements.append(
                            {
                                "id": item["id"],
                                "question": item["question"],
                                "gold_section": item["gold_section"],
                                "retrieved_chunk_ids": [
                                    str(chunk.id) for chunk, _, _ in rows
                                ],
                                "evidence_retrieved": evidence_retrieved,
                                "answer": response.answer,
                                "citation_ids": [
                                    str(citation.chunk_id)
                                    for citation in response.citations
                                ],
                                "citations_valid": citations_valid,
                                "supported_by_lexical_gold_check": supported,
                                "latency_ms": response.latency_ms,
                            }
                        )
                    latencies = [item["latency_ms"] for item in measurements]
                    evidence_count = sum(
                        item["evidence_retrieved"] for item in measurements
                    )
                    runs.append(
                        {
                            "chunk_size_tokens": chunk_size,
                            "retrieval_mode": mode,
                            "questions_tested": len(measurements),
                            "correct_evidence_retrieved": evidence_count,
                            "retrieval_recall_at_k": round(
                                evidence_count / len(measurements), 3
                            ),
                            "supported_answers": sum(
                                item["supported_by_lexical_gold_check"]
                                for item in measurements
                            ),
                            "citation_valid_answers": sum(
                                item["citations_valid"] for item in measurements
                            ),
                            "mean_latency_ms": round(mean(latencies)),
                            "median_latency_ms": round(median(latencies)),
                            "failed_requests": 0,
                            "measurements": measurements,
                        }
                    )
        finally:
            await session.execute(
                delete(Document).where(Document.owner_id == EVALUATION_OWNER_ID)
            )
            await session.commit()
    return {
        "timestamp": datetime.now(UTC).isoformat(),
        "dataset": "data/sample_knowledge_document.txt",
        "embedding_model": settings.embedding_model,
        "embedding_dimensions": settings.embedding_dimensions,
        "top_k": settings.retrieval_top_k,
        "similarity_metric": "cosine similarity (higher is better)",
        "similarity_threshold": settings.retrieval_similarity_threshold,
        "overlap_tokens": settings.chunk_overlap_tokens,
        "answer_support_method": "citation-valid answer with at least 45% non-stopword overlap against the gold answer; human review remains recommended",
        "runs": runs,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run DocuMind retrieval and answer evaluation."
    )
    parser.add_argument("--chunk-sizes", nargs="+", type=int, default=[300, 800])
    args = parser.parse_args()
    result = asyncio.run(run_evaluation(args.chunk_sizes))
    output_dir = ROOT / "evaluation" / "results"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = (
        output_dir / f"evaluation-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.json"
    )
    serialized = json.dumps(result, indent=2, ensure_ascii=False)
    output.write_text(serialized, encoding="utf-8")
    (output_dir / "latest.json").write_text(serialized, encoding="utf-8")
    print(f"Evaluation complete: {output}")


if __name__ == "__main__":
    main()

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends

from app.api.dependencies import get_owner_id
from app.core.config import Settings, get_settings
from app.schemas.meta import AppMetaResponse, EvaluationQuestion, EvaluationResponse

router = APIRouter(tags=["metadata"])


@router.get("/auth/verify")
async def verify_auth(
    owner_id: uuid.UUID = Depends(get_owner_id),
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    """Verify client authentication credentials and return current tenant identity."""
    return {
        "authenticated": True,
        "owner_id": str(owner_id),
        "auth_required": settings.auth_required,
    }



def data_path(filename: str) -> Path:
    container_path = Path("/data") / filename
    return (
        container_path if container_path.exists() else Path(__file__).parents[5] / "data" / filename
    )


def latest_evaluation_runs() -> list[dict[str, object]]:
    roots = [
        Path("/evaluation/results"),
        Path(__file__).parents[5] / "evaluation" / "results",
    ]
    files = [file for root in roots if root.exists() for file in root.glob("*.json")]
    if not files:
        return []
    payload = json.loads(
        max(files, key=lambda file: file.stat().st_mtime).read_text(encoding="utf-8")
    )
    return list(payload.get("runs", []))


@router.get("/meta", response_model=AppMetaResponse)
async def app_meta(settings: Settings = Depends(get_settings)) -> AppMetaResponse:
    return AppMetaResponse(
        application_name="DocuMind",
        workspace_name="Demo workspace",
        scope_label="Single-user scope",
        accepted_extensions=["PDF", "TXT"],
        max_upload_bytes=settings.max_upload_bytes,
        max_query_chars=settings.max_query_chars,
        suggested_questions=[
            "Summarize the return policy",
            "What is covered by warranty?",
            "Where is ORD-1002?",
        ],
        order_example="ORD-1002",
        order_number_pattern="ORD-[0-9]{4,}",
        embedding_model=settings.embedding_model,
        embedding_dimensions=settings.embedding_dimensions,
        retrieval_strategy="PostgreSQL FTS + pgvector RRF",
        retrieval_top_k=settings.retrieval_top_k,
        chunk_size_tokens=settings.chunk_size_tokens,
        chunk_overlap_tokens=settings.chunk_overlap_tokens,
    )


@router.get("/evaluation", response_model=EvaluationResponse)
async def evaluation(settings: Settings = Depends(get_settings)) -> EvaluationResponse:
    questions = [
        EvaluationQuestion.model_validate(item)
        for item in json.loads(data_path("gold_questions.json").read_text(encoding="utf-8"))
    ]
    runs = latest_evaluation_runs()
    return EvaluationResponse(
        dataset="sample_knowledge_document.txt",
        questions=questions,
        embedding_model=settings.embedding_model,
        embedding_dimensions=settings.embedding_dimensions,
        retrieval_strategy="PostgreSQL FTS + pgvector RRF",
        chunk_sizes=[300, 800],
        status="measured" if runs else "pending verified run",
        runs=runs,
        command="python -m app.evaluation --chunk-sizes 300 800",
    )

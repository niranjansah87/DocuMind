import uuid

from fastapi import APIRouter, Depends, File, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_owner_id
from app.core.config import Settings, get_settings
from app.db.database import get_session
from app.repositories.documents import DocumentRepository
from app.schemas.documents import DocumentListItem, DocumentListResponse, DocumentUploadResponse
from app.services.ingestion import IngestionService

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentUploadResponse, status_code=201)
async def upload_document(
    response: Response,
    file: UploadFile = File(...),
    owner_id: uuid.UUID = Depends(get_owner_id),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> DocumentUploadResponse:
    content = await file.read(settings.max_upload_bytes + 1)
    result = await IngestionService(session, settings).ingest(owner_id, file.filename, file.content_type, content)
    response.status_code = 200 if result.duplicate else 201
    return DocumentUploadResponse(
        document_id=result.document.id,
        filename=result.document.filename,
        status=result.document.status,
        duplicate=result.duplicate,
        chunk_count=result.chunk_count,
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    owner_id: uuid.UUID = Depends(get_owner_id),
    session: AsyncSession = Depends(get_session),
) -> DocumentListResponse:
    documents = await DocumentRepository(session).list_ready(owner_id)
    return DocumentListResponse(
        items=[
            DocumentListItem(
                document_id=document.id,
                filename=document.filename,
                status=document.status,
                created_at=document.created_at,
            )
            for document in documents
        ]
    )

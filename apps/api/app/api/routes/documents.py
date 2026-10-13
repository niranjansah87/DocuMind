import uuid

from fastapi import APIRouter, Depends, File, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_owner_id
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.db.database import get_session
from app.repositories.documents import DocumentRepository
from app.schemas.documents import (
    DocumentChunkItem,
    DocumentDetailResponse,
    DocumentListItem,
    DocumentListResponse,
    DocumentUploadResponse,
)
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
                byte_size=document.byte_size,
                mime_type=document.mime_type,
                page_count=document.page_count,
            )
            for document in documents
        ]
    )


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: uuid.UUID,
    owner_id: uuid.UUID = Depends(get_owner_id),
    session: AsyncSession = Depends(get_session),
) -> DocumentDetailResponse:
    repository = DocumentRepository(session)
    document = await repository.get_owned(owner_id, document_id)
    if not document:
        raise AppError("DOCUMENT_NOT_FOUND", "The document was not found.", 404)
    chunks = await repository.list_chunks(owner_id, document_id)
    return DocumentDetailResponse(
        document_id=document.id,
        filename=document.filename,
        status=document.status,
        created_at=document.created_at,
        byte_size=document.byte_size,
        mime_type=document.mime_type,
        page_count=document.page_count,
        chunk_count=len(chunks),
        chunk_size_tokens=chunks[0].chunk_size_tokens if chunks else None,
        overlap_tokens=chunks[0].overlap_tokens if chunks else None,
        chunks=[
            DocumentChunkItem(
                chunk_id=chunk.id,
                chunk_index=chunk.chunk_index,
                text=chunk.text,
                token_count=chunk.token_count,
                section=chunk.section_title,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
            )
            for chunk in chunks
        ],
    )


@router.get("/{document_id}/download")
async def download_document(
    document_id: uuid.UUID,
    owner_id: uuid.UUID = Depends(get_owner_id),
    session: AsyncSession = Depends(get_session),
) -> Response:
    repository = DocumentRepository(session)
    document = await repository.get_owned(owner_id, document_id)
    if not document:
        raise AppError("DOCUMENT_NOT_FOUND", "The document was not found.", 404)
    chunks = await repository.list_chunks(owner_id, document_id)
    text_content = "\n\n".join(chunk.text for chunk in chunks)
    media_type = "text/plain; charset=utf-8"
    filename = document.filename if document.filename.endswith(".txt") else f"{document.filename}.txt"
    return Response(
        content=text_content.encode("utf-8"),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    owner_id: uuid.UUID = Depends(get_owner_id),
    session: AsyncSession = Depends(get_session),
) -> Response:
    if not await DocumentRepository(session).delete_owned(owner_id, document_id):
        raise AppError("DOCUMENT_NOT_FOUND", "The document was not found.", 404)
    return Response(status_code=204)

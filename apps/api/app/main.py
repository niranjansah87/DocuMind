import logging
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import Response

from app.api.routes import chat, documents, health, tools
from app.core.config import get_settings
from app.core.errors import AppError

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


def error_response(request_id: str, code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "request_id": request_id}},
        headers={"X-Request-ID": request_id},
    )


def create_app() -> FastAPI:
    application = FastAPI(title="DocuMind API", version="0.1.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Request-ID"],
    )

    @application.middleware("http")
    async def request_id_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @application.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return error_response(request.state.request_id, exc.code, exc.message, exc.status_code)

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.info("Request validation failed", extra={"request_id": request.state.request_id})
        return error_response(request.state.request_id, "VALIDATION_ERROR", "The request is invalid.", 422)

    @application.exception_handler(HTTPException)
    async def handle_http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return error_response(request.state.request_id, "DEPENDENCY_UNAVAILABLE", str(exc.detail), exc.status_code)

    @application.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled request error", extra={"request_id": request.state.request_id})
        return error_response(request.state.request_id, "INTERNAL_ERROR", "An unexpected error occurred.", 500)

    application.include_router(health.router)
    application.include_router(documents.router, prefix="/api/v1")
    application.include_router(chat.router, prefix="/api/v1")
    application.include_router(tools.router, prefix="/api/v1")
    return application


app = create_app()

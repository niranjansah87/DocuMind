import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import Response

from app.api.routes import chat, documents, health, landing, meta, tools
from app.api.routes import metrics as metrics_route
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import configure_logging, get_logger, request_id_ctx
from app.core.metrics import metrics
from app.core.rate_limit import enforce_rate_limit

settings = get_settings()
configure_logging(
    level=settings.log_level, log_format=settings.log_format, environment=settings.app_env
)
logger = get_logger(__name__)


def error_response(request_id: str, code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "request_id": request_id}},
        headers={"X-Request-ID": request_id},
    )


def create_app() -> FastAPI:
    application = FastAPI(
        title="DocuMind API",
        version="0.1.0",
        description="Document Q&A assistant with bounded RAG and agent tools",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Production-grade CORS configuration
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "Content-Disposition", "Content-Type"],
        max_age=600,
    )

    @application.middleware("http")
    async def security_headers_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if settings.app_env.lower() == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    @application.middleware("http")
    async def rate_limiting_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if not settings.rate_limit_enabled or not request.url.path.startswith("/api/v1/"):
            return await call_next(request)

        path = request.url.path
        method = request.method.upper()

        limit = settings.rate_limit_general_per_minute
        if path.startswith("/api/v1/documents") and method == "POST":
            limit = settings.rate_limit_upload_per_minute
        elif path.startswith("/api/v1/chat") and method == "POST":
            limit = settings.rate_limit_chat_per_minute
        elif path.startswith("/api/v1/tickets") and method == "POST":
            limit = settings.rate_limit_tools_per_minute

        try:
            rate_result = enforce_rate_limit(request, limit, settings)
        except AppError as exc:
            metrics.record_rate_limit_exceeded()
            request_id = getattr(request.state, "request_id", "-")
            resp = error_response(request_id, exc.code, exc.message, exc.status_code)
            resp.headers["Retry-After"] = "60"
            return resp

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(rate_result.limit)
        response.headers["X-RateLimit-Remaining"] = str(rate_result.remaining)
        return response

    @application.middleware("http")
    async def request_logging_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token = request_id_ctx.set(request_id)
        request.state.request_id = request_id
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000
            duration_sec = duration_ms / 1000.0
            response.headers["X-Request-ID"] = request_id
            metrics.record_http_request(request.url.path, response.status_code, duration_sec)

            if request.url.path not in ("/health", "/ready", "/metrics"):
                logger.info(
                    "HTTP %s %s %d (%.2fms)",
                    request.method,
                    request.url.path,
                    response.status_code,
                    duration_ms,
                )
            return response
        except Exception:
            duration_ms = (time.perf_counter() - start_time) * 1000
            duration_sec = duration_ms / 1000.0
            metrics.record_http_request(request.url.path, 500, duration_sec)
            logger.exception(
                "HTTP %s %s failed (%.2fms)",
                request.method,
                request.url.path,
                duration_ms,
            )
            raise
        finally:
            request_id_ctx.reset(token)

    @application.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "-")
        return error_response(request_id, exc.code, exc.message, exc.status_code)

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "-")
        logger.info("Request validation failed for %s", request.url.path)
        return error_response(request_id, "VALIDATION_ERROR", "The request is invalid.", 422)

    @application.exception_handler(HTTPException)
    async def handle_http_error(request: Request, exc: HTTPException) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "-")
        return error_response(
            request_id,
            "DEPENDENCY_UNAVAILABLE",
            str(exc.detail),
            exc.status_code,
        )

    @application.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "-")
        logger.exception("Unhandled error processing %s", request.url.path)
        return error_response(
            request_id,
            "INTERNAL_ERROR",
            "An unexpected error occurred.",
            500,
        )

    # Routes
    application.include_router(landing.router)
    application.include_router(health.router)
    application.include_router(metrics_route.router)
    application.include_router(documents.router, prefix="/api/v1")
    application.include_router(chat.router, prefix="/api/v1")
    application.include_router(tools.router, prefix="/api/v1")
    application.include_router(meta.router, prefix="/api/v1")
    return application


app = create_app()

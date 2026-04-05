"""
LMS Admin Backend — FastAPI entry point.

Run:
    uvicorn app.main:app --reload --port 8000

Docs:
    http://localhost:8000/docs   (Swagger UI)
    http://localhost:8000/redoc  (ReDoc)
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.api.v1.router import api_router


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: could seed DB, warm caches, etc.
    print("✅  LMS Admin API started")
    yield
    # Shutdown
    print("🛑  LMS Admin API shutting down")


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="LMS Admin API",
    description=(
        "Backend for the Learning Management System admin dashboard. "
        "All endpoints under `/admin/*` require a valid Bearer JWT token obtained "
        "from `POST /auth/login`."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global exception handlers ─────────────────────────────────────────────────

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    """Catch unhandled DB unique-constraint violations and return a clean 409."""
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Database constraint violation. Record may already exist."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(api_router, prefix="/api/v1")

# Convenience: also mount without /api/v1 prefix for direct /auth/login etc.
app.include_router(api_router)


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "LMS Admin API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}

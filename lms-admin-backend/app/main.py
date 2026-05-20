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

# ── Rate limiting ──────────────────────────────────────────────────────────────
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.api.v1.endpoints.notifications import notif_router


# ── Global limiter instance (imported by endpoint files) ──────────────────────
#
#   key_func=get_remote_address  →  rate limit is tracked per client IP address.
#   default_limits=["200/minute"] →  safety net for ALL routes (not just login).
#
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("✅  LMS Admin API started")
    yield
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

# ── Attach limiter to app state (required by slowapi) ─────────────────────────
app.state.limiter = limiter

# ── Register the 429 handler so slowapi returns clean JSON on rate-limit hit ──
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── SlowAPI middleware (must be added BEFORE CORSMiddleware) ──────────────────
app.add_middleware(SlowAPIMiddleware)

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

# Notifications mounted ONCE directly to avoid double-mount route conflicts
app.include_router(notif_router)


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
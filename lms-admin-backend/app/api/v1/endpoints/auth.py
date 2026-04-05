from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.schemas import LoginRequest, TokenResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse, summary="Admin / User Login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with email + password. Returns a JWT bearer token.
    Include the token as `Authorization: Bearer <token>` on all admin endpoints.
    """
    return await auth_service.login(db, data)

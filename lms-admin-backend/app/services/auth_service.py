from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.models import User, Role
from app.schemas.schemas import LoginRequest, TokenResponse
from app.core.security import verify_password, create_access_token


async def login(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .join(Role)
        .where(User.email == data.email, User.is_active == True)
    )
    user: User | None = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(
        subject=user.id,
        extra={"role": user.role.name, "email": user.email},
    )
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role.name,
        full_name=f"{user.first_name} {user.last_name}",
    )
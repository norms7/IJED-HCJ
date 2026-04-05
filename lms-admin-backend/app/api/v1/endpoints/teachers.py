from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_admin
from app.schemas.schemas import (
    TeacherCreate, TeacherOut, TeacherListResponse,
    AssignClassRequest, MessageResponse,
)
from app.services import teacher_service

router = APIRouter(prefix="/admin/teachers", tags=["Teacher Management"])


@router.post(
    "",
    response_model=TeacherOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Teacher Profile",
)
async def create_teacher(
    data: TeacherCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    """
    Creates a teacher profile linked to an existing user.
    The user must already exist with role = 'teacher'.
    """
    return await teacher_service.create_teacher_profile(db, data)


@router.get("", response_model=TeacherListResponse, summary="List All Teachers")
async def list_teachers(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    """Returns all active teachers with their class and subject assignments."""
    return await teacher_service.list_teachers(db)


@router.get("/{teacher_id}", response_model=TeacherOut, summary="Get Teacher Detail")
async def get_teacher(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    """
    Full teacher profile including:
    - Personal info
    - All class assignments
    - Subjects taught
    - Schedule per class
    """
    return await teacher_service.get_teacher(db, teacher_id)


@router.post(
    "/assign-class",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign Teacher to Class/Subject",
)
async def assign_class(
    data: AssignClassRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    """
    Assigns a teacher to a class for a specific subject with an optional schedule.
    A teacher can handle multiple classes/subjects.
    Duplicate (teacher + class + subject) combinations are rejected with 409.
    """
    result = await teacher_service.assign_class(db, data)
    return MessageResponse(**result)

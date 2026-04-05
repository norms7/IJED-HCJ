from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import get_current_admin
from app.schemas.schemas import (
    ClassCreate, ClassOut,
    SectionCreate, SectionOut,
    SubjectCreate, SubjectOut,
    MessageResponse,
)
from app.models.models import Class, Section, Subject

# ── Classes ───────────────────────────────────────────────────────────────────

classes_router = APIRouter(prefix="/admin/classes", tags=["Classes & Sections"])


@classes_router.post(
    "",
    response_model=ClassOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Class",
)
async def create_class(
    data: ClassCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    cls = Class(**data.model_dump())
    db.add(cls)
    await db.flush()
    return ClassOut.model_validate(cls)


@classes_router.get("", response_model=list[ClassOut], summary="List Classes")
async def list_classes(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    result = await db.execute(
        select(Class).where(Class.is_active == True).order_by(Class.name)
    )
    return [ClassOut.model_validate(c) for c in result.scalars().all()]


@classes_router.get("/{class_id}", response_model=ClassOut)
async def get_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    from fastapi import HTTPException
    cls = await db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return ClassOut.model_validate(cls)


# ── Sections ──────────────────────────────────────────────────────────────────

sections_router = APIRouter(prefix="/admin/sections", tags=["Classes & Sections"])


@sections_router.post(
    "",
    response_model=SectionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Section",
)
async def create_section(
    data: SectionCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    from fastapi import HTTPException
    cls = await db.get(Class, data.class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    section = Section(**data.model_dump())
    db.add(section)
    await db.flush()
    return SectionOut.model_validate(section)


@sections_router.get("", response_model=list[SectionOut], summary="List Sections")
async def list_sections(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    result = await db.execute(select(Section).order_by(Section.name))
    return [SectionOut.model_validate(s) for s in result.scalars().all()]


# ── Subjects ──────────────────────────────────────────────────────────────────

subjects_router = APIRouter(prefix="/admin/subjects", tags=["Subjects"])


@subjects_router.post(
    "",
    response_model=SubjectOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Subject",
)
async def create_subject(
    data: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    subject = Subject(**data.model_dump())
    db.add(subject)
    await db.flush()
    return SubjectOut.model_validate(subject)


@subjects_router.get("", response_model=list[SubjectOut], summary="List Subjects")
async def list_subjects(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    result = await db.execute(select(Subject).order_by(Subject.name))
    return [SubjectOut.model_validate(s) for s in result.scalars().all()]

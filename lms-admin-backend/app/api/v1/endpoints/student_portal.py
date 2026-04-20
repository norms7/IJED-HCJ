"""
Student Portal — endpoints for logged-in students.

GET /student/me/subjects  → subjects available to the student via their class
GET /student/me/modules   → published modules for the student's class(es)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import bearer_scheme, decode_token
from app.db.session import get_db
from app.models.models import (
    Module, Section, Student, StudentSectionAssignment,
    TeacherClassAssignment,
)
from app.schemas.schemas import ModuleOut

router = APIRouter(prefix="/student", tags=["Student Portal"])


# ── Auth dependency ───────────────────────────────────────────────────────────

async def get_current_student(
    credentials=Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    payload = decode_token(credentials.credentials)
    role = payload.get("role", "")
    if role not in ("student", "admin"):
        raise HTTPException(status_code=403, detail="Student access required")

    user_id = int(payload["sub"])
    result = await db.execute(
        select(Student)
        .options(
            selectinload(Student.section_assignments)
            .selectinload(StudentSectionAssignment.section)
            .selectinload(Section.class_)
        )
        .where(Student.user_id == user_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student


# ── GET /student/me/subjects ──────────────────────────────────────────────────

@router.get("/me/subjects", summary="Get my enrolled subjects")
async def get_student_subjects(
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Returns subjects available to the student based on their class enrollment."""
    class_ids = {
        a.section.class_id
        for a in student.section_assignments
        if a.section and a.section.class_id
    }
    if not class_ids:
        return []

    result = await db.execute(
        select(TeacherClassAssignment)
        .options(
            selectinload(TeacherClassAssignment.subject),
            selectinload(TeacherClassAssignment.class_),
        )
        .where(TeacherClassAssignment.class_id.in_(class_ids))
    )
    assignments = result.scalars().all()

    seen: set[int] = set()
    subjects = []
    for a in assignments:
        if a.subject_id not in seen:
            seen.add(a.subject_id)
            subjects.append({
                "subject_id": a.subject.id,
                "subject_name": a.subject.name,
                "class_id": a.class_.id,
                "class_name": a.class_.name,
            })
    return subjects


# ── GET /student/me/modules ───────────────────────────────────────────────────

@router.get("/me/modules", response_model=list[ModuleOut], summary="Get modules for my subjects")
async def get_student_modules(
    subject_id: Optional[int] = Query(None),
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns published modules for the classes the student is enrolled in.
    Optionally filter by subject.
    """
    class_ids = {
        a.section.class_id
        for a in student.section_assignments
        if a.section and a.section.class_id
    }
    if not class_ids:
        return []

    q = (
        select(Module)
        .options(selectinload(Module.activities))
        .where(Module.class_id.in_(class_ids))
        .where(Module.is_published == True)
    )
    if subject_id:
        q = q.where(Module.subject_id == subject_id)
    q = q.order_by(Module.subject_id, Module.term, Module.order)

    rows = (await db.execute(q)).scalars().all()
    result = []
    for m in rows:
        out = ModuleOut.model_validate(m)
        out.activity_count = len(m.activities)
        result.append(out)
    return result

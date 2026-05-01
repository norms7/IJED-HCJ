"""
Student Portal — endpoints for logged-in students.

GET /student/me/subjects  → subjects the student is directly enrolled in
                            (student_subject_enrollments table, set by admin)
                            Falls back to section → class → teacher_class_assignments
                            if no direct enrollments exist.
GET /student/me/modules   → published modules for the student's enrolled subjects
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
    StudentSubjectEnrollment, Subject,
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
            .selectinload(Section.class_),
            selectinload(Student.subject_enrollments)
            .selectinload(StudentSubjectEnrollment.subject),
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
    """
    Returns subjects the student is enrolled in.

    Priority:
    1. Direct subject enrollments via student_subject_enrollments
       (set by admin through the "Enroll in Subjects" feature).
    2. Fallback: subjects inferred from the student's section → class →
       teacher_class_assignments (for legacy/section-only setups).
    """

    # ── 1. Direct subject enrollments (primary source) ────────────────────
    direct_enrollments = student.subject_enrollments or []

    if direct_enrollments:
        # For each enrolled subject, also look up which class it belongs to
        # (via teacher_class_assignments) so we can show the class name.
        subject_ids = [e.subject_id for e in direct_enrollments]

        tca_result = await db.execute(
            select(TeacherClassAssignment)
            .options(
                selectinload(TeacherClassAssignment.subject),
                selectinload(TeacherClassAssignment.class_),
            )
            .where(TeacherClassAssignment.subject_id.in_(subject_ids))
        )
        tca_rows = tca_result.scalars().all()

        # Build subject_id → class info map (use first assignment found)
        class_map: dict[int, dict] = {}
        for tca in tca_rows:
            if tca.subject_id not in class_map:
                class_map[tca.subject_id] = {
                    "class_id": tca.class_.id,
                    "class_name": tca.class_.name,
                }

        subjects = []
        for e in direct_enrollments:
            class_info = class_map.get(e.subject_id, {})
            subjects.append({
                "subject_id": e.subject.id,
                "subject_name": e.subject.name,
                "class_id": class_info.get("class_id"),
                "class_name": class_info.get("class_name", "—"),
            })
        return subjects

    # ── 2. Fallback: section → class → teacher assignments ────────────────
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
    Returns published modules for the subjects the student is enrolled in.
    Resolves subject list the same way as /me/subjects (direct enrollments first,
    then section fallback). Optionally filter by subject_id.
    """

    # ── Collect subject_ids the student has access to ─────────────────────
    direct_enrollments = student.subject_enrollments or []

    if direct_enrollments:
        enrolled_subject_ids = {e.subject_id for e in direct_enrollments}
    else:
        # Fallback to section → class → subjects
        class_ids = {
            a.section.class_id
            for a in student.section_assignments
            if a.section and a.section.class_id
        }
        if not class_ids:
            return []

        tca_result = await db.execute(
            select(TeacherClassAssignment.subject_id)
            .where(TeacherClassAssignment.class_id.in_(class_ids))
        )
        enrolled_subject_ids = {row[0] for row in tca_result.all()}

    if not enrolled_subject_ids:
        return []

    # ── Query published modules for those subjects ────────────────────────
    q = (
        select(Module)
        .options(selectinload(Module.activities))
        .where(Module.subject_id.in_(enrolled_subject_ids))
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
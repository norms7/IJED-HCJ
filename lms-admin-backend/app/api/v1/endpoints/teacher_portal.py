"""
Teacher Portal endpoints — for logged-in teachers (not admin-only).
GET  /teacher/me/subjects       → subjects assigned to this teacher
GET  /teacher/me/modules        → modules uploaded by this teacher
POST /teacher/me/modules        → upload a new module (with PDF)
POST /teacher/me/modules/upload → upload PDF file, returns file_url
"""
import os
import shutil
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import bearer_scheme, decode_token
from app.db.session import get_db
from app.models.models import Module, Subject, Teacher, TeacherClassAssignment, User
from app.schemas.schemas import ModuleOut

router = APIRouter(prefix="/teacher", tags=["Teacher Portal"])

UPLOAD_DIR = "uploads/modules"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Auth dependency for any logged-in teacher ─────────────────────────────────

async def get_current_teacher(
    credentials=Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Teacher:
    payload = decode_token(credentials.credentials)
    role = payload.get("role", "")
    if role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Teacher access required")

    user_id = int(payload["sub"])
    result = await db.execute(
        select(Teacher)
        .options(selectinload(Teacher.class_assignments).selectinload(TeacherClassAssignment.subject))
        .options(selectinload(Teacher.class_assignments).selectinload(TeacherClassAssignment.class_))
        .where(Teacher.user_id == user_id)
    )
    teacher = result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    return teacher


# ── GET /teacher/me/subjects ──────────────────────────────────────────────────

@router.get("/me/subjects", summary="Get my assigned subjects")
async def get_my_subjects(
    teacher: Teacher = Depends(get_current_teacher),
):
    """Returns all subjects this teacher is assigned to, with class info."""
    seen = set()
    subjects = []
    for assignment in teacher.class_assignments:
        key = (assignment.subject_id, assignment.class_id)
        if key not in seen:
            seen.add(key)
            subjects.append({
                "subject_id": assignment.subject.id,
                "subject_name": assignment.subject.name,
                "class_id": assignment.class_.id,
                "class_name": assignment.class_.name,
                "grade_level": assignment.class_.grade_level,
                "schedule": assignment.schedule,
            })
    return subjects


# ── POST /teacher/me/modules/upload (upload PDF file) ────────────────────────

@router.post("/me/modules/upload", summary="Upload PDF file for a module")
async def upload_module_file(
    file: UploadFile = File(...),
    teacher: Teacher = Depends(get_current_teacher),
):
    """Upload a PDF file. Returns the file_url to use when creating the module."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Max 20MB
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 20MB.")

    unique_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as f:
        f.write(contents)

    return {
        "file_url": f"/teacher/files/{unique_name}",
        "file_name": file.filename,
    }


# ── GET /teacher/files/{filename} (serve uploaded PDF) ───────────────────────

@router.get("/files/{filename}", summary="Download/view a module PDF")
async def serve_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, media_type="application/pdf")


# ── GET /teacher/me/modules ───────────────────────────────────────────────────

@router.get("/me/modules", response_model=list[ModuleOut], summary="Get my modules")
async def get_my_modules(
    subject_id: Optional[int] = Query(None),
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Returns all modules this teacher has uploaded, optionally filtered by subject."""
    q = (
        select(Module)
        .options(selectinload(Module.activities))
        .where(Module.teacher_id == teacher.id)
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


# ── POST /teacher/me/modules (create module with PDF) ────────────────────────

@router.post(
    "/me/modules",
    response_model=ModuleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a module",
)
async def create_my_module(
    title: str = Form(...),
    subject_id: int = Form(...),
    description: Optional[str] = Form(None),
    term: Optional[str] = Form(None),
    file_url: Optional[str] = Form(None),
    file_name: Optional[str] = Form(None),
    is_published: bool = Form(True),
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new module. Call /teacher/me/modules/upload first to get file_url,
    then pass it here along with the module details.
    """
    # Verify teacher is assigned to this subject
    assigned_subject_ids = {a.subject_id for a in teacher.class_assignments}
    if subject_id not in assigned_subject_ids:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to this subject"
        )

    # Get the class_id from the assignment
    class_id = None
    for a in teacher.class_assignments:
        if a.subject_id == subject_id:
            class_id = a.class_id
            break

    module = Module(
        title=title,
        description=description,
        subject_id=subject_id,
        class_id=class_id,
        teacher_id=teacher.id,
        term=term,
        file_url=file_url,
        file_name=file_name,
        is_published=is_published,
        order=0,
    )
    db.add(module)
    await db.flush()
    await db.refresh(module, ["activities"])

    out = ModuleOut.model_validate(module)
    out.activity_count = 0
    return out


# ── GET /student/me/modules (student sees modules for their subjects) ─────────

student_router = APIRouter(prefix="/student", tags=["Student Portal"])


async def get_current_student(
    credentials=Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    from app.models.models import Student, StudentSectionAssignment, Section
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


@student_router.get("/me/modules", response_model=list[ModuleOut], summary="Get modules for my subjects")
async def get_student_modules(
    subject_id: Optional[int] = Query(None),
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns published modules for the classes the student is enrolled in.
    Optionally filter by subject.
    """
    from app.models.models import StudentSectionAssignment, Section

    # Get all class_ids the student belongs to
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


@student_router.get("/me/subjects", summary="Get my enrolled subjects")
async def get_student_subjects(
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Returns subjects available to the student based on their class enrollment."""
    from app.models.models import TeacherClassAssignment

    class_ids = {
        a.section.class_id
        for a in student.section_assignments
        if a.section and a.section.class_id
    }
    if not class_ids:
        return []

    result = await db.execute(
        select(TeacherClassAssignment)
        .options(selectinload(TeacherClassAssignment.subject))
        .options(selectinload(TeacherClassAssignment.class_))
        .where(TeacherClassAssignment.class_id.in_(class_ids))
    )
    assignments = result.scalars().all()

    seen = set()
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
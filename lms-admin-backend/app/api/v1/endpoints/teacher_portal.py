"""
Teacher Portal endpoints — for logged-in teachers (not admin-only).
GET  /teacher/me/subjects                          → subjects assigned to this teacher
GET  /teacher/me/class/{class_id}/students         → students in a class
GET  /teacher/me/modules                           → modules uploaded by this teacher
POST /teacher/me/modules                           → upload a new module (with PDF)
POST /teacher/me/modules/upload                    → upload PDF file, returns file_url

Student Portal endpoints — for logged-in students.
GET  /student/me/modules                           → published modules for enrolled classes
GET  /student/me/subjects                          → subjects available to student
GET  /student/me/activities                        → published activities for enrolled subjects
POST /student/me/activities/{id}/submit            → submit answers (auto-graded or manual queue)
GET  /student/me/activities/{id}/result            → get own submission result
"""
import json
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
from app.models.models import (
    Activity, ActivityAnswer, ActivityQuestion, ActivityQuestionChoice,
    ActivitySubmission, Module, Subject, Teacher, TeacherClassAssignment, User,
)
from app.schemas.schemas import ModuleOut
from app.schemas import ActivitySubmitRequest

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


# ── GET /teacher/me/class/{class_id}/students ─────────────────────────────────

@router.get("/me/class/{class_id}/students", summary="Get students enrolled in a class")
async def get_class_students(
    class_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all students enrolled in any section that belongs to the given class.
    The teacher must be assigned to this class (via teacher_class_assignments).
    """
    from app.models.models import TeacherClassAssignment
    result = await db.execute(
        select(TeacherClassAssignment).where(
            TeacherClassAssignment.teacher_id == teacher.id,
            TeacherClassAssignment.class_id == class_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=403, detail="You are not assigned to this class")

    from app.models.models import Section, StudentSectionAssignment, Student, User
    result = await db.execute(
        select(Section).where(Section.class_id == class_id)
    )
    sections = result.scalars().all()
    section_ids = [s.id for s in sections]
    if not section_ids:
        return []

    result = await db.execute(
        select(Student)
        .options(selectinload(Student.user))
        .join(Student.section_assignments)
        .where(StudentSectionAssignment.section_id.in_(section_ids))
        .distinct()
    )
    students = result.scalars().all()

    return [
        {
            "id": s.id,
            "student_number": s.student_number,
            "user": {
                "id": s.user.id,
                "first_name": s.user.first_name,
                "last_name": s.user.last_name,
                "email": s.user.email,
                "is_active": s.user.is_active,
            }
        }
        for s in students
    ]


# ── POST /teacher/me/modules/upload ──────────────────────────────────────────

@router.post("/me/modules/upload", summary="Upload PDF file for a module")
async def upload_module_file(
    file: UploadFile = File(...),
    teacher: Teacher = Depends(get_current_teacher),
):
    """Upload a PDF file. Returns the file_url to use when creating the module."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

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


# ── GET /teacher/files/{filename} ────────────────────────────────────────────

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


# ── POST /teacher/me/modules ──────────────────────────────────────────────────

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
    assigned_subject_ids = {a.subject_id for a in teacher.class_assignments}
    if subject_id not in assigned_subject_ids:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to this subject"
        )

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


# ── DELETE /teacher/me/modules/{module_id} ────────────────────────────────────

@router.delete(
    "/me/modules/{module_id}",
    summary="Delete one of my modules",
    status_code=status.HTTP_200_OK,
)
async def delete_my_module(
    module_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a module that belongs to this teacher.
    Returns 403 if the module belongs to a different teacher.
    """
    result = await db.execute(
        select(Module).where(Module.id == module_id)
    )
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if module.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="You can only delete your own modules")

    if module.file_url:
        filename = module.file_url.split("/")[-1]
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)

    await db.delete(module)
    await db.flush()
    return {"message": "Module deleted successfully", "id": module_id}


# ══════════════════════════════════════════════════════════════════════════════
# STUDENT PORTAL
# ══════════════════════════════════════════════════════════════════════════════

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


# ── Auto-grade helper ─────────────────────────────────────────────────────────

def _auto_grade(question: ActivityQuestion, answer_value: Optional[str]):
    """Returns (is_correct, points_earned). Returns (None, None) for essay/manual."""
    if answer_value is None:
        return (False, 0) if question.question_type != "essay" else (None, None)

    if question.question_type == "multiple_choice":
        correct = str(question.correct_answer or "").strip()
        ok = answer_value.strip() == correct
        return (ok, question.points if ok else 0)

    elif question.question_type == "checkbox":
        try:
            correct = set(json.loads(question.correct_answer or "[]"))
            given   = set(json.loads(answer_value or "[]"))
            ok = correct == given
        except Exception:
            ok = False
        return (ok, question.points if ok else 0)

    elif question.question_type == "fill_blank":
        ok = answer_value.strip().lower() == (question.correct_answer or "").strip().lower()
        return (ok, question.points if ok else 0)

    # essay → manual grading
    return (None, None)


# ── GET /student/me/modules ───────────────────────────────────────────────────

@student_router.get("/me/modules", response_model=list[ModuleOut], summary="Get modules for my subjects")
async def get_student_modules(
    subject_id: Optional[int] = Query(None),
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Returns published modules for the classes the student is enrolled in."""
    from app.models.models import StudentSectionAssignment, Section

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


# ── GET /student/me/subjects ──────────────────────────────────────────────────

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


# ── GET /student/me/activities ────────────────────────────────────────────────

@student_router.get("/me/activities", summary="Get published activities for my subjects")
async def get_student_activities(
    subject_id: Optional[int] = Query(None),
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all published activities for the student's enrolled subjects.
    Correct answers are never exposed — students only see questions and choices.
    """
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
        .where(TeacherClassAssignment.class_id.in_(class_ids))
    )
    subject_ids = {a.subject_id for a in result.scalars().all()}
    if subject_id:
        subject_ids = subject_ids & {subject_id}
    if not subject_ids:
        return []

    q = (
        select(Activity)
        .options(
            selectinload(Activity.questions).selectinload(ActivityQuestion.choices)
        )
        .where(
            Activity.subject_id.in_(subject_ids),
            Activity.is_published == True,
        )
        .order_by(Activity.due_date.asc().nullsfirst(), Activity.created_at.desc())
    )
    activities = (await db.execute(q)).scalars().all()

    # Check which activities the student already submitted
    if activities:
        sub_result = await db.execute(
            select(ActivitySubmission).where(
                ActivitySubmission.student_id == student.id,
                ActivitySubmission.activity_id.in_([a.id for a in activities]),
            )
        )
        submitted_ids = {s.activity_id for s in sub_result.scalars().all()}
    else:
        submitted_ids = set()

    out = []
    for act in activities:
        questions = []
        for q in act.questions:
            questions.append({
                "id": q.id,
                "order": q.order,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "points": q.points,
                # correct_answer intentionally omitted for students
                "choices": [
                    {"id": c.id, "order": c.order, "choice_text": c.choice_text}
                    for c in q.choices
                ],
            })
        # Compute due/open status
        from datetime import timezone as _tz
        _now = __import__("datetime").datetime.now(_tz.utc)
        def _aw(dt):
            if dt is None: return None
            return dt if dt.tzinfo else dt.replace(tzinfo=_tz.utc)
        _due = _aw(act.due_date)
        _start = _aw(act.start_date)
        _past_due = (_due is not None) and (_now > _due)
        _is_open = (_start is None) or (_now >= _start)
        _sub = act.id in submitted_ids
        if _sub:
            _status = "submitted"
        elif _past_due:
            _status = "past_due"
        elif not _is_open:
            _status = "not_open"
        else:
            _status = "open"

        out.append({
            "id": act.id,
            "title": act.title,
            "description": act.description,
            "instructions": act.instructions,
            "activity_type": act.activity_type,
            "activity_type_custom": act.activity_type_custom,
            "format_type": act.format_type,
            "grading_mode": act.grading_mode,
            "subject_id": act.subject_id,
            "module_id": act.module_id,
            "max_score": act.max_score,
            "start_date": act.start_date.isoformat() if act.start_date else None,
            "due_date": act.due_date.isoformat() if act.due_date else None,
            "is_past_due": _past_due,
            "can_answer": _is_open and not _past_due and not _sub,
            "status": _status,
            "submission": None,
            "questions": questions,
            "already_submitted": _sub,
        })
    return out


# ── POST /student/me/activities/{activity_id}/submit ──────────────────────────

# ── GET /student/me/activities/{activity_id} ─────────────────────────────────

@student_router.get(
    "/me/activities/{activity_id}",
    summary="Get one activity with questions for answering",
)
async def get_student_activity_detail(
    activity_id: int,
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a single published activity with questions (correct answers hidden).
    Also returns whether the student has already submitted and the current status.
    """
    import json as _json
    from datetime import timezone as _tz

    result = await db.execute(
        select(Activity)
        .options(selectinload(Activity.questions).selectinload(ActivityQuestion.choices))
        .where(Activity.id == activity_id, Activity.is_published == True)
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Check submission
    sub_result = await db.execute(
        select(ActivitySubmission).where(
            ActivitySubmission.activity_id == activity_id,
            ActivitySubmission.student_id == student.id,
        )
    )
    submission = sub_result.scalar_one_or_none()

    # Due date / open window checks
    def _as_aware(dt):
        if dt is None:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=_tz.utc)

    now_utc = __import__("datetime").datetime.now(_tz.utc)
    due = _as_aware(activity.due_date)
    start = _as_aware(activity.start_date)

    is_past_due = (due is not None) and (now_utc > due)
    is_open = (start is None) or (now_utc >= start)
    can_answer = is_open and not is_past_due and submission is None

    if submission and submission.is_graded:
        status_val = "graded"
    elif submission:
        status_val = "submitted"
    elif is_past_due:
        status_val = "past_due"
    elif not is_open:
        status_val = "not_open"
    else:
        status_val = "open"

    questions = []
    for q in sorted(activity.questions, key=lambda x: x.order):
        questions.append({
            "id": q.id,
            "order": q.order,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "points": q.points,
            "choices": [
                {"id": c.id, "order": c.order, "choice_text": c.choice_text}
                for c in sorted(q.choices, key=lambda x: x.order)
            ],
        })

    return {
        "id": activity.id,
        "title": activity.title,
        "description": activity.description,
        "instructions": activity.instructions,
        "activity_type": activity.activity_type,
        "activity_type_custom": activity.activity_type_custom,
        "format_type": activity.format_type,
        "grading_mode": activity.grading_mode,
        "subject_id": activity.subject_id,
        "module_id": activity.module_id,
        "max_score": activity.max_score,
        "start_date": activity.start_date.isoformat() if activity.start_date else None,
        "due_date": activity.due_date.isoformat() if activity.due_date else None,
        "is_past_due": is_past_due,
        "can_answer": can_answer,
        "status": status_val,
        "questions": questions,
        "submission": {
            "id": submission.id,
            "submitted_at": submission.submitted_at.isoformat(),
            "score": submission.score,
            "max_score": submission.max_score,
            "grade": submission.grade,
            "remarks": submission.remarks,
            "is_graded": submission.is_graded,
        } if submission else None,
    }


@student_router.post(
    "/me/activities/{activity_id}/submit",
    status_code=status.HTTP_201_CREATED,
    summary="Submit answers for an activity",
)
async def submit_activity(
    activity_id: int,
    body: ActivitySubmitRequest,
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit answers for a published activity.
    - Auto-gradable formats (multiple_choice, checkbox, fill_blank) are scored immediately.
    - Essay / hybrid / assignment formats are queued for manual teacher grading.
    - Returns 409 if the student already submitted this activity.
    """
    # 1. Load activity with questions
    result = await db.execute(
        select(Activity)
        .options(selectinload(Activity.questions).selectinload(ActivityQuestion.choices))
        .where(Activity.id == activity_id, Activity.is_published == True)
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # 2. Prevent duplicate submission
    existing = await db.execute(
        select(ActivitySubmission).where(
            ActivitySubmission.activity_id == activity_id,
            ActivitySubmission.student_id == student.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already submitted")

    # 3. Build answer lookup {question_id: answer_value}
    answer_map = {a.question_id: a.answer_value for a in body.answers}

    # 4. Create submission record
    submission = ActivitySubmission(
        activity_id=activity_id,
        student_id=student.id,
    )
    db.add(submission)
    await db.flush()

    # 5. Grade each question and persist answers
    total_score = 0
    max_score   = 0
    has_manual  = False

    for question in activity.questions:
        answer_value = answer_map.get(question.id)
        is_correct, points_earned = _auto_grade(question, answer_value)

        db.add(ActivityAnswer(
            submission_id=submission.id,
            question_id=question.id,
            answer_value=answer_value,
            is_correct=is_correct,
            points_earned=points_earned,
        ))

        max_score += question.points
        if points_earned is not None:
            total_score += points_earned
        else:
            has_manual = True

    # 6. Finalize score
    submission.max_score = activity.max_score or max_score
    if not has_manual:
        submission.score     = total_score
        submission.is_graded = True
    else:
        submission.score     = None  # teacher will fill in
        submission.is_graded = False

    await db.flush()

    return {
        "submission_id": submission.id,
        "is_graded": submission.is_graded,
        "score": submission.score,
        "max_score": submission.max_score,
        "message": (
            f"Submitted! You scored {total_score}/{max_score}."
            if submission.is_graded
            else "Submitted! Your teacher will grade this activity."
        ),
    }


# ── GET /student/me/activities/{activity_id}/result ───────────────────────────

@student_router.get(
    "/me/activities/{activity_id}/result",
    summary="Get my submission result for an activity",
)
async def get_my_result(
    activity_id: int,
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Returns the student's own submission result including per-answer correctness."""
    result = await db.execute(
        select(ActivitySubmission)
        .options(selectinload(ActivitySubmission.answers))
        .where(
            ActivitySubmission.activity_id == activity_id,
            ActivitySubmission.student_id == student.id,
        )
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="No submission found")

    return {
        "submission_id": submission.id,
        "activity_id": submission.activity_id,
        "submitted_at": submission.submitted_at.isoformat(),
        "is_graded": submission.is_graded,
        "score": submission.score,
        "max_score": submission.max_score,
        "grade": submission.grade,
        "remarks": submission.remarks,
        "answers": [
            {
                "question_id": a.question_id,
                "answer_value": a.answer_value,
                "is_correct": a.is_correct,
                "points_earned": a.points_earned,
            }
            for a in submission.answers
        ],
    }
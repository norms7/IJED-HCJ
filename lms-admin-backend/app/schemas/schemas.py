"""
Pydantic v2 schemas — request bodies, responses, and shared types.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    full_name: str


# ── Role ──────────────────────────────────────────────────────────────────────

class RoleOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


# ── User ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Min 8 chars")
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role_id: int

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    role_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8)


class UserOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    is_active: bool
    created_at: datetime
    role: RoleOut

    model_config = {"from_attributes": True}

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class UserListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[UserOut]


# ── Subject ───────────────────────────────────────────────────────────────────

class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None


class SubjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Class ─────────────────────────────────────────────────────────────────────

class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    grade_level: Optional[str] = None
    school_year: Optional[str] = None


class ClassOut(BaseModel):
    id: int
    name: str
    grade_level: Optional[str] = None
    school_year: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


# ── Section ───────────────────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    class_id: int


class SectionOut(BaseModel):
    id: int
    name: str
    class_id: int

    model_config = {"from_attributes": True}


# ── Teacher ───────────────────────────────────────────────────────────────────

class TeacherCreate(BaseModel):
    user_id: int
    employee_id: Optional[str] = None
    specialization: Optional[str] = None
    contact_number: Optional[str] = None


class AssignClassRequest(BaseModel):
    teacher_id: int
    class_id: int
    subject_id: int
    schedule: Optional[str] = Field(None, example="MWF 8:00-9:00 AM")


class TeacherAssignmentOut(BaseModel):
    id: int
    class_: ClassOut
    subject: SubjectOut
    schedule: Optional[str] = None
    assigned_at: datetime

    model_config = {"from_attributes": True}


class TeacherOut(BaseModel):
    id: int
    user: UserOut
    employee_id: Optional[str] = None
    specialization: Optional[str] = None
    contact_number: Optional[str] = None
    class_assignments: list[TeacherAssignmentOut] = []

    model_config = {"from_attributes": True}


class TeacherListResponse(BaseModel):
    total: int
    items: list[TeacherOut]


# ── Student ───────────────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    user_id: int
    student_number: Optional[str] = None
    contact_number: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_contact: Optional[str] = None


class AssignSectionRequest(BaseModel):
    student_id: int
    section_id: int


class StudentSectionOut(BaseModel):
    id: int
    section: SectionOut
    enrolled_at: datetime

    model_config = {"from_attributes": True}


class StudentOut(BaseModel):
    id: int
    user: UserOut
    student_number: Optional[str] = None
    contact_number: Optional[str] = None
    guardian_name: Optional[str] = None
    section_assignments: list[StudentSectionOut] = []

    model_config = {"from_attributes": True}


class StudentListResponse(BaseModel):
    total: int
    items: list[StudentOut]


# ── Module ────────────────────────────────────────────────────────────────────

class ModuleCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    class_id: Optional[int] = None
    subject_id: Optional[int] = None
    order: int = 0
    is_published: bool = False


class ModuleUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    class_id: Optional[int] = None
    subject_id: Optional[int] = None
    order: Optional[int] = None
    is_published: Optional[bool] = None


class ModuleOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    class_id: Optional[int] = None
    subject_id: Optional[int] = None
    order: int
    is_published: bool
    created_at: datetime
    activity_count: int = 0

    model_config = {"from_attributes": True}


# ── Activity ──────────────────────────────────────────────────────────────────

VALID_ACTIVITY_TYPES = {"assignment", "quiz", "reading", "project"}


class ActivityCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    activity_type: str = "assignment"
    module_id: int
    max_score: Optional[int] = Field(None, ge=0)
    due_date: Optional[datetime] = None
    is_published: bool = False

    @field_validator("activity_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_ACTIVITY_TYPES:
            raise ValueError(f"activity_type must be one of {VALID_ACTIVITY_TYPES}")
        return v


class ActivityUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    activity_type: Optional[str] = None
    max_score: Optional[int] = Field(None, ge=0)
    due_date: Optional[datetime] = None
    is_published: Optional[bool] = None


class ActivityOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    activity_type: str
    module_id: int
    max_score: Optional[int] = None
    due_date: Optional[datetime] = None
    is_published: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_users: int
    total_admins: int
    total_teachers: int
    total_students: int
    total_classes: int
    total_modules: int
    total_activities: int
    recent_users: list[UserOut]


# ── Generic ───────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    id: Optional[int] = None

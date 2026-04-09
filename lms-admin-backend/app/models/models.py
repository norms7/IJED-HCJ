"""
SQLAlchemy ORM models for the LMS Admin module.
All tables use Integer PKs for simplicity; swap to UUID if preferred.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text,
    UniqueConstraint, func, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── roles ─────────────────────────────────────────────────────────────────────

class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # admin | teacher | student

    users: Mapped[list["User"]] = relationship("User", back_populates="role")


# ── users ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_role_id", "role_id"),
        Index("ix_users_is_active", "is_active"),
        Index("ix_users_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )

    role: Mapped["Role"] = relationship("Role", back_populates="users")
    teacher_profile: Mapped[Optional["Teacher"]] = relationship(
        "Teacher", back_populates="user", uselist=False
    )
    student_profile: Mapped[Optional["Student"]] = relationship(
        "Student", back_populates="user", uselist=False
    )


# ── subjects ──────────────────────────────────────────────────────────────────

class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    teacher_assignments: Mapped[list["TeacherClassAssignment"]] = relationship(
        "TeacherClassAssignment", back_populates="subject"
    )
    modules: Mapped[list["Module"]] = relationship("Module", back_populates="subject")


# ── classes ───────────────────────────────────────────────────────────────────

class Class(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    grade_level: Mapped[Optional[str]] = mapped_column(String(50))
    school_year: Mapped[Optional[str]] = mapped_column(String(20))  # e.g. "2024-2025"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    sections: Mapped[list["Section"]] = relationship("Section", back_populates="class_")
    teacher_assignments: Mapped[list["TeacherClassAssignment"]] = relationship(
        "TeacherClassAssignment", back_populates="class_"
    )
    modules: Mapped[list["Module"]] = relationship("Module", back_populates="class_")


# ── sections ──────────────────────────────────────────────────────────────────

class Section(Base):
    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), nullable=False)

    class_: Mapped["Class"] = relationship("Class", back_populates="sections")
    student_assignments: Mapped[list["StudentSectionAssignment"]] = relationship(
        "StudentSectionAssignment", back_populates="section"
    )


# ── teachers ──────────────────────────────────────────────────────────────────

class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    employee_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True)
    specialization: Mapped[Optional[str]] = mapped_column(String(150))
    contact_number: Mapped[Optional[str]] = mapped_column(String(30))

    user: Mapped["User"] = relationship("User", back_populates="teacher_profile")
    class_assignments: Mapped[list["TeacherClassAssignment"]] = relationship(
        "TeacherClassAssignment", back_populates="teacher"
    )
    modules: Mapped[list["Module"]] = relationship("Module", back_populates="teacher")


# ── teacher_class_assignments ─────────────────────────────────────────────────

class TeacherClassAssignment(Base):
    __tablename__ = "teacher_class_assignments"
    __table_args__ = (
        UniqueConstraint("teacher_id", "class_id", "subject_id", name="uq_teacher_class_subject"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    schedule: Mapped[Optional[str]] = mapped_column(String(255))  # e.g. "MWF 8:00-9:00"
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    teacher: Mapped["Teacher"] = relationship("Teacher", back_populates="class_assignments")
    class_: Mapped["Class"] = relationship("Class", back_populates="teacher_assignments")
    subject: Mapped["Subject"] = relationship("Subject", back_populates="teacher_assignments")


# ── students ──────────────────────────────────────────────────────────────────

class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    student_number: Mapped[Optional[str]] = mapped_column(String(50), unique=True)
    contact_number: Mapped[Optional[str]] = mapped_column(String(30))
    guardian_name: Mapped[Optional[str]] = mapped_column(String(200))
    guardian_contact: Mapped[Optional[str]] = mapped_column(String(30))

    user: Mapped["User"] = relationship("User", back_populates="student_profile")
    section_assignments: Mapped[list["StudentSectionAssignment"]] = relationship(
        "StudentSectionAssignment", back_populates="student"
    )


# ── student_section_assignments ───────────────────────────────────────────────

class StudentSectionAssignment(Base):
    __tablename__ = "student_section_assignments"
    __table_args__ = (
        UniqueConstraint("student_id", "section_id", name="uq_student_section"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"), nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    student: Mapped["Student"] = relationship("Student", back_populates="section_assignments")
    section: Mapped["Section"] = relationship("Section", back_populates="student_assignments")


# ── modules ───────────────────────────────────────────────────────────────────

class Module(Base):
    __tablename__ = "modules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    class_id: Mapped[Optional[int]] = mapped_column(ForeignKey("classes.id"))
    subject_id: Mapped[Optional[int]] = mapped_column(ForeignKey("subjects.id"))
    teacher_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teachers.id"))
    order: Mapped[int] = mapped_column(Integer, default=0)
    term: Mapped[Optional[str]] = mapped_column(String(20))  # 1st, 2nd, 3rd, 4th
    file_url: Mapped[Optional[str]] = mapped_column(String(500))
    file_name: Mapped[Optional[str]] = mapped_column(String(255))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    class_: Mapped[Optional["Class"]] = relationship("Class", back_populates="modules")
    subject: Mapped[Optional["Subject"]] = relationship("Subject", back_populates="modules")
    teacher: Mapped[Optional["Teacher"]] = relationship("Teacher", back_populates="modules")
    activities: Mapped[list["Activity"]] = relationship(
        "Activity", back_populates="module", cascade="all, delete-orphan"
    )


# ── activities ────────────────────────────────────────────────────────────────

class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    activity_type: Mapped[str] = mapped_column(
        String(50), default="assignment"
    )  # assignment | quiz | reading | project
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"), nullable=False)
    max_score: Mapped[Optional[int]] = mapped_column(Integer)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    module: Mapped["Module"] = relationship("Module", back_populates="activities")
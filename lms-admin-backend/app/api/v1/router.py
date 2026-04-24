from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.teachers import router as teachers_router
from app.api.v1.endpoints.students import router as students_router
from app.api.v1.endpoints.modules import modules_router, activities_router
from app.api.v1.endpoints.classes import classes_router, sections_router, subjects_router
from app.api.v1.endpoints.teacher_portal import router as teacher_portal_router
from app.api.v1.endpoints.teacher_portal import student_router as student_portal_router
from app.api.v1.endpoints.teacher_activities import activity_router as teacher_activity_router
from app.api.v1.endpoints.student_activities import student_activity_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(users_router)
api_router.include_router(teachers_router)
api_router.include_router(students_router)
api_router.include_router(modules_router)
api_router.include_router(activities_router)
api_router.include_router(classes_router)
api_router.include_router(sections_router)
api_router.include_router(subjects_router)
api_router.include_router(teacher_portal_router)
api_router.include_router(student_portal_router)
api_router.include_router(teacher_activity_router)
api_router.include_router(student_activity_router)
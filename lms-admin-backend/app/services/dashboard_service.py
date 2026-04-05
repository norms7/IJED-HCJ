from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.models import User, Role, Module, Activity
from app.schemas.schemas import DashboardStats
from app.services.user_service import get_recent_users


async def get_dashboard_stats(db: AsyncSession) -> DashboardStats:
    # Single query: count users per role
    role_counts_q = (
        select(Role.name, func.count(User.id).label("cnt"))
        .join(User, User.role_id == Role.id)
        .where(User.is_active == True)
        .group_by(Role.name)
    )
    role_rows = (await db.execute(role_counts_q)).all()
    counts_by_role = {row.name: row.cnt for row in role_rows}

    total_users = sum(counts_by_role.values())
    total_admins = counts_by_role.get("admin", 0)
    total_teachers = counts_by_role.get("teacher", 0)
    total_students = counts_by_role.get("student", 0)

    # Classes (active)
    from app.models.models import Class
    total_classes = (
        await db.execute(select(func.count()).select_from(Class).where(Class.is_active == True))
    ).scalar_one()

    total_modules = (
        await db.execute(select(func.count()).select_from(Module))
    ).scalar_one()

    total_activities = (
        await db.execute(select(func.count()).select_from(Activity))
    ).scalar_one()

    recent = await get_recent_users(db, limit=5)

    return DashboardStats(
        total_users=total_users,
        total_admins=total_admins,
        total_teachers=total_teachers,
        total_students=total_students,
        total_classes=total_classes,
        total_modules=total_modules,
        total_activities=total_activities,
        recent_users=recent,
    )

# IJED Learning Management System

<p align="center">
  <img src="lms-frontend/assets/images/logo.png" alt="IJED Logo" width="120"/>
</p>

<p align="center">
  A full-stack Learning Management System for <strong>Imelda Justice Education for Development (IJED)</strong>,<br>
  built for <strong>Infant Jesus Learning Academy</strong>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python" alt="Python"/>
  <img src="https://img.shields.io/badge/PostgreSQL-Async-336791?logo=postgresql" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Frontend-HTML%2FCSS%2FJS-F7DF1E?logo=javascript" alt="Frontend"/>
  <img src="https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens" alt="JWT"/>
</p>

---

## Overview

IJED LMS is a web-based Learning Management System designed for school administrators, teachers, and students. It provides role-based dashboards, user management, course modules, activity tracking, and more — all backed by a modern async FastAPI API.

---

## Features

| Role | Capabilities |
|------|-------------|
| **Admin** | Manage users, teachers, students, classes, sections, subjects, modules |
| **Teacher** | View assigned subjects, manage modules & activities, record grades |
| **Student** | Access modules, submit activities, view grades and calendar |

**Core highlights:**
- Role-based access control (Admin / Teacher / Student)
- JWT authentication with bcrypt password hashing
- Full CRUD for users, teachers, students, modules, and activities
- Async PostgreSQL with SQLAlchemy 2.0 (Supabase-compatible)
- Alembic database migrations
- Responsive sidebar UI with dark mode
- Toast notifications, modal system, and live clock
- MVC-patterned vanilla JS frontend

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend Framework | FastAPI 0.111 |
| Language | Python 3.12 |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL (local or Supabase) |
| Migrations | Alembic 1.13 |
| Auth | JWT (`python-jose`) + bcrypt (`passlib`) |
| Validation | Pydantic v2 |
| Server | Uvicorn |
| Frontend | Vanilla HTML / CSS / JavaScript (MVC pattern) |

---

## Project Structure

```
IJED/
├── lms-admin-backend/            # FastAPI backend
│   ├── app/
│   │   ├── main.py               # App factory, CORS, error handlers
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py     # Aggregates all routers
│   │   │       └── endpoints/
│   │   │           ├── auth.py
│   │   │           ├── dashboard.py
│   │   │           ├── users.py
│   │   │           ├── teachers.py
│   │   │           ├── students.py
│   │   │           ├── modules.py
│   │   │           └── classes.py
│   │   ├── core/
│   │   │   ├── config.py         # Pydantic settings (reads .env)
│   │   │   └── security.py       # JWT + bcrypt + auth dependency
│   │   ├── db/
│   │   │   └── session.py        # Async engine, session factory, Base
│   │   ├── models/
│   │   │   └── models.py         # All SQLAlchemy ORM models
│   │   ├── schemas/
│   │   │   └── schemas.py        # All Pydantic v2 request/response schemas
│   │   └── services/             # Business logic layer
│   │       ├── auth_service.py
│   │       ├── dashboard_service.py
│   │       ├── user_service.py
│   │       ├── teacher_service.py
│   │       ├── student_service.py
│   │       └── module_service.py
│   ├── alembic/
│   │   └── versions/
│   │       └── 001_initial.py    # Full schema + roles seed
│   ├── seed.py                   # Bootstrap script (users + sample data)
│   ├── requirements.txt
│   ├── alembic.ini
│   └── .env.example
│
└── lms-frontend/                 # Vanilla JS frontend (MVC)
    ├── index.html                # Single-page app shell
    ├── assets/
    │   ├── css/
    │   │   ├── main.css          # CSS variables, reset, base styles
    │   │   ├── layout.css        # Sidebar, topbar, page layout
    │   │   └── components.css    # Cards, tables, modals, badges
    │   ├── js/
    │   │   ├── app.js            # Entry point (bootstraps App.init)
    │   │   └── lms-admin-api.js  # API client class (LMSAdminAPI)
    │   └── images/
    │       └── logo.png
    ├── controllers/
    │   └── controllers.js        # App, Auth, Dashboard, feature controllers
    ├── models/
    │   └── models.js             # Local data models (mock/offline layer)
    ├── utils/
    │   └── utils.js              # Storage, Toast, Modal, Validate helpers
    └── views/
        └── views.js              # HTML template renderers per section
```

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js (optional, for tooling)
- PostgreSQL 14+ (or a free [Supabase](https://supabase.com) project)
- A code editor (VS Code recommended)

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/IJED.git
cd IJED
```

---

### 2. Set Up the Backend

```bash
cd lms-admin-backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Local PostgreSQL
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/lms_db

# OR Supabase
# DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

# Generate a secure key: openssl rand -hex 32
SECRET_KEY=your-secret-key-here

ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Space-separated list of allowed frontend origins
CORS_ORIGINS=http://localhost:5500 http://127.0.0.1:5500
```

---

### 4. Run Database Migrations

```bash
# Create the database (skip if using Supabase)
createdb lms_db

# Apply all migrations — creates tables and seeds roles
alembic upgrade head
```

---

### 5. Seed Sample Data

```bash
python seed.py
```

This creates the following default accounts:

| Email | Password | Role |
|-------|----------|------|
| `admin@lms.edu` | `Admin@1234` | admin |
| `teacher@lms.edu` | `Teacher@1234` | teacher |
| `student@lms.edu` | `Student@1234` | student |

---

### 6. Start the Backend Server

```bash
uvicorn app.main:app --reload --port 8000
```

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health Check:** http://localhost:8000/health

---

### 7. Open the Frontend

Open `lms-frontend/index.html` directly in your browser, or serve it with VS Code Live Server (port 5500).

> Make sure `CORS_ORIGINS` in your `.env` includes your frontend's address.

---

## API Reference

### Authentication

```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@lms.edu",
  "password": "Admin@1234"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user_id": 1,
  "role": "admin",
  "full_name": "System Admin"
}
```

Use the token on every subsequent request:
```http
Authorization: Bearer eyJhbGci...
```

---

### Endpoints Summary

| Resource | Methods | Base Path |
|----------|---------|-----------|
| Auth | POST | `/auth/login` |
| Dashboard | GET | `/admin/dashboard/stats` |
| Users | GET, POST, PUT, DELETE | `/admin/users` |
| Teachers | GET, POST | `/admin/teachers` |
| Students | GET, POST | `/admin/students` |
| Classes | GET, POST | `/admin/classes` |
| Sections | GET, POST | `/admin/sections` |
| Subjects | GET, POST | `/admin/subjects` |
| Modules | GET, POST, PUT, DELETE | `/admin/modules` |
| Activities | GET, POST, PUT, DELETE | `/admin/activities` |

Full interactive docs available at `/docs` when the server is running.

---

## Database Schema

```
roles (1) ──< users (1) ──< teachers (1) ──< teacher_class_assignments
                      │                              │            │
                      │                           classes      subjects
                      │                              │
                      └──< students (1) ──< student_section_assignments
                                                     │
                                                  sections >── classes
classes ──< modules ──< activities
```

---

## Using the API Client (Frontend)

The `lms-admin-api.js` file is a drop-in JavaScript class for interacting with the backend:

```javascript
const api = new LMSAdminAPI("http://localhost:8000");

// Login
await api.login("admin@lms.edu", "Admin@1234");

// Fetch dashboard stats
const stats = await api.getDashboardStats();

// List users
const users = await api.getUsers({ role: "teacher", is_active: true });

// Create a module
await api.createModule({
  title: "Introduction to Algebra",
  class_id: 1,
  subject_id: 2,
  is_published: true,
});
```

---

## Deployment

### Backend (e.g., Render, Railway, Fly.io)

1. Set all environment variables from `.env` in your platform's dashboard.
2. Set the start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add your deployed frontend URL to `CORS_ORIGINS`.

### Frontend (e.g., Vercel, Netlify, GitHub Pages)

1. Update the `LMSAdminAPI` base URL in `controllers/controllers.js` to your deployed backend URL.
2. Deploy the `lms-frontend/` folder as a static site.

### Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the **Connection string (URI)** from **Settings → Database**.
3. Replace `postgresql://` with `postgresql+asyncpg://` in your `DATABASE_URL`.
4. Run `alembic upgrade head` — Alembic handles all table creation.

---

## Development Notes

- **Soft deletes** — Users are deactivated (`is_active=false`) and never hard-deleted.
- **Async throughout** — All DB calls use `await`; the engine is configured for production concurrency.
- **Global error handling** — `IntegrityError` returns a clean 409; all unhandled exceptions return 500 with a safe message.
- **Migrations** — Always use `alembic revision --autogenerate -m "description"` for schema changes. Never edit tables manually.
- **Frontend MVC** — `models.js` handles data, `views.js` renders HTML, `controllers.js` wires logic, `utils.js` provides shared helpers.

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to your branch: `git push origin feature/your-feature-name`
5. Open a Pull Request.

---

## License

This project is developed for **Infant Jesus Learning Academy** (Imelda Justice Education for Development). All rights reserved.

---

<p align="center">Built with ❤️ for IJED · Infant Jesus Learning Academy</p>

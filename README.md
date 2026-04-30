# Taskly

A task management system where users can register, create projects, add tasks, and assign them to teammates.

**Stack:** Node.js · Supabase (PostgreSQL) · React + TypeScript + Vite · Docker

---

## 1. Overview

Taskly is a full-stack task management application built with a Node.js/Express backend and a React SPA frontend. The backend connects to Supabase (PostgreSQL) for data persistence and uses JWT-based authentication with access and refresh tokens. The frontend is a Vite + React + TypeScript app featuring a modern, minimal UI with dark/light theme support, a Kanban board with drag-and-drop, and real-time updates via Server-Sent Events.

| Layer | Choice |
|---|---|
| API | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Auth | JWT HS256 + refresh tokens |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Custom CSS with CSS Variables |

---

## 2. Features

- **Authentication** — Register, login, logout with JWT access + refresh token rotation
- **Projects** — Create, edit, delete projects with ownership control
- **Kanban Board** — Drag-and-drop tasks across 4 status columns (To Do, In Progress, Review, Done)
- **Task Management** — Create, edit, assign, prioritize, and set due dates for tasks
- **Real-time Updates** — Server-Sent Events for live task synchronization
- **Dark/Light Theme** — Smooth animated theme switching with localStorage persistence
- **Responsive Design** — Works across desktop, tablet, and mobile
- **Activity Feed** — Track project activity and task changes

---

## 3. Running Locally

> **Prerequisites:** Node.js 18+, npm

### Backend

```bash
cd backend
npm install
npm run dev   # http://localhost:3000 (or configured port)
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

The Vite dev server proxies API calls to the backend via `VITE_API_URL`.

---

## 4. Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key

# JWT
JWT_SECRET=your_jwt_secret
# Generate with: openssl rand -hex 32

# Server
PORT=3000
ENV=development

# Frontend
VITE_API_URL=http://localhost:3000
```

---

## 5. Running with Docker

```bash
# 1. Configure environment
cp .env.example .env
# Set your JWT_SECRET and Supabase credentials

# 2. Start everything
docker compose up

# Frontend  →  http://localhost:3000
# API       →  http://localhost:8080
# Health    →  http://localhost:8080/health
```

---

## 6. Test Credentials

| User | Email | Password |
|---|---|---|
| Amit ji (project owner) | `test@example.com` | `password123` |
| Narendra ji (teammate) | `narendra@example.com` | `password123` |

Amit ji owns a **Website Redesign** project with tasks in different statuses. Log in as Narendra ji to see assigned tasks.

---

## 7. API Reference

**Base URL:** `http://localhost:3000` (or your configured port)
All protected endpoints require `Authorization: Bearer <access_token>`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | `{name, email, password}` → `{access_token, refresh_token, user}` |
| POST | `/auth/login` | `{email, password}` → `{access_token, refresh_token, user}` |
| POST | `/auth/refresh` | `{refresh_token}` → new token pair (rotates old token) |
| POST | `/auth/logout` | `{refresh_token}` → 204 |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects?page=&limit=` | List all projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Project + all its tasks |
| PATCH | `/projects/:id` | Update name/description — owner only |
| DELETE | `/projects/:id` | Delete project + tasks — owner only |
| GET | `/projects/:id/stats` | Task counts by status and by assignee |
| GET | `/projects/:id/events` | SSE stream for real-time task events |

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects/:id/tasks?status=&assignee=&page=&limit=` | Filtered, paginated task list |
| POST | `/projects/:id/tasks` | `{title, description?, priority, assignee_id?, due_date?}` |
| PATCH | `/tasks/:id` | Update any of `{title, description, status, priority, assignee_id, due_date, clear_assignee}` |
| DELETE | `/tasks/:id` | Project owner or task creator only |

### Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | List all users (for assignee picker) |

### Error shape

```json
{ "error": "validation failed", "fields": { "email": "is required" } }
```

`400` validation · `401` unauthenticated · `403` forbidden · `404` not found

---

## 8. UI Design

Taskly features a premium, minimal design system inspired by Linear and Notion:

- **Muted teal accent** (`#5b9a8b`) across all interactive elements
- **Glassmorphism navbar** with backdrop blur
- **Mouse-following glow** on the authentication pages
- **Kanban columns** with subtle color-coded tints (gray, blue, amber, green)
- **Smooth animations** — page transitions, card stagger, hover lifts
- **8px spacing system** with consistent `10-14px` border radius

---

## 9. Project Structure

```
taskly/
├── backend/
│   ├── server.js          # Express server entry point
│   ├── routes/            # API route definitions
│   ├── middleware/         # Auth middleware
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/         # LoginPage, RegisterPage, ProjectsPage, ProjectDetailPage
│   │   ├── components/    # Navbar, KanbanBoard, TaskModal, etc.
│   │   ├── contexts/      # AuthContext
│   │   ├── hooks/         # useProjects, useProjectSSE, useToast
│   │   ├── api/           # API client functions
│   │   └── index.css      # Design system + all styles
│   └── index.html
├── docker-compose.yml
├── .env
└── README.md
```

---

## 10. What I'd Do With More Time

**Security**
- Rate limiting (token bucket per IP) on auth endpoints
- Refresh token reuse detection: if a rotated token is replayed, revoke the entire family
- Lock CORS to the frontend origin (currently `*`)

**Backend**
- `GET /users/me` so the frontend doesn't have to decode the JWT client-side
- Full-text task search (`?q=`)
- Activity history: log every task change with who made it and when

**Frontend**
- Notification system for task assignments
- Keyboard shortcuts for power users
- Mobile-optimized Kanban with swipe gestures

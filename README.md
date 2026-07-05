# TaskEasy — Workflow Management Platform

A full-stack, multi-tenant SaaS platform for task delegation, workflow management, approvals, MIS reporting, and team performance tracking.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, Zustand, React Query |
| Backend | NestJS 10, Prisma ORM, Passport JWT |
| Database | MongoDB (Atlas) |
| Cache & Queues | Redis, BullMQ |
| File Storage | Cloudinary |
| Real-time | Socket.IO |
| Deployment | Render (Blueprint included) |

## Features

- **Task Delegation** — Assign single or bulk tasks with priorities, deadlines, and attachments
- **Work Requests** — Raise and track inter-team work requests with approval workflows
- **Checklists** — Daily/weekly/monthly recurring checklists with auto-generation
- **FMS (Flow Management)** — Visual workflow builder with multi-step task pipelines
- **Kanban Board** — Drag-and-drop task management across custom columns
- **Approvals** — Multi-level review, scoring, and rework cycles
- **MIS & Reports** — Real-time dashboards, performance metrics, and exportable reports
- **Predictive AI** — Delay prediction, workload forecasting, and smart task suggestions
- **Calendar** — Unified view of deadlines across all modules
- **Automation** — Rule-based triggers for status changes, notifications, and escalations
- **Notifications** — In-app, email, and real-time push notifications
- **Bulk Import/Export** — Excel/CSV import for tasks, users, and checklists
- **Audit Logs** — Complete activity trail for compliance
- **Client & Vendor Portals** — External-facing dashboards for stakeholders
- **Platform Admin** — Multi-company management, billing, and security controls
- **Role-Based Access** — SAAS_OWNER, COMPANY_OWNER, ADMIN, MANAGER, TEAM_LEAD, EMPLOYEE, VIEWER, AUDITOR
- **SSO** — Google and Microsoft OAuth integration
- **2FA** — TOTP-based two-factor authentication
- **PWA** — Installable progressive web app with offline support

## Project Structure

```
TaskEasyApp/
├── apps/
│   ├── api/                  # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/      # Feature modules (delegation, fms, auth, etc.)
│   │   │   ├── common/       # Guards, decorators, interceptors, utils
│   │   │   ├── queue/        # BullMQ job processors
│   │   │   ├── redis/        # Redis service
│   │   │   └── config/       # App configuration
│   │   └── test/             # E2E tests
│   └── web/                  # Next.js frontend
│       ├── src/
│       │   ├── app/          # App router pages
│       │   │   ├── (app)/    # Authenticated workspace routes
│       │   │   ├── (auth)/   # Login, forgot/reset password
│       │   │   └── (platform)/ # Platform admin routes
│       │   ├── components/   # Reusable UI components
│       │   ├── hooks/        # React Query hooks for each module
│       │   ├── store/        # Zustand state stores
│       │   ├── lib/          # Axios client, utils, schemas
│       │   └── types/        # TypeScript type definitions
│       └── e2e/              # Playwright E2E tests
├── packages/
│   ├── shared-types/         # Shared TypeScript types
│   └── shared-utils/         # Shared utility functions
├── prisma/
│   └── schema.prisma         # Database schema (MongoDB)
├── render.yaml               # Render deployment blueprint
└── docker-compose.yml        # Local development stack
```

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB (local via Docker or MongoDB Atlas)
- Redis (local via Docker or cloud)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Saurabh19F/TaskEasy.git
   cd TaskEasy
   ```

2. **Start MongoDB and Redis**
   ```bash
   docker compose up -d
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Configure environment variables**
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```
   Edit the `.env` files with your database URL and secrets.

5. **Push database schema**
   ```bash
   npm run db:push
   ```

6. **Start development servers**
   ```bash
   # Terminal 1 — API (port 5000)
   npm run dev:api

   # Terminal 2 — Frontend (port 3000)
   npm run dev:web
   ```

7. **Open the app**
   Visit [http://localhost:3000](http://localhost:3000)

### Default Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@taskeasy.app | Admin@1234 |
| Admin | admin@taskeasy.app | Admin@1234 |
| Employee | employee@taskeasy.app | Employee@1234 |

## Deployment on Render

This project includes a `render.yaml` blueprint for one-click deployment.

### Prerequisites

1. **MongoDB Atlas** — Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. **Cloudinary** — Sign up at [cloudinary.com](https://cloudinary.com) for file uploads

### Deploy

1. Go to [render.com/dashboard](https://render.com/dashboard) → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render auto-creates 3 services:
   - `taskeasy-api` — NestJS backend
   - `taskeasy-web` — Next.js frontend
   - `taskeasy-redis` — Redis instance
4. Fill in the environment variables:
   - `DATABASE_URL` — MongoDB Atlas connection string
   - `NEXT_PUBLIC_API_URL` — Your API URL (e.g., `https://taskeasy-api.onrender.com/api`)
   - `CLOUDINARY_*` — Cloudinary credentials
   - `SMTP_*` — Email server credentials (optional)

### Docker (Self-hosted)

```bash
# Full stack with API + frontend
docker compose --profile full up -d

# API only (frontend runs locally)
docker compose up -d
```

## API Documentation

Once the API is running, Swagger docs are available at:
```
http://localhost:5000/api/docs
```

## Environment Variables

### API (`apps/api/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MongoDB connection string | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `JWT_REFRESH_SECRET` | Refresh token secret | Yes |
| `REDIS_HOST` | Redis host | Yes |
| `REDIS_PORT` | Redis port | Yes |
| `PORT` | API server port (default: 5000) | No |
| `FRONTEND_URL` | Frontend URL for CORS | No |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | No |
| `CLOUDINARY_API_KEY` | Cloudinary API key | No |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | No |
| `SMTP_HOST` | SMTP server host | No |
| `SMTP_PORT` | SMTP server port | No |
| `SMTP_USER` | SMTP username | No |
| `SMTP_PASS` | SMTP password | No |

### Frontend (`apps/web/.env.local`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | No |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Start API in watch mode |
| `npm run dev:web` | Start frontend dev server |
| `npm run build:api` | Build API for production |
| `npm run build:web` | Build frontend for production |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run typecheck` | Run TypeScript checks on both apps |

## License

Private — All rights reserved.

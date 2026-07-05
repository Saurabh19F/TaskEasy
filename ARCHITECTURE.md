# TaskEasy — System Architecture

> Super Advanced SaaS Workflow Management Platform  
> Stack: Next.js · NestJS · MongoDB Atlas · Prisma · Redis · BullMQ · Cloudinary · JWT RBAC

---

## 1. Vision

**TaskEasy = Workflow OS + MIS Engine + AI Task Manager + Company Productivity Platform**

A multi-tenant SaaS where companies manage tasks, approvals, checklists, FMS workflows, employee performance, project health, AI automation, and analytics from one unified platform.

---

## 2. Tech Stack

### Frontend
| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | ShadCN UI |
| API State | TanStack Query (React Query) |
| Global State | Zustand |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Tables | TanStack Table |
| Icons | Lucide React |
| DnD | dnd-kit |
| Notifications | Sonner |
| Date | date-fns |
| Export | xlsx + jsPDF |

### Backend
| Layer | Choice |
|---|---|
| Framework | NestJS |
| Language | TypeScript |
| API Style | REST |
| Validation | class-validator + class-transformer |
| Docs | Swagger / OpenAPI |
| Auth | JWT (access + refresh) |
| File Upload | Cloudinary |

### Database & Infra
| Layer | Choice |
|---|---|
| Database | MongoDB Atlas |
| ORM | Prisma |
| Cache | Redis (Upstash or self-hosted) |
| Queue | BullMQ |
| Email | Nodemailer / SendGrid |
| Push | Web Push API |
| Search | MongoDB Atlas Search |

---

## 3. System Design Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│   Browser (Next.js)    Mobile PWA     Client Portal    Vendor   │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTPS / REST
┌─────────────────▼───────────────────────────────────────────────┐
│                    NestJS API Gateway                            │
│   JWT Auth Guard → Role Guard → Permission Guard → Controller   │
│   Rate Limiting · Request Logging · Tenant Isolation            │
└────┬────────────┬────────────┬────────────┬─────────────────────┘
     │            │            │            │
┌────▼───┐  ┌────▼───┐  ┌────▼───┐  ┌────▼────────────────────┐
│ Prisma │  │ Redis  │  │BullMQ  │  │   Cloudinary            │
│MongoDB │  │ Cache  │  │Queues  │  │   (File Uploads)        │
│ Atlas  │  │        │  │        │  │                         │
└────────┘  └────────┘  └────────┘  └─────────────────────────┘
```

---

## 4. Multi-Tenancy Architecture

Every database document includes `tenantId`. The backend enforces isolation at the service layer — no query runs without a `tenantId` filter derived from the JWT, never from the request body.

### Tenant Data Flow
```
Login → JWT contains { userId, tenantId, role, permissions }
↓
Every request → TenantGuard extracts tenantId from JWT
↓
Service layer always queries with { where: { tenantId } }
↓
No cross-tenant data leakage possible
```

### Subscription Tiers (Plans)
| Feature | Starter | Pro | Enterprise |
|---|---|---|---|
| Users | 10 | 100 | Unlimited |
| Projects | 5 | Unlimited | Unlimited |
| FMS Workflows | 3 | Unlimited | Unlimited |
| AI Features | ❌ | ✅ | ✅ |
| Client Portal | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ |
| SLA Engine | Basic | Full | Full |
| Audit Logs | 30 days | 90 days | Forever |

---

## 5. Authentication Flow

```
POST /auth/login
↓
Validate credentials (bcrypt compare)
Check account status (active/locked)
Log login attempt
↓
Issue: accessToken (15min) + refreshToken (7d)
Store refreshToken in DB (hashed)
↓
Client stores accessToken in memory
Client stores refreshToken in httpOnly cookie
↓
On 401: POST /auth/refresh → new accessToken
On logout: revoke refreshToken
```

### Security Rules
- Password hashed with bcrypt (12 rounds)
- Account locked after 5 failed attempts (15min)
- Refresh token rotation on every use
- Optional TOTP 2FA
- All write actions → audit log entry
- Login history tracked per session (IP, device, timestamp)

---

## 6. RBAC + Permission System

### Roles Hierarchy
```
SaaS Owner
└── Company Owner
    └── Super Admin
        ├── Admin
        │   ├── Manager
        │   │   └── Team Lead
        │   │       └── Employee
        ├── Auditor (read-only cross-team)
        └── Viewer (read-only)
External:
├── Client User
└── Vendor User
```

### Permission Categories
| Category | Permissions |
|---|---|
| Users | user.create, user.read, user.update, user.delete, user.manage-roles |
| Projects | project.create, project.read, project.update, project.archive |
| Tasks | task.assign, task.read, task.submit, task.approve, task.rework, task.delete |
| Checklist | checklist.assign, checklist.complete, checklist.manage |
| FMS | fms.manage, fms.import, fms.complete, fms.publish |
| Workflow | workflow.create, workflow.publish, workflow.delete |
| MIS | mis.view, mis.export, mis.snapshot |
| Reports | report.view, report.export, report.schedule |
| Audit | audit.view, audit.export |
| Hierarchy | hierarchy.manage |
| Automation | automation.create, automation.manage |
| Settings | settings.company, settings.billing, settings.security |

### Guard Pipeline (Every API)
```
Request → JwtAuthGuard → TenantGuard → RoleGuard → PermissionGuard → Controller
```

---

## 7. Module Map

### Phase 1 — Core
| Module | Key Features |
|---|---|
| `auth` | Login, logout, refresh, forgot/reset password, 2FA |
| `tenants` | Company CRUD, settings, subscription, feature flags |
| `users` | CRUD, roles, departments, bulk import |
| `roles` | Custom roles, permission assignment |
| `projects` | CRUD, members, health score, SLA |
| `hierarchy` | Group creation, admin→employee mapping |
| `delegation` | Assign tasks, submit, approve, rework |
| `work-request` | Create, complete, approve, rework |
| `checklist` | Master creation, task generation, bulk complete |
| `uploads` | Cloudinary upload, delete, metadata |

### Phase 2 — Workflow Intelligence
| Module | Key Features |
|---|---|
| `fms` | Import, workflow builder, flow map, step tracking |
| `workflow` | Builder, conditions, publish, clone |
| `approval` | Multi-level, parallel, conditional |
| `dashboard` | Metrics, charts, drill-down, real-time |
| `mis` | Performance engine, KPIs, grades, snapshots |
| `reports` | Builder, export, schedule, share |
| `notifications` | In-app, email, push, digest |
| `audit` | Immutable log, search, export |

### Phase 3 — Power Features
| Module | Key Features |
|---|---|
| `sla-engine` | SLA tracking, breach detection, escalation |
| `kanban` | Board view, drag/drop |
| `calendar` | Day/week/month, drag reschedule |
| `comments` | Per-task comments, mentions, timeline |
| `import-export` | Excel/CSV import, bulk export |
| `templates` | Checklist, delegation, FMS templates |
| `form-builder` | Dynamic forms, field types, FMS integration |

### Phase 4 — AI & Automation
| Module | Key Features |
|---|---|
| `ai` | Workflow generator, AI assistant, predictions |
| `automation` | Rule builder, trigger→condition→action |
| `voice-task` | Voice recording → task creation |
| `smart-assign` | Workload-aware best-assignee suggestion |

### Phase 5 — Enterprise
| Module | Key Features |
|---|---|
| `client-portal` | External client access, request tracking |
| `vendor-portal` | Vendor quote/document management |
| `billing` | Subscription, plans, usage limits |
| `security` | 2FA, device management, IP restrictions |
| `backup` | Data export, restore, compliance |

---

## 8. Status Flows

### Delegation / Work Request
```
PENDING → IN_PROGRESS → SEND_FOR_APPROVAL → COMPLETED

Rework:
PENDING → IN_PROGRESS → SEND_FOR_APPROVAL → REWORK → IN_PROGRESS → SEND_FOR_APPROVAL → COMPLETED

Other terminal:
→ BLOCKED (dependency)
→ CANCELLED
→ OVERDUE (calculated, not stored)
```

### Checklist
```
PENDING → COMPLETED
PENDING → LATE (past due, not done)
```

### FMS Task
```
NOT_STARTED → PENDING → IN_PROGRESS → COMPLETED
                      ↓
                    BLOCKED
                    SKIPPED (admin only)
On time check:
COMPLETED on/before planned date → ON_TIME
COMPLETED after planned date → LATE
```

---

## 9. Redis Cache Strategy

### Cache Keys
```
dashboard:{tenantId}:{userId}:{role}:{filterHash}  TTL: 5min
mis:{tenantId}:{userId}:{filterHash}               TTL: 10min
reports:{tenantId}:{type}:{filterHash}             TTL: 15min
notifications:{tenantId}:{userId}                  TTL: 1min
projects:active:{tenantId}                         TTL: 30min
hierarchy:{tenantId}:{adminId}                     TTL: 30min
users:active:{tenantId}                            TTL: 30min
```

### Cache Invalidation Events
| Event | Invalidates |
|---|---|
| Task created/updated/completed | dashboard, mis |
| Approval action | dashboard, mis, notifications |
| User created/updated | users:active, hierarchy |
| Project changed | projects:active, dashboard |
| Hierarchy changed | hierarchy |
| Checklist/FMS completed | dashboard, mis |

### Cache Pattern
```typescript
// Read
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Miss: fetch + store
const data = await prisma.query...;
await redis.setex(cacheKey, TTL, JSON.stringify(data));
return data;

// Invalidate
await redis.del(`dashboard:${tenantId}:*`); // pattern delete
```

---

## 10. BullMQ Queue System

### Queues & Jobs
| Queue | Jobs | Trigger |
|---|---|---|
| `emailQueue` | send-email, send-digest | Notifications, daily summary |
| `notificationQueue` | push-notification, in-app | Any system event |
| `checklistQueue` | generate-checklist-tasks, missed-check | On assign, daily cron |
| `fmsQueue` | generate-fms-steps, fms-reminder | On workflow publish |
| `escalationQueue` | check-sla, escalate-task | Every 30min cron |
| `misQueue` | calculate-mis, weekly-snapshot | Nightly/weekly cron |
| `reportQueue` | generate-report, schedule-report | On demand / cron |
| `automationQueue` | process-trigger, execute-action | On any system event |
| `aiQueue` | generate-workflow, ai-predict | On demand |

### BullMQ Pattern
```typescript
// Producer (service layer)
await this.emailQueue.add('send-email', {
  to: user.email,
  template: 'task-assigned',
  data: { taskId, taskTitle, assignee }
});

// Consumer (processor)
@Processor('emailQueue')
export class EmailProcessor {
  @Process('send-email')
  async handle(job: Job) {
    // send email via SendGrid/Nodemailer
  }
}
```

---

## 11. Delay & SLA Calculation Logic

Delays are calculated respecting:
- Company working hours (e.g., 9 AM – 6 PM)
- Working days (Mon–Sat or Mon–Fri)
- Company holiday calendar
- Company timezone

```typescript
function calculateDelay(
  plannedDate: Date,
  actualDate: Date,
  companySettings: CompanySettings
): { delayDays: number; onTimeStatus: 'ON_TIME' | 'LATE' }
```

All dates stored in ISO UTC. Display in company timezone on frontend.

---

## 12. MIS Score Formula

```
Productivity Score = 100
  - (pending tasks × 2)
  - (overdue tasks × 5)
  - (delay days × 0.5)
  - (rework count × 3)
  - (SLA breaches × 4)
  + (high priority completed on time × 2)
  + (early completion × 1)

Min score: 0 (clamped)
```

### Grades
| Score | Grade |
|---|---|
| 90–100 | A+ |
| 80–89 | A |
| 65–79 | B |
| 50–64 | C |
| < 50 | D |

---

## 13. File Upload Architecture (Cloudinary)

```
Client selects file
↓
POST /uploads/cloudinary (multipart/form-data)
↓
NestJS → Multer (memory storage) → Cloudinary SDK upload
↓
Store: { publicId, url, resourceType, size, uploadedBy, attachedTo }
↓
Return { url, publicId } to client
↓
Client includes publicId in task/request body
```

### Cleanup
- When task deleted → Cloudinary delete by publicId
- Orphaned uploads cleanup job (weekly)

---

## 14. Real-Time (Future Phase)

WebSocket via Socket.IO (NestJS gateway):
```
Events emitted:
- task.created
- task.completed
- task.approved
- task.reworked
- notification.created
- dashboard.updated
- fms.step.completed
```

---

## 15. Deployment Plan (Phase 1)

| Service | Platform |
|---|---|
| Frontend (Next.js) | Vercel |
| Backend (NestJS) | Railway / Render / AWS ECS |
| Database | MongoDB Atlas (M10+) |
| Cache | Upstash Redis |
| Queue | BullMQ + Upstash Redis |
| Files | Cloudinary |
| Email | SendGrid |
| Domains | Vercel (frontend) + custom API domain |

### Environment Variables
```env
# Backend
DATABASE_URL=mongodb+srv://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
REDIS_URL=redis://...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
SENDGRID_API_KEY=...
APP_URL=https://api.taskeasy.app

# Frontend
NEXT_PUBLIC_API_URL=https://api.taskeasy.app
NEXT_PUBLIC_APP_NAME=TaskEasy
```

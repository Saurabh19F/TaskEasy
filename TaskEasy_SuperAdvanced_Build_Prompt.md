# TaskEasy — Super Advanced SaaS Build Prompt

> Use this prompt when building or rebuilding TaskEasy with AI coding tools, Cursor, GitHub Copilot, or any LLM-powered IDE.

---

You are a senior enterprise SaaS architect, product manager, UI/UX designer, frontend engineer, backend engineer, database architect, DevOps engineer, QA lead, and security expert.

I want to build a super advanced SaaS workflow management platform named TaskEasy.

## Current App Reference

TaskEasy is currently a task/workflow management system with these modules:
- Dashboard
- Checklists
- Delegation
- Work Request
- FMS System
- Approve/Review
- MIS
- Reports
- Admin Settings
- Set Hierarchy

The existing system was made using Google Apps Script + HTML + Google Sheets, but now I want to rebuild it as a proper production-grade SaaS platform.

---

## Tech Stack

**Frontend:**
- Next.js
- React
- TypeScript
- Tailwind CSS
- ShadCN UI or modern reusable component system
- React Query / TanStack Query for API state
- Zustand or Redux Toolkit for global state
- Recharts / Chart.js for analytics
- React Hook Form + Zod for forms and validation

**Backend:**
- NestJS
- TypeScript
- REST API architecture
- Modular service-based architecture
- DTO validation using class-validator
- Centralized error handling
- Swagger API documentation

**Database:** MongoDB Atlas

**ORM:** Prisma

**Cache / Queue:** Redis + BullMQ

**Auth:** JWT authentication + Refresh token system + RBAC + Permission-based access control

**File Upload:** Cloudinary for all attachments, proofs, documents, images, and files

---

## Goal

Build TaskEasy as a super advanced enterprise SaaS workflow operating system where companies can manage tasks, approvals, checklists, FMS workflows, employee MIS, project health, automation, reports, notifications, AI workflows, and performance analytics from one place.

**Main vision:**
> TaskEasy = Workflow OS + MIS Engine + AI Task Manager + Company Productivity Platform

---

## Required Roles

1. SaaS Owner
2. Company Owner
3. Super Admin
4. Admin
5. Manager
6. Team Lead
7. Employee
8. Auditor
9. Viewer
10. Client / External User
11. Vendor / External User

**Access logic:**
- SaaS Owner manages all companies, plans, subscriptions, billing, feature access, and platform settings.
- Company Owner manages one company workspace.
- Super Admin has full company-level access.
- Admin manages assigned team, users, hierarchy, projects, tasks, reports, MIS, approvals.
- Manager and Team Lead manage team-level tasks and approvals.
- Employee sees only own tasks, checklists, work requests, FMS tasks, approvals, and performance.
- Viewer has read-only access.
- Auditor has audit/report access.
- Client/Vendor gets limited external portal access.

> **Important:** Do not trust frontend role hiding as security. Every API must verify JWT, role, permission, tenantId, and data ownership.

---

## Core Modules

### 1. Multi-Tenant SaaS Module
- Company/tenant creation
- Tenant settings
- Tenant-wise data isolation
- Subscription plans
- Feature flags
- Usage limits
- Billing history
- Company branding
- Workspace settings

Every collection must include `tenantId`.

---

### 2. Authentication Module
- Login / Logout / Refresh token
- Forgot password / Reset password / Change password
- JWT access token + Refresh token rotation
- Account lock after failed login attempts
- Password policy
- Optional 2FA
- Login history
- Device/session management

---

### 3. RBAC + Permission System
- Roles and permissions
- Super Admin can create custom roles with permissions
- Permission examples:
  - user.create / user.read / user.update / user.delete
  - project.create
  - task.assign / task.submit / task.approve / task.rework
  - report.export
  - mis.view
  - fms.manage
  - hierarchy.manage
  - workflow.publish

---

### 4. User Management
- Add / Edit / Delete / Archive user
- Activate / Deactivate user
- Assign role / manager / department / team
- User profile + Avatar upload
- Password reset
- Bulk import users from Excel
- Export users Excel/PDF
- User activity log

---

### 5. Project Management
- Create / Edit / Archive project
- Project members
- Project dashboard
- Project timeline
- Project documents
- Project task summary
- Project health score
- Project SLA
- Project risk status

Project statuses: Not Started / Active / On Hold / Completed / Archived

---

### 6. Hierarchy Management
- Create group / Assign admin/manager / Assign team members
- Edit / Delete hierarchy
- Tree view
- Team visibility rules

Logic:
- Super Admin sees all
- Admin sees only mapped team
- Manager sees assigned team
- Employee sees own data only

---

### 7. Dashboard 2.0
Widgets:
- Today's Focus / Due Today / Overdue Tasks / Approval Pending / Rework Pending
- SLA Breaches / Team Workload / Project Health / Employee Ranking
- FMS Bottlenecks / Recent Activity / AI Insights
- Critical Team Tasks / Personal Priority Tasks / Task Trend Chart
- Project Wise Status / FMS Wise Task Status

Filters: Team View / My View / Employee / Project / Status / Date Range / All / Today / This Week / Last Week / This Month / Last Month / Custom

Features: Live refresh / Export / Widget customization / Drag-drop layout

---

### 8. Delegation Module
Fields: Delegated By/To, Project, Title, Description, Priority, Target Date/Time, Attachments, Estimated Hours, Tags, Dependency, Approval Required, SLA, Reminder Rule

Status flow:
```
PENDING → IN_PROGRESS → SEND_FOR_APPROVAL → COMPLETED
PENDING → IN_PROGRESS → SEND_FOR_APPROVAL → REWORK → IN_PROGRESS → SEND_FOR_APPROVAL → COMPLETED
```
Other statuses: BLOCKED / CANCELLED / OVERDUE

Buttons: Add Task / Remove / Send All / Save Draft / Upload / Done / Submit / Approve / Rework / Reject / Comment / View History / Bulk Assign / Bulk Reassign / Bulk Approve / Bulk Export

---

### 9. Work Request Module
Fields: Requested By, Request For, Project, Description, Deadline Date/Time, Attachments, Priority, SLA, Approval Required

Tabs: Create Request / My Requests / Pending For Me / Team Requests / Completed / Rework

Status:
```
PENDING → IN_PROGRESS → SEND_FOR_APPROVAL → COMPLETED
PENDING → IN_PROGRESS → SEND_FOR_APPROVAL → REWORK → COMPLETED
```

---

### 10. Checklist + KRA Module
- Recurring checklist: Daily / Weekly / Fortnightly / Monthly / Quarterly / Half Yearly / Yearly / One Time
- Attachment required toggle
- Start date + time / End date optional
- Checklist master + task generation
- Bulk complete / My KRA master / Team checklists
- Missed checklist tracking / Checklist score in MIS

Logic: Checklist master creates planned tasks using BullMQ. Must respect working days, holidays, timezone, and start time.

---

### 11. FMS Workflow System
Features: FMS Flow Monitor / Import from Excel/CSV / Workflow Builder / Visual Flow Map / Generate with AI / Analytics / My/Team Pending & Completed / Step-wise SLA / Step dependencies / Dynamic form responses / Bottleneck detection

FMS statuses: NOT_STARTED / PENDING / IN_PROGRESS / COMPLETED / LATE / BLOCKED / SKIPPED

Buttons: Import Sheet / Download Template / Generate with AI / Create Workflow / Add Step / Edit Step / Publish Workflow / Clone Workflow / Flow Map / Mark Done / Reassign Step / Skip Step / Open Form

---

### 12. Workflow Builder
Workflow structure:
- Name / Description / Project / Steps / Step order / Assigned role/user / SLA
- Conditions / Approval required / Form required / Attachment required / Escalation rules

Condition examples:
- If priority = High, require admin approval
- If attachment missing, block submission
- If delay > 3 days, require reason
- If task completed late, add MIS penalty

---

### 13. AI Workflow Generator
Button: **Generate with AI**

Admin enters natural language prompt → AI generates: Steps / Assignees / SLA / Conditions / Approval points / Risk points / Notifications / Checklist items / FMS steps

User can review, edit, and publish.

---

### 14. Approve / Review Module
Features:
- New Submissions / Rework Submissions
- My Approvals / Delegations Sent / Checklists Sent / Work Requests Sent
- Multi-level approval / Parallel approval / Conditional approval
- Approval note / Approval delegation / Force complete (Super Admin only)

Approval flow:
```
Task submitted → Approval level 1 → Approval level 2 (if required) → Completed
```

---

### 15. MIS 2.0
Calculates: Total tasks / Completed / Pending / On time / Late / Delay days / Reworks / SLA breaches / Avg delay / Completion rate / Quality score / Productivity score / Project-wise / Department-wise / Employee ranking / Weekly+Monthly score / KRA/KPI/OKR score

Score formula:
```
Productivity Score = 100
  - pending penalty
  - delay penalty
  - rework penalty
  - SLA breach penalty
  + high priority completion bonus
  + early completion bonus
```

Grades: A+ (90+) / A (80-89) / B (65-79) / C (50-64) / D (below 50)

MIS pages: Employee / Team / Project / Department / SLA / Rework Analysis / Delay Analysis / Workload Analysis / Trend Analysis / AI Insights

---

### 16. Reports Module
Reports: Performance / Delegation / Work Request / Checklist / FMS / Project / SLA / Rework / Aging / Audit / User Activity

Features: Filter / Search / Sort / Pagination / Export Excel/PDF/CSV / Save template / Schedule email / Share link / Report builder

---

### 17. Notification Center
Types: TASK_ASSIGNED / TASK_DUE_SOON / TASK_OVERDUE / TASK_COMPLETED / APPROVAL_PENDING / REWORK_REQUESTED / COMMENT_MENTION / FMS_STEP_ASSIGNED / MIS_SCORE_UPDATED / SLA_BREACHED

Channels: In-app / Email / WhatsApp (optional) / Push notification / Daily digest

---

### 18. SLA + Escalation Engine
Escalation levels:
- Level 1: Reminder to doer
- Level 2: Notify manager
- Level 3: Notify admin
- Level 4: Mark critical
- Level 5: Show in escalation dashboard

BullMQ jobs: task-reminder-job / sla-check-job / overdue-escalation-job / daily-summary-job / weekly-mis-job

---

### 19. Comments + Activity Timeline
Every task must have: Comments / Mentions / Timeline / Status history / Attachment history / Approval history

---

### 20. Attachment System (Cloudinary)
Features: Upload / Preview / Versioning / File type validation / File size limit / Attachment category / Proof required rule / Cloudinary publicId storage / Delete/cleanup

Types: Task Brief / Proof / Invoice / Screenshot / Excel / PDF / Image / Form Response / Approval Proof

---

### 21. Task Dependency System
- Add dependency / View blockers / Blocked status
- Auto-unblock when parent task completes
- Manual unblock by admin

---

### 22. Task Risk Engine
Risk score based on: Days overdue / Priority weight / Rework count / Assignee workload / Client importance / SLA breach possibility

Risk statuses: Low / Medium / High / Critical

---

### 23. Workload Management
Metrics: Assigned tasks / Pending / Due today / Overdue / Avg delay / Capacity % / Burnout risk

Buttons: Rebalance Workload / View Capacity / Bulk Reassign / Suggest Best Assignee

---

### 24. Smart Assignment Engine
Button: **Suggest Best Assignee**

System checks: Availability / Workload / Skill / Past performance / Current pending count / Leave status / Rework rate / On-time rate → Suggests best assignee

---

### 25. Calendar View
Views: Day / Week / Month / User Calendar / Team Calendar / Project Calendar

Features: Drag to reschedule / Create task from calendar / Filter by user/project/status / Export calendar

---

### 26. Kanban Board
Columns: Pending / In Progress / Send for Approval / Rework / Blocked / Completed / Cancelled

Features: Drag/drop / Quick edit / Bulk move / Filter / Search

---

### 27. Global Search
MongoDB Atlas Search across: Tasks / Users / Projects / FMS / Reports / Approvals / Attachments / Comments

---

### 28. Audit Logs
Track: Login / Task created/edited/deleted/completed/approved / Rework sent / File uploaded / Report exported / Role changed / Hierarchy changed

Fields: tenantId / actorId / action / module / oldValue / newValue / ipAddress / device / timestamp

---

### 29. Import / Export Center
Import: Users / Projects / Tasks / FMS / Checklist master (from Excel/CSV)

Export: Excel / PDF / CSV / JSON

Buttons: Import Excel / Download Template / Validate Data / Preview Import / Confirm Import / Export All

---

### 30. Template Library
Templates: Checklist / Delegation / Work Request / FMS Workflow / Report / Notification / Email

---

### 31. Dynamic Form Builder
Field types: Text / Number / Date / Time / Dropdown / Multi-select / File Upload / Checkbox / Radio / Table/Grid / Signature / URL / Currency

Forms can be linked to FMS workflow steps.

---

### 32. Client Portal
Client can: Submit request / Upload documents / View request status / Approve proof / Comment / Download reports

### 33. Vendor Portal
Vendor can: View assigned quote/request / Submit quote / Upload document / Update status / Comment

---

### 34. Mobile PWA
Features: Installable PWA / Push notifications / Offline mode / Camera upload / Voice note

Quick actions: Mark Done / Upload Proof / Add Comment / Approve / Send Rework

---

### 35. AI Assistant
AI can answer:
- Show delayed tasks this week
- Why is this employee score low?
- Create checklist for client onboarding
- Which employee is overloaded?
- Summarize today's pending approvals
- Suggest best assignee / Predict task delay / Detect bottlenecks

### 36. Voice-to-Task
User records voice → AI converts to task draft → User confirms → Task created

Example: *"Assign Sunny to follow up payment with ABC client by tomorrow 5 PM."*

### 37. Email-to-Task
Emails sent to `task@taskeasy.app` create tasks automatically.

### 38. WhatsApp-to-Task
WhatsApp bot creates tasks after confirmation.

---

### 39. Automation Rule Builder
Pattern: **Trigger → Condition → Action**

Examples:
- When task overdue by 1 day → notify manager
- When priority is Critical → require approval
- When checklist missed → create rework
- When user has 20+ pending tasks → notify admin
- When project health below 50% → mark project at risk

---

### 40. Company Settings
Configure: Working days / Working hours / Holiday calendar / Default SLA / Approval rules / Notification rules / Branding / Logo / Theme / Date format / Timezone

> **Date rule:** Use ISO DateTime everywhere internally. Never use DD/MM/YYYY or MM/DD/YYYY. Delay calculation must respect timezone, working hours, holidays, and weekends.

---

## Database Collections (Prisma + MongoDB)

```
tenants / subscriptions / plans / featureFlags
users / roles / permissions
projects / hierarchies
delegationTasks / workRequests
checklistMasters / checklistTasks
fmsWorkflows / fmsSteps / fmsTasks
approvals / comments / activityLogs / auditLogs
notifications / attachments
misSnapshots / reports / reportTemplates
automationRules / forms / formResponses
clientPortalUsers / vendorPortalUsers
```

---

## Backend Architecture (NestJS Modules)

```
auth / tenants / users / roles / permissions
projects / hierarchy / dashboard
delegation / checklist / work-request / fms / workflow
approval / mis / reports / notifications
uploads / comments / audit / automation / ai
calendar / kanban / search
client-portal / vendor-portal
queue / cache / common
```

---

## Frontend Pages (Next.js)

```
/login
/dashboard
/delegation
/checklists
/work-request
/fms
/workflow-builder
/approve-review
/mis
/reports
/projects
/users
/hierarchy
/notifications
/calendar
/kanban
/automation
/audit-logs
/settings
/client-portal
/vendor-portal
```

---

## API Design

Every endpoint must include:
- Auth guard / Role guard / Permission guard
- Tenant isolation
- DTO validation
- Error handling
- Audit logging for write actions

### Key Endpoint Groups

```
Auth:
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me

Users:
GET    /users
POST   /users
PATCH  /users/:id
DELETE /users/:id
PATCH  /users/:id/status

Delegation:
POST   /delegation
GET    /delegation/my-pending
GET    /delegation/team
PATCH  /delegation/:id/submit
PATCH  /delegation/:id/approve
PATCH  /delegation/:id/rework

Checklist:
POST   /checklist/master
POST   /checklist/assign
GET    /checklist/my-pending
PATCH  /checklist/:id/complete
PATCH  /checklist/bulk-complete

Work Request:
POST   /work-request
GET    /work-request/my-requests
GET    /work-request/pending-for-me
PATCH  /work-request/:id/submit
PATCH  /work-request/:id/approve
PATCH  /work-request/:id/rework

FMS:
POST   /fms/import
POST   /fms/generate-ai
POST   /fms/workflows
PATCH  /fms/workflows/:id/publish
GET    /fms/my-pending
GET    /fms/team-pending
PATCH  /fms/tasks/:id/complete

MIS:
GET  /mis/summary
GET  /mis/employees
GET  /mis/details
POST /mis/snapshot

Reports:
GET /reports/performance
GET /reports/delegation
GET /reports/work-request
GET /reports/checklist
GET /reports/fms
GET /reports/project

Uploads:
POST   /uploads/cloudinary
DELETE /uploads/:publicId
```

---

## Redis Cache Keys

```
dashboard:{tenantId}:{userId}:{role}:{filters}
mis:{tenantId}:{userId}:{filters}
reports:{tenantId}:{type}:{filters}
notifications:{tenantId}:{userId}
projects:active:{tenantId}
hierarchy:{tenantId}:{adminId}
```

Clear cache when: task created/submitted/approved/reworked, checklist completed, FMS completed, user/project/hierarchy changed.

---

## BullMQ Queues

```
emailQueue / notificationQueue / checklistQueue
fmsQueue / reportQueue / misQueue
escalationQueue / automationQueue / aiQueue
```

---

## Development Roadmap

**Phase 1 — Core:**
Auth / Tenant / Users / Roles/Permissions / Projects / Hierarchy / Delegation / Work Request / Checklist / Uploads

**Phase 2 — Advanced Workflow:**
FMS / Workflow Builder / Approve-Review / Dashboard / MIS / Reports / Notifications / Audit Logs

**Phase 3 — Productivity:**
SLA Engine / Escalation / Kanban / Calendar / Comments/Timeline / Import/Export Center / Template Library / Form Builder

**Phase 4 — AI + Automation:**
AI Assistant / AI Workflow Generator / Smart Assignment / Predictive Delay / Automation Rule Builder / Voice-to-Task / Email-to-Task / WhatsApp-to-Task

**Phase 5 — SaaS Enterprise:**
Client Portal / Vendor Portal / Subscription/Billing / Advanced Security / Backup/Restore / Compliance Dashboard / PWA Mobile

---

## UI/UX Requirements

Make the frontend highly professional, modern, clean, techie, SaaS-style, and attractive.

Premium dashboard design with:
- Clean sidebar / Top navbar / Cards / Charts / Kanban / Tables / Modals / Drawers
- Command search / Notification center / Responsive mobile layout
- Dark/light mode / Smooth animations / Skeleton loaders
- Empty states / Error states / Confirmation modals / Toast notifications

Design tokens:
- Primary: Indigo / Violet
- Success: Green
- Warning: Amber
- Danger: Red
- Info: Blue
- Background: Light gray / Dark slate
- Rounded cards / Soft shadows / Clean typography

---

## Output Required

1. Complete architecture
2. Database schema using Prisma for MongoDB
3. NestJS modules, DTOs, controllers, services, guards, decorators, and Prisma queries
4. Next.js pages and components
5. API integration
6. Role-based UI rendering
7. Redis cache
8. BullMQ background jobs
9. Cloudinary upload
10. Testing plan
11. Deployment plan

> Do not skip any module. Do not create dummy-only structure. Every module must have proper working logic, API routes, database models, validation, and frontend integration. Code should be clean, scalable, production-ready, and maintainable.

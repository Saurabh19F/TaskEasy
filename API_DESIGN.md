# TaskEasy — Complete REST API Design

Base URL: `https://api.taskeasy.app/v1`

Every endpoint (except auth routes) requires:
- `Authorization: Bearer <accessToken>`
- Tenant isolation enforced server-side from JWT (never from request body)

---

## AUTH MODULE

```
POST   /auth/login                  → { accessToken, user }
POST   /auth/refresh                → { accessToken }
POST   /auth/logout                 → 200 OK
POST   /auth/forgot-password        → send reset email
POST   /auth/reset-password         → reset with token
PATCH  /auth/change-password        → change own password
GET    /auth/me                     → current user profile
POST   /auth/2fa/setup              → generate TOTP secret
POST   /auth/2fa/verify             → enable 2FA
DELETE /auth/2fa                    → disable 2FA
GET    /auth/sessions               → list active sessions
DELETE /auth/sessions/:sessionId    → revoke session
```

---

## TENANTS MODULE

```
POST   /tenants                     → [SaaS Owner] create tenant
GET    /tenants/:id                 → get tenant details
PATCH  /tenants/:id                 → update tenant settings
GET    /tenants/:id/settings        → company settings
PATCH  /tenants/:id/settings        → update working days/hours/timezone
GET    /tenants/:id/holidays        → list holidays
POST   /tenants/:id/holidays        → add holiday
DELETE /tenants/:id/holidays/:hid   → remove holiday
GET    /tenants/:id/feature-flags   → list feature flags
PATCH  /tenants/:id/feature-flags   → toggle feature
GET    /tenants/:id/subscription    → subscription info
```

---

## USERS MODULE

```
GET    /users                           → [Admin+] list users (tenant scoped)
POST   /users                           → [Super Admin] create user
GET    /users/:id                       → get user profile
PATCH  /users/:id                       → update user
DELETE /users/:id                       → soft delete (archive)
PATCH  /users/:id/status               → activate/deactivate
PATCH  /users/:id/role                 → change role
PATCH  /users/:id/password             → admin reset password
GET    /users/:id/activity             → user activity log
GET    /users/active                    → [Dropdown] only active users
POST   /users/bulk-import              → import from Excel
GET    /users/export                    → export to Excel/PDF
GET    /users/search?q=name            → search users
```

Body: `create-user`
```json
{
  "name": "Sunny Gupta",
  "email": "sunny@company.com",
  "phone": "9876543210",
  "employeeId": "EMP001",
  "role": "EMPLOYEE",
  "department": "Sales",
  "designation": "Executive",
  "managerId": "objectId"
}
```

---

## ROLES MODULE

```
GET    /roles                   → list roles (including system + custom)
POST   /roles                   → [Super Admin] create custom role
GET    /roles/:id               → get role + permissions
PATCH  /roles/:id               → update role permissions
DELETE /roles/:id               → delete custom role (not system)
GET    /roles/permissions       → list all available permission keys
```

---

## PROJECTS MODULE

```
GET    /projects                    → list projects (role filtered)
POST   /projects                    → create project
GET    /projects/:id                → project detail
PATCH  /projects/:id                → update project
PATCH  /projects/:id/status        → change status (active/archived)
GET    /projects/:id/members       → list project members
POST   /projects/:id/members       → add members
DELETE /projects/:id/members/:uid  → remove member
GET    /projects/:id/health        → health score + risk breakdown
GET    /projects/active            → [Dropdown] active projects only
```

---

## HIERARCHY MODULE

```
GET    /hierarchy                   → list all hierarchy groups
POST   /hierarchy                   → create group
GET    /hierarchy/:id               → group detail
PATCH  /hierarchy/:id               → update group
DELETE /hierarchy/:id               → delete group
GET    /hierarchy/my-team           → [Admin] my assigned team
GET    /hierarchy/tree              → tree view of all groups
```

Body: `create-hierarchy`
```json
{
  "groupName": "Sales Team",
  "adminId": "objectId",
  "memberIds": ["id1", "id2", "id3"]
}
```

---

## DASHBOARD MODULE

```
GET    /dashboard                   → main dashboard metrics
GET    /dashboard/team              → [Admin+] team metrics
GET    /dashboard/my                → personal metrics
GET    /dashboard/critical-tasks    → overdue/critical task list
GET    /dashboard/priority-tasks    → personal high priority pending
GET    /dashboard/trend             → task trend chart data (7/30 days)
GET    /dashboard/project-status    → project wise status breakdown
GET    /dashboard/fms-status        → FMS wise task status
GET    /dashboard/workload          → team workload per user
```

Query params (all endpoints): `?period=THIS_WEEK&projectId=...&userId=...&status=...&from=...&to=...`

---

## DELEGATION MODULE

```
POST   /delegation                          → [Admin/Manager] create task(s)
POST   /delegation/bulk                     → bulk create (multiple assignees)
GET    /delegation/my-pending               → tasks assigned to me (pending)
GET    /delegation/my-completed             → my completed tasks
GET    /delegation/sent                     → tasks I assigned
GET    /delegation/team                     → [Admin+] all team tasks
GET    /delegation/:id                      → task detail
PATCH  /delegation/:id/submit               → employee submits for approval
PATCH  /delegation/:id/approve             → [Admin] approve task
PATCH  /delegation/:id/rework              → [Admin] send rework
PATCH  /delegation/:id/cancel              → cancel task
PATCH  /delegation/:id/reassign            → reassign to different user
PATCH  /delegation/bulk-assign             → bulk assign tasks
PATCH  /delegation/bulk-approve            → bulk approve
DELETE /delegation/:id                      → delete (Super Admin only)
GET    /delegation/overdue                  → overdue tasks
GET    /delegation/export                   → export to Excel/PDF
```

Body: `create-task`
```json
{
  "delegatedToId": "objectId",
  "projectId": "objectId",
  "title": "Follow up payment",
  "description": "Call ABC client regarding pending PI",
  "priority": "HIGH",
  "targetDate": "2026-06-20T00:00:00.000Z",
  "targetTime": "17:00",
  "estimatedHours": 2,
  "approvalRequired": true,
  "slaHours": 24,
  "tags": ["client", "payment"],
  "attachmentIds": ["cloudinaryPublicId1"]
}
```

Body: `submit-task`
```json
{
  "remarks": "Called ABC client. Payment expected by Friday.",
  "attachmentIds": ["cloudinaryPublicId2"]
}
```

Body: `approve-task`
```json
{
  "action": "APPROVE",  // or "REWORK"
  "remarks": "Good work, confirmed."
}
```

---

## WORK REQUEST MODULE

```
POST   /work-request                        → create request
GET    /work-request/my-requests            → requests I created
GET    /work-request/pending-for-me         → requests assigned to me
GET    /work-request/team                   → [Admin+] all team requests
GET    /work-request/completed              → completed requests
GET    /work-request/:id                    → request detail
PATCH  /work-request/:id/submit             → doer submits completion
PATCH  /work-request/:id/approve           → requester/admin approves
PATCH  /work-request/:id/rework            → requester/admin sends rework
PATCH  /work-request/:id/cancel            → cancel request
GET    /work-request/export                 → export
```

---

## CHECKLIST MODULE

```
POST   /checklist/master                    → [Admin] create checklist master
GET    /checklist/master                    → list checklist masters
GET    /checklist/master/:id               → master detail
PATCH  /checklist/master/:id               → update master
DELETE /checklist/master/:id               → deactivate master
GET    /checklist/my-pending               → my pending checklist tasks
GET    /checklist/my-completed             → my completed history
GET    /checklist/team                     → [Admin+] team checklist tasks
GET    /checklist/:id                      → checklist task detail
PATCH  /checklist/:id/complete            → complete one checklist task
POST   /checklist/bulk-complete           → bulk complete selected tasks
GET    /checklist/overdue                  → missed/late checklist tasks
GET    /checklist/export                   → export
```

Body: `create-checklist-master`
```json
{
  "assignedToId": "objectId",
  "projectId": "objectId",
  "title": "Daily Sales Report",
  "description": "Submit daily sales report by 6 PM",
  "frequency": "DAILY",
  "startDate": "2026-06-16T00:00:00.000Z",
  "startTime": "18:00",
  "attachmentRequired": false,
  "tags": ["report", "daily"]
}
```

Body: `bulk-complete`
```json
{
  "taskIds": ["id1", "id2", "id3"],
  "remarks": "All daily reports submitted",
  "attachmentIds": []
}
```

---

## FMS MODULE

```
GET    /fms/workflows                       → list workflows
POST   /fms/workflows                       → create workflow
GET    /fms/workflows/:id                  → workflow detail + steps
PATCH  /fms/workflows/:id                  → update workflow
DELETE /fms/workflows/:id                  → delete (draft only)
POST   /fms/workflows/:id/publish          → publish workflow
POST   /fms/workflows/:id/clone            → clone workflow
PATCH  /fms/workflows/:id/pause            → pause workflow
PATCH  /fms/workflows/:id/archive          → archive workflow
POST   /fms/workflows/:id/steps            → add step
PATCH  /fms/workflows/:id/steps/:stepNo   → edit step
DELETE /fms/workflows/:id/steps/:stepNo   → delete step
POST   /fms/import                         → import FMS from Excel
GET    /fms/import/template                → download import template
POST   /fms/generate-ai                   → AI generate workflow
GET    /fms/tasks/my-pending              → my pending FMS tasks
GET    /fms/tasks/my-completed            → my completed FMS history
GET    /fms/tasks/team-pending            → [Admin+] team pending
GET    /fms/tasks/team-completed          → [Admin+] team completed
GET    /fms/tasks/:id                     → FMS task detail
PATCH  /fms/tasks/:id/complete           → mark FMS task done
PATCH  /fms/tasks/:id/skip              → [Admin] skip step
PATCH  /fms/tasks/:id/reassign          → reassign step
GET    /fms/analytics                    → FMS analytics summary
GET    /fms/bottlenecks                  → detected bottlenecks
GET    /fms/export                       → export FMS tasks
```

Body: `generate-ai`
```json
{
  "prompt": "Create a payment follow-up workflow from PI creation to payment confirmation",
  "projectId": "objectId"
}
```

---

## APPROVAL MODULE

```
GET    /approval/new-submissions            → pending approval items (all types)
GET    /approval/rework-submissions         → items sent for rework
GET    /approval/my-approvals              → approvals assigned to me
GET    /approval/sent                      → approvals for tasks I submitted
GET    /approval/:id                       → approval detail
POST   /approval/:id/approve              → approve
POST   /approval/:id/rework              → send rework
POST   /approval/:id/reject              → reject
POST   /approval/:id/delegate            → delegate approval to another admin
POST   /approval/:id/force-complete      → [Super Admin only] force complete
```

---

## MIS MODULE

```
GET    /mis/summary                         → tenant-level MIS summary cards
GET    /mis/employees                       → all employees MIS cards
GET    /mis/employees/:userId              → one employee MIS detail
GET    /mis/employees/:userId/breakdown    → category-wise breakdown
GET    /mis/employees/:userId/drill-down   → drill-down task details
GET    /mis/team                           → [Admin] team MIS
GET    /mis/projects                       → project-wise MIS
GET    /mis/departments                    → department-wise MIS
GET    /mis/ranking                        → employee ranking
GET    /mis/trend                          → score trend chart
POST   /mis/snapshot                       → [Admin+] save weekly snapshot
PATCH  /mis/snapshot/:id/target           → update next week target score
GET    /mis/history/:userId               → historical snapshots
GET    /mis/export                         → export MIS table
```

Query params: `?period=THIS_WEEK&userId=...&projectId=...&from=...&to=...`

---

## REPORTS MODULE

```
GET    /reports/performance                 → performance report
GET    /reports/delegation                  → delegation report
GET    /reports/work-request               → work request report
GET    /reports/checklist                  → checklist report
GET    /reports/fms                        → FMS report
GET    /reports/project                    → project summary report
GET    /reports/sla                        → SLA breach report
GET    /reports/rework                     → rework analysis
GET    /reports/aging                      → task aging report
GET    /reports/audit                      → audit report
GET    /reports/user-activity             → user activity report
POST   /reports/templates                  → save report template
GET    /reports/templates                  → list saved templates
DELETE /reports/templates/:id             → delete template
POST   /reports/schedule                   → schedule report email
GET    /reports/export/:type               → Excel/PDF export
```

All reports accept:
```
?period=THIS_MONTH&userId=...&projectId=...&status=...&from=...&to=...&format=excel|pdf
```

---

## NOTIFICATIONS MODULE

```
GET    /notifications                       → list my notifications
GET    /notifications/unread-count          → badge count
PATCH  /notifications/:id/read             → mark one read
POST   /notifications/mark-all-read        → mark all read
DELETE /notifications/:id                  → delete notification
GET    /notifications/settings             → my notification preferences
PATCH  /notifications/settings             → update preferences
```

---

## UPLOADS MODULE

```
POST   /uploads/cloudinary                  → upload file(s), returns { url, publicId }
DELETE /uploads/:publicId                   → delete from Cloudinary
GET    /uploads/:refType/:refId            → list attachments for a task/request
```

Body: multipart/form-data with `file` field + `category` (proof/brief/invoice/etc) + `attachedTo` (delegation:taskId)

---

## COMMENTS MODULE

```
GET    /comments/:refType/:refId            → list comments for a task
POST   /comments/:refType/:refId            → add comment
PATCH  /comments/:id                        → edit own comment
DELETE /comments/:id                        → delete own comment
POST   /comments/:id/pin                    → pin comment (Admin+)
GET    /activity/:refType/:refId            → activity timeline for task
```

---

## AUDIT MODULE

```
GET    /audit                               → [Auditor/Super Admin] list audit logs
GET    /audit/:id                           → audit log detail
GET    /audit/export                        → export audit logs
```

Query: `?module=DELEGATION&action=APPROVE&userId=...&from=...&to=...`

---

## AUTOMATION MODULE

```
GET    /automation                          → list automation rules
POST   /automation                          → create rule
GET    /automation/:id                      → rule detail
PATCH  /automation/:id                      → update rule
DELETE /automation/:id                      → delete rule
PATCH  /automation/:id/toggle              → enable/disable
GET    /automation/:id/history             → execution history
```

Body: `create-automation-rule`
```json
{
  "name": "Overdue escalation",
  "trigger": "TASK_OVERDUE",
  "conditions": [
    { "field": "priority", "operator": "eq", "value": "HIGH" }
  ],
  "action": "NOTIFY_MANAGER",
  "actionConfig": {
    "message": "High priority task is overdue"
  }
}
```

---

## SEARCH MODULE

```
GET    /search?q=payment&types=tasks,users,projects   → global search
```

---

## CALENDAR MODULE

```
GET    /calendar/events                     → calendar events (tasks by due date)
GET    /calendar/team                       → team calendar
PATCH  /calendar/reschedule/:taskId         → drag/drop reschedule
```

---

## KANBAN MODULE

```
GET    /kanban                              → kanban board data (all columns)
PATCH  /kanban/:taskId/move                → move task to column (status change)
GET    /kanban/team                         → team kanban
```

---

## FORMS MODULE

```
GET    /forms                               → list forms
POST   /forms                               → create form
GET    /forms/:id                           → form detail
PATCH  /forms/:id                           → update form
DELETE /forms/:id                           → delete form
POST   /forms/:id/response                  → submit form response
GET    /forms/:id/responses                 → list responses
```

---

## AI MODULE

```
POST   /ai/generate-workflow               → generate workflow from prompt
POST   /ai/generate-checklist             → generate checklist items from prompt
POST   /ai/suggest-assignee               → suggest best assignee for task
POST   /ai/predict-delay                  → predict delay probability
POST   /ai/summarize                      → summarize tasks/MIS/approvals
POST   /ai/assistant                      → AI assistant chat query
```

---

## CLIENT PORTAL

```
POST   /client/auth/login                  → client login
GET    /client/requests                    → client's submitted requests
POST   /client/requests                    → create new request
GET    /client/requests/:id               → request status
POST   /client/requests/:id/approve      → client approves proof
GET    /client/reports                    → client-accessible reports
```

---

## VENDOR PORTAL

```
POST   /vendor/auth/login                  → vendor login
GET    /vendor/rfqs                        → quote requests assigned to vendor
POST   /vendor/rfqs/:id/quote            → submit quote
PATCH  /vendor/rfqs/:id/status           → update status
GET    /vendor/rfqs/:id/documents        → view documents
```

---

## SETTINGS MODULE

```
GET    /settings/company                   → company settings
PATCH  /settings/company                   → update
GET    /settings/billing                   → subscription + invoices
POST   /settings/billing/upgrade           → upgrade plan
GET    /settings/security                  → security settings
PATCH  /settings/security                  → update (2FA policy, session timeout)
GET    /settings/notification-rules        → global notification rules
PATCH  /settings/notification-rules       → update
GET    /settings/import-export            → import/export center
POST   /settings/backup                   → trigger data backup
```

---

## HTTP Status Codes Used

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content (delete) |
| 400 | Bad Request / Validation error |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (role/permission denied) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable Entity |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

| Route | Limit |
|---|---|
| POST /auth/login | 10 req/min per IP |
| POST /auth/forgot-password | 5 req/min per IP |
| POST /ai/* | 20 req/min per tenant |
| All other routes | 300 req/min per tenant |

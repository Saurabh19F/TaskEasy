# TaskEasy — Complete Project Structure

---

## Repository Layout (Monorepo)

```
taskeasy/
├── apps/
│   ├── api/                        # NestJS Backend
│   └── web/                        # Next.js Frontend
├── packages/
│   ├── shared-types/               # Shared TypeScript types/enums
│   └── shared-utils/               # Shared utility functions
├── prisma/
│   └── schema.prisma               # MongoDB Prisma schema
├── docker-compose.yml              # Local dev: Redis, MongoDB
├── .env.example
└── README.md
```

---

## Backend: `apps/api/` (NestJS)

```
apps/api/
├── src/
│   ├── main.ts                     # Bootstrap, Swagger, global pipes
│   ├── app.module.ts               # Root module
│   │
│   ├── common/                     # Shared utilities
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── tenant.decorator.ts
│   │   │   └── permissions.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── tenant.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── permissions.guard.ts
│   │   ├── interceptors/
│   │   │   ├── audit.interceptor.ts
│   │   │   ├── cache.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── pipes/
│   │   │   └── parse-object-id.pipe.ts
│   │   ├── utils/
│   │   │   ├── date.utils.ts          # ISO date, delay calc, working days
│   │   │   ├── id-generator.utils.ts  # TASK-2024-001 style IDs
│   │   │   ├── mis.utils.ts           # Score formula
│   │   │   └── cache-keys.utils.ts    # Redis key builders
│   │   └── constants/
│   │       ├── permissions.ts         # All permission keys
│   │       └── cache-ttl.ts           # TTL values
│   │
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   │
│   ├── redis/
│   │   ├── redis.module.ts
│   │   └── redis.service.ts
│   │
│   ├── queue/
│   │   ├── queue.module.ts
│   │   └── processors/
│   │       ├── email.processor.ts
│   │       ├── notification.processor.ts
│   │       ├── checklist.processor.ts
│   │       ├── fms.processor.ts
│   │       ├── escalation.processor.ts
│   │       ├── mis.processor.ts
│   │       ├── report.processor.ts
│   │       ├── automation.processor.ts
│   │       └── ai.processor.ts
│   │
│   ├── modules/
│   │   │
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── jwt-refresh.strategy.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       ├── refresh-token.dto.ts
│   │   │       └── reset-password.dto.ts
│   │   │
│   │   ├── tenants/
│   │   │   ├── tenants.module.ts
│   │   │   ├── tenants.controller.ts
│   │   │   ├── tenants.service.ts
│   │   │   └── dto/
│   │   │       ├── create-tenant.dto.ts
│   │   │       └── update-tenant.dto.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   │       ├── create-user.dto.ts
│   │   │       ├── update-user.dto.ts
│   │   │       └── bulk-import-user.dto.ts
│   │   │
│   │   ├── roles/
│   │   │   ├── roles.module.ts
│   │   │   ├── roles.controller.ts
│   │   │   ├── roles.service.ts
│   │   │   └── dto/
│   │   │       └── create-role.dto.ts
│   │   │
│   │   ├── projects/
│   │   │   ├── projects.module.ts
│   │   │   ├── projects.controller.ts
│   │   │   ├── projects.service.ts
│   │   │   └── dto/
│   │   │       ├── create-project.dto.ts
│   │   │       └── update-project.dto.ts
│   │   │
│   │   ├── hierarchy/
│   │   │   ├── hierarchy.module.ts
│   │   │   ├── hierarchy.controller.ts
│   │   │   ├── hierarchy.service.ts
│   │   │   └── dto/
│   │   │       └── create-hierarchy.dto.ts
│   │   │
│   │   ├── dashboard/
│   │   │   ├── dashboard.module.ts
│   │   │   ├── dashboard.controller.ts
│   │   │   └── dashboard.service.ts
│   │   │
│   │   ├── delegation/
│   │   │   ├── delegation.module.ts
│   │   │   ├── delegation.controller.ts
│   │   │   ├── delegation.service.ts
│   │   │   └── dto/
│   │   │       ├── create-task.dto.ts
│   │   │       ├── submit-task.dto.ts
│   │   │       └── approve-task.dto.ts
│   │   │
│   │   ├── work-request/
│   │   │   ├── work-request.module.ts
│   │   │   ├── work-request.controller.ts
│   │   │   ├── work-request.service.ts
│   │   │   └── dto/
│   │   │       ├── create-work-request.dto.ts
│   │   │       ├── submit-work-request.dto.ts
│   │   │       └── approve-work-request.dto.ts
│   │   │
│   │   ├── checklist/
│   │   │   ├── checklist.module.ts
│   │   │   ├── checklist.controller.ts
│   │   │   ├── checklist.service.ts
│   │   │   ├── checklist-generator.service.ts
│   │   │   └── dto/
│   │   │       ├── create-checklist-master.dto.ts
│   │   │       └── complete-checklist.dto.ts
│   │   │
│   │   ├── fms/
│   │   │   ├── fms.module.ts
│   │   │   ├── fms.controller.ts
│   │   │   ├── fms.service.ts
│   │   │   ├── fms-import.service.ts
│   │   │   └── dto/
│   │   │       ├── create-fms-workflow.dto.ts
│   │   │       ├── create-fms-step.dto.ts
│   │   │       └── complete-fms-task.dto.ts
│   │   │
│   │   ├── workflow/
│   │   │   ├── workflow.module.ts
│   │   │   ├── workflow.controller.ts
│   │   │   ├── workflow.service.ts
│   │   │   └── dto/
│   │   │       └── create-workflow.dto.ts
│   │   │
│   │   ├── approval/
│   │   │   ├── approval.module.ts
│   │   │   ├── approval.controller.ts
│   │   │   ├── approval.service.ts
│   │   │   └── dto/
│   │   │       └── approval-action.dto.ts
│   │   │
│   │   ├── mis/
│   │   │   ├── mis.module.ts
│   │   │   ├── mis.controller.ts
│   │   │   ├── mis.service.ts
│   │   │   └── mis-calculator.service.ts
│   │   │
│   │   ├── reports/
│   │   │   ├── reports.module.ts
│   │   │   ├── reports.controller.ts
│   │   │   ├── reports.service.ts
│   │   │   └── dto/
│   │   │       └── report-filter.dto.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.controller.ts
│   │   │   └── notifications.service.ts
│   │   │
│   │   ├── uploads/
│   │   │   ├── uploads.module.ts
│   │   │   ├── uploads.controller.ts
│   │   │   └── uploads.service.ts
│   │   │
│   │   ├── comments/
│   │   │   ├── comments.module.ts
│   │   │   ├── comments.controller.ts
│   │   │   ├── comments.service.ts
│   │   │   └── dto/
│   │   │       └── create-comment.dto.ts
│   │   │
│   │   ├── audit/
│   │   │   ├── audit.module.ts
│   │   │   ├── audit.controller.ts
│   │   │   └── audit.service.ts
│   │   │
│   │   ├── automation/
│   │   │   ├── automation.module.ts
│   │   │   ├── automation.controller.ts
│   │   │   ├── automation.service.ts
│   │   │   └── dto/
│   │   │       └── create-automation-rule.dto.ts
│   │   │
│   │   ├── ai/
│   │   │   ├── ai.module.ts
│   │   │   ├── ai.controller.ts
│   │   │   └── ai.service.ts
│   │   │
│   │   ├── forms/
│   │   │   ├── forms.module.ts
│   │   │   ├── forms.controller.ts
│   │   │   └── forms.service.ts
│   │   │
│   │   ├── search/
│   │   │   ├── search.module.ts
│   │   │   ├── search.controller.ts
│   │   │   └── search.service.ts
│   │   │
│   │   ├── calendar/
│   │   │   ├── calendar.module.ts
│   │   │   ├── calendar.controller.ts
│   │   │   └── calendar.service.ts
│   │   │
│   │   ├── kanban/
│   │   │   ├── kanban.module.ts
│   │   │   ├── kanban.controller.ts
│   │   │   └── kanban.service.ts
│   │   │
│   │   ├── client-portal/
│   │   │   ├── client-portal.module.ts
│   │   │   ├── client-portal.controller.ts
│   │   │   └── client-portal.service.ts
│   │   │
│   │   └── vendor-portal/
│   │       ├── vendor-portal.module.ts
│   │       ├── vendor-portal.controller.ts
│   │       └── vendor-portal.service.ts
│   │
│   └── config/
│       ├── app.config.ts
│       ├── jwt.config.ts
│       ├── redis.config.ts
│       └── cloudinary.config.ts
│
├── test/
│   ├── auth.e2e-spec.ts
│   └── delegation.e2e-spec.ts
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## Frontend: `apps/web/` (Next.js 14)

```
apps/web/
├── src/
│   ├── app/                            # App Router pages
│   │   ├── layout.tsx                  # Root layout (fonts, providers)
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   └── reset-password/
│   │   │       └── page.tsx
│   │   ├── (app)/                      # Protected app shell
│   │   │   ├── layout.tsx              # Sidebar + header wrapper
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── delegation/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [taskId]/
│   │   │   │       └── page.tsx
│   │   │   ├── work-request/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [requestId]/
│   │   │   │       └── page.tsx
│   │   │   ├── checklist/
│   │   │   │   └── page.tsx
│   │   │   ├── fms/
│   │   │   │   ├── page.tsx
│   │   │   │   └── workflow-builder/
│   │   │   │       └── page.tsx
│   │   │   ├── approve-review/
│   │   │   │   └── page.tsx
│   │   │   ├── mis/
│   │   │   │   └── page.tsx
│   │   │   ├── reports/
│   │   │   │   └── page.tsx
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [projectId]/
│   │   │   │       └── page.tsx
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   ├── hierarchy/
│   │   │   │   └── page.tsx
│   │   │   ├── kanban/
│   │   │   │   └── page.tsx
│   │   │   ├── calendar/
│   │   │   │   └── page.tsx
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx
│   │   │   ├── automation/
│   │   │   │   └── page.tsx
│   │   │   ├── audit-logs/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       ├── company/
│   │   │       │   └── page.tsx
│   │   │       └── security/
│   │   │           └── page.tsx
│   │   └── client-portal/              # Separate portal layout
│   │       └── [...]/
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx            # Main shell wrapper
│   │   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   │   ├── Header.tsx              # Top navbar
│   │   │   ├── NotificationBell.tsx
│   │   │   └── UserDropdown.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── MetricCard.tsx          # Total/Done/Pending/Delayed card
│   │   │   ├── TaskTrendChart.tsx
│   │   │   ├── ProjectHealthCard.tsx
│   │   │   ├── CriticalTasksTable.tsx
│   │   │   ├── PersonalPriorityList.tsx
│   │   │   ├── TeamWorkloadChart.tsx
│   │   │   └── DashboardFilters.tsx
│   │   │
│   │   ├── delegation/
│   │   │   ├── AssignTaskForm.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskTable.tsx
│   │   │   ├── TaskDetailDrawer.tsx
│   │   │   ├── SubmitTaskModal.tsx
│   │   │   └── ApproveTaskModal.tsx
│   │   │
│   │   ├── work-request/
│   │   │   ├── CreateRequestForm.tsx
│   │   │   ├── RequestCard.tsx
│   │   │   └── RequestDetailDrawer.tsx
│   │   │
│   │   ├── checklist/
│   │   │   ├── AssignChecklistForm.tsx
│   │   │   ├── ChecklistTaskRow.tsx
│   │   │   └── BulkCompleteModal.tsx
│   │   │
│   │   ├── fms/
│   │   │   ├── FmsTaskTable.tsx
│   │   │   ├── WorkflowBuilder.tsx
│   │   │   ├── FlowMapView.tsx
│   │   │   ├── FmsImportModal.tsx
│   │   │   └── AiGenerateModal.tsx
│   │   │
│   │   ├── approve-review/
│   │   │   ├── ApprovalTable.tsx
│   │   │   └── ApprovalActionModal.tsx
│   │   │
│   │   ├── mis/
│   │   │   ├── EmployeeScoreCard.tsx
│   │   │   ├── MisKpiTable.tsx
│   │   │   ├── MisDrillDownModal.tsx
│   │   │   └── WeeklySnapshotModal.tsx
│   │   │
│   │   ├── reports/
│   │   │   ├── ReportFilters.tsx
│   │   │   ├── ReportTable.tsx
│   │   │   └── ExportButtons.tsx
│   │   │
│   │   ├── kanban/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   └── KanbanCard.tsx
│   │   │
│   │   ├── calendar/
│   │   │   └── TaskCalendar.tsx
│   │   │
│   │   ├── comments/
│   │   │   ├── CommentThread.tsx
│   │   │   └── ActivityTimeline.tsx
│   │   │
│   │   ├── users/
│   │   │   ├── UserTable.tsx
│   │   │   └── UserModal.tsx
│   │   │
│   │   ├── hierarchy/
│   │   │   ├── HierarchyTree.tsx
│   │   │   └── GroupModal.tsx
│   │   │
│   │   ├── notifications/
│   │   │   └── NotificationList.tsx
│   │   │
│   │   └── ui/                         # Base UI components (ShadCN extended)
│   │       ├── DataTable.tsx           # TanStack Table wrapper
│   │       ├── StatusBadge.tsx
│   │       ├── PriorityBadge.tsx
│   │       ├── AvatarGroup.tsx
│   │       ├── FilterBar.tsx
│   │       ├── DateRangePicker.tsx
│   │       ├── FileUpload.tsx
│   │       ├── ConfirmModal.tsx
│   │       ├── EmptyState.tsx
│   │       ├── SkeletonCard.tsx
│   │       └── GradeChip.tsx
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts               # Axios instance with auth + refresh
│   │   │   ├── auth.api.ts
│   │   │   ├── delegation.api.ts
│   │   │   ├── work-request.api.ts
│   │   │   ├── checklist.api.ts
│   │   │   ├── fms.api.ts
│   │   │   ├── approval.api.ts
│   │   │   ├── dashboard.api.ts
│   │   │   ├── mis.api.ts
│   │   │   ├── reports.api.ts
│   │   │   ├── users.api.ts
│   │   │   ├── projects.api.ts
│   │   │   ├── notifications.api.ts
│   │   │   └── uploads.api.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useDelegation.ts
│   │   │   ├── useWorkRequest.ts
│   │   │   ├── useChecklist.ts
│   │   │   ├── useFms.ts
│   │   │   ├── useDashboard.ts
│   │   │   ├── useMis.ts
│   │   │   ├── useNotifications.ts
│   │   │   └── usePermission.ts
│   │   │
│   │   ├── store/                      # Zustand stores
│   │   │   ├── auth.store.ts
│   │   │   ├── notification.store.ts
│   │   │   └── ui.store.ts
│   │   │
│   │   └── utils/
│   │       ├── date.ts
│   │       ├── export.ts               # Excel + PDF export helpers
│   │       ├── permissions.ts
│   │       └── format.ts
│   │
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── task.types.ts
│   │   ├── user.types.ts
│   │   ├── project.types.ts
│   │   ├── mis.types.ts
│   │   └── api.types.ts
│   │
│   └── providers/
│       ├── QueryProvider.tsx           # TanStack Query
│       ├── AuthProvider.tsx
│       └── ThemeProvider.tsx
│
├── public/
│   ├── logo.svg
│   ├── favicon.ico
│   └── manifest.json                  # PWA manifest
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Guard Pipeline (per API request)

```
Request
  → JwtAuthGuard          [validates JWT, extracts user+tenantId]
  → TenantGuard           [confirms tenantId matches, tenant is active]
  → RolesGuard            [checks user.role is in allowed roles]
  → PermissionsGuard      [checks user has required permissions]
  → Controller Method
  → Service (always filters by tenantId)
  → AuditInterceptor      [logs write actions automatically]
  → CacheInterceptor      [caches GET responses, invalidates on writes]
  → TransformInterceptor  [standard { data, meta, success } response shape]
```

---

## Standard API Response Shape

```typescript
// Success
{
  success: true,
  data: { ... },
  meta: { page, limit, total }  // for paginated responses
}

// Error
{
  success: false,
  error: {
    code: "TASK_NOT_FOUND",
    message: "Task not found or access denied",
    statusCode: 404
  }
}
```

---

## Role → Module Access Matrix

| Module | SaaS Owner | Super Admin | Admin | Manager | Team Lead | Employee | Viewer | Auditor |
|---|---|---|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ (team) | ✅ (team) | ✅ (team) | ✅ (own) | 👁️ | 👁️ |
| Delegation | ✅ | ✅ | ✅ | ✅ | ✅ | Own only | 👁️ | 👁️ |
| Work Request | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ |
| Checklist | ✅ | ✅ | ✅ | ✅ | ✅ | Own only | 👁️ | 👁️ |
| FMS | ✅ | ✅ | ✅ | ✅ | ✅ | Own only | 👁️ | 👁️ |
| Approve/Review | ✅ | ✅ | ✅ | ✅ | Limited | Track only | ❌ | 👁️ |
| MIS | ✅ | ✅ | ✅ (team) | ✅ (team) | Limited | Own | ❌ | ✅ |
| Reports | ✅ | ✅ | ✅ | ✅ | Limited | Own | 👁️ | ✅ |
| Users | ✅ | ✅ | Limited | ❌ | ❌ | ❌ | ❌ | 👁️ |
| Projects | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 👁️ | 👁️ |
| Hierarchy | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ |
| Automation | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 👁️ |
| Audit Logs | ✅ | ✅ | Limited | ❌ | ❌ | ❌ | ❌ | ✅ |
| Settings | ✅ | ✅ | Limited | ❌ | ❌ | ❌ | ❌ | ❌ |
| Billing | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

✅ = Full access  👁️ = Read only  ❌ = No access

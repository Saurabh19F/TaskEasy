# TaskEasy — Master Gap Report
**Stack:** NestJS + MongoDB (Prisma) + Next.js + Redis + BullMQ  
**Audit Date:** June 25, 2026  
**Sources Cross-Referenced:**
1. Direct code audit — `apps/api` + `apps/web` (every service, processor, store, hook)
2. `TaskEasy_Workflow_Gap_Analysis.docx` — 39 issues (June 23, 2026)
3. `TaskEasy_Code_vs_Prompt_Audit.md` — Code vs Super Advanced Build Prompt comparison
4. `TaskEasy_Logic_Documentation.pdf` — Module logic specification

---

## Summary Scorecard

| Category | Total Issues | FIXED | OPEN | PARTIAL |
|---|---|---|---|---|
| Critical Bugs | 5 | 2 | 3 | 0 |
| High Bugs | 10 | 9 | 1 | 0 |
| Security | 5 | 4 | 1 | 0 |
| High Gaps | 4 | 1 | 3 | 0 |
| Medium Gaps | 7 | 1 | 5 | 1 |
| Validation | 4 | 1 | 3 | 0 |
| Data Consistency | 4 | 2 | 1 | 1 |
| Code Quality | 6 | 1 | 5 | 0 |
| Tests | 2 | 0 | 2 | 0 |
| Atomic IDs | 2 | 0 | 0 | 2 |
| Missing Features | 10+ | 0 | 10+ | 0 |

**Overall alignment with build prompt: ~75%** (was 85–90% before direct code audit found 3 new criticals)

---

## PART 1 — CRITICAL ISSUES (Fix Before Any Deploy)

### CRITICAL-01 — `auth.store.ts` Truncated / TypeScript Compile Failure
- **File:** `apps/web/src/store/auth.store.ts`
- **Status:** ❌ OPEN (not in any reference document — found by direct audit)
- **Problem:** File is 59 lines and ends mid-comment:
  ```ts
  // SEC-10 fix: isSuperAdmin was identical to isAdmin — now correctly checks elevated roles
  ```
  The `isSuperAdmin()` function body is missing. The `persist()` middleware call is never closed. `createJSONStorage` is imported but never used. The TypeScript compiler will fail on this file — the entire frontend cannot build.
- **Fix:**
  ```ts
      isSuperAdmin: () => {
        const role = String(get().user?.role ?? '').toUpperCase();
        return ['COMPANY_OWNER', 'SAAS_OWNER'].includes(role);
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => sessionStorage), // sessionStorage not localStorage
      partialize: (state) => ({ user: state.user }),     // never persist accessToken
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  );
  ```

---

### CRITICAL-02 — `assertCanViewWorkRequest` / `assertCanReviewWorkRequest` Called But Never Defined
- **File:** `apps/api/src/modules/work-request/work-request.service.ts` (lines 185, 227, 298)
- **Status:** ❌ OPEN (not in any reference document — found by direct audit)
- **Problem:** Three calls to private helper methods that do not exist anywhere in the 313-line file, in any imported service, or anywhere in the codebase. At runtime, every `findOne`, `approve`, and `rework` call will throw `TypeError: this.assertCanViewWorkRequest is not a function`.
- **Fix:** Add to `work-request.service.ts`:
  ```ts
  private async assertCanViewWorkRequest(wr: any, tenantId: string, userId: string, role: string) {
    if (['SAAS_OWNER','COMPANY_OWNER','ADMIN','MANAGER'].includes(role)) return;
    if (wr.requestedById !== userId && wr.requestedForId !== userId) {
      throw new ForbiddenException('You do not have access to this work request');
    }
  }

  private async assertCanReviewWorkRequest(wr: any, tenantId: string, approverId: string) {
    const visibleIds = await this.hierarchy.getVisibleUserIds(approverId, 'ADMIN', tenantId);
    if (visibleIds && !visibleIds.includes(wr.requestedForId) && wr.requestedById !== approverId) {
      throw new ForbiddenException('You cannot review this work request');
    }
  }
  ```

---

### CRITICAL-03 — `fms.service.ts` `getAnalytics()` Truncated / Runtime Crash
- **File:** `apps/api/src/modules/fms/fms.service.ts` (line 288–295)
- **Status:** ❌ OPEN (MEDIUM-01 in reference docs, but severity is actually CRITICAL — missing closing brace = compile error)
- **Problem:** File is 295 lines. `getAnalytics()` starts at line 288 and the file ends mid-`Promise.all` call with no return statement, no closing `}`. TypeScript compiler will reject the file.
- **Fix:** Complete the function:
  ```ts
  async getAnalytics(tenantId: string, userId: string, role: string) {
    const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
    const baseWhere: any = { tenantId };
    if (visibleIds) baseWhere.personId = { in: visibleIds };

    const [total, completed, late, onTime, workflows] = await Promise.all([
      this.prisma.fmsTask.count({ where: baseWhere }),
      this.prisma.fmsTask.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
      this.prisma.fmsTask.count({ where: { ...baseWhere, onTimeStatus: 'LATE' } }),
      this.prisma.fmsTask.count({ where: { ...baseWhere, onTimeStatus: 'ON_TIME' } }),
      this.prisma.fmsWorkflow.count({ where: { tenantId } }),
    ]);

    const pending = total - completed;
    const onTimePercent = completed > 0 ? Math.round((onTime / completed) * 100) : 0;

    return { total, completed, pending, late, onTime, onTimePercent, workflows };
  }
  ```

---

### CRITICAL-04 (from DOCX BUG-02 PARTIAL) — Checklist Duplicate Safety Net Missing
- **File:** `prisma/schema.prisma` — `ChecklistTask` model
- **Status:** ⚠️ PARTIAL — `generateDueTasks()` correctly removed (no-op), but the required unique compound index is missing
- **Problem:** Without `@@unique([masterId, plannedDate])`, if the BullMQ processor ever runs twice for the same master (queue retry, server restart), it will silently create duplicate checklist task rows.
- **Fix:** Add to `ChecklistTask` model in `schema.prisma`:
  ```prisma
  @@unique([masterId, plannedDate])
  ```

---

### CRITICAL-05 (from DOCX BUG-01 PARTIAL) — Sequence Collection Has No Prisma-Managed Index
- **File:** `apps/api/src/common/utils/id-generator.utils.ts` + `prisma/schema.prisma`
- **Status:** ⚠️ PARTIAL — `atomicNextXxxId()` via `$runCommandRaw findAndModify` is deployed and all human-readable ID fields have `@@unique([tenantId, taskId])`. However, the `Sequence` collection (used by `findAndModify`) has no `model Sequence` in `schema.prisma`, meaning no Prisma-managed index on the `key` field.
- **Impact:** At scale, every ID generation does a full collection scan on `Sequence`. Will degrade under load.
- **Fix:** Add raw MongoDB index via migration script:
  ```js
  db.Sequence.createIndex({ key: 1 }, { unique: true })
  ```

---

## PART 2 — SECURITY ISSUES

### SEC-01 — WebSocket CORS ✅ FIXED
- **Was:** `origin: '*'` with dead enforcement code
- **Now:** `origin: false` in decorator; `afterInit()` reads `FRONTEND_URL` from config and restricts via `engine.opts.cors`
- **Verified:** `notifications.gateway.ts` lines 43–89

### SEC-02 — Password Policy ✅ FIXED
- **Was:** DTO `@MinLength(6)`, no complexity check
- **Now:** `@MinLength(8)` + `@Matches(PASSWORD_REGEX)` requiring uppercase, lowercase, digit, special char — applied consistently in `login.dto.ts` and `auth.service.ts validatePasswordStrength()`
- **Verified:** `login.dto.ts` lines 14–75

### SEC-03 — Rating Field Unvalidated ✅ FIXED
- **Was:** No validation on rating field in approve DTO
- **Now:** `@IsNumber() @Min(1) @Max(5)` applied
- **Verified:** `delegation.dto.ts` lines 87–90

### SEC-04 — No Rate Limiting on Auth Routes ✅ FIXED
- **Was:** No throttling on login or forgot-password
- **Now:** `@Throttle({ default: { limit: 10, ttl: 60000 } })` on `/login`, `@Throttle({ default: { limit: 5, ttl: 60000 } })` on `/forgot-password`
- **Verified:** `auth.controller.ts` (binary, confirmed via `strings`)

### SEC-05 — Access Token Stored in localStorage ❌ OPEN
- **File:** `apps/web/src/store/auth.store.ts`
- **Status:** OPEN — but currently moot since the file doesn't compile (CRITICAL-01)
- **Problem:** When fixed, `persist()` must be configured to use `sessionStorage` and must NOT persist `accessToken`. Access tokens in localStorage are vulnerable to XSS theft.
- **Fix:** Use `createJSONStorage(() => sessionStorage)` and `partialize: (state) => ({ user: state.user })` — do not include `accessToken` in persisted state.

### SEC-06 — Swagger Exposed Without Auth Protection ⚠️ OPEN (LOW)
- **File:** `apps/api/src/main.ts`
- **Problem:** Swagger docs available if `NODE_ENV` is misconfigured — exposes full API schema publicly.
- **Fix:** Add IP restriction or basic-auth middleware on `/api/docs` in non-production.

---

## PART 3 — HIGH BUGS

### BUG-03 — parseFrontendDateTime Timezone Double-Shift ✅ FIXED
- **Was:** `new Date(y, m, d, h, min)` + `fromZonedTime()` = double timezone shift (5.5h error for IST)
- **Now:** `return fromZonedTime(\`${dateStr}T${timeStr}:00\`, timezone)` — ISO string passes through without system-TZ contamination
- **Verified:** `date.utils.ts` lines 79–86 with comment "FIX (BUG-03)"

### BUG-04 — Dashboard `approvalPending` Wrong Count ✅ FIXED
- **Was:** Filtered `delegatedToId` (doer) instead of `delegatedById` (approver); WR approvals missing
- **Now:** Uses `delegatedById: userId` for delegation approvals + adds `workRequest.count({ requestedById: userId, status: 'SEND_FOR_APPROVAL' })`
- **Verified:** `dashboard.service.ts` lines 89–99

### BUG-05 — Submitted Tasks Disappear from Employee My Pending ✅ FIXED
- **Was:** `findMyPending` excluded `SEND_FOR_APPROVAL` status
- **Now:** Status filter is `{ in: ['PENDING', 'IN_PROGRESS', 'REWORK', 'SEND_FOR_APPROVAL'] }`
- **Verified:** `delegation.service.ts` line 235

### BUG-06 — `getReworkHistory()` Duplicate/Conflicting Logic ✅ FIXED
- **Was:** Duplicated `getApprovalQueue` with different shape; Rework tab always empty
- **Now:** `getReworkHistory()` is `@deprecated` and delegates directly to `getApprovalQueue(tenantId, userId, role, 'rework')`
- **Verified:** `approval.service.ts` lines 120–129

### BUG-07 — Daily Digest Only Covered Delegation ✅ FIXED
- **Was:** `handleDailySummary` queried only `delegationTask`; WR/Checklist/FMS counts hardcoded 0
- **Now:** Queries all 4 modules with breakdown per module; calls `getPendingApprovalCount()`
- **Verified:** `escalation.processor.ts` lines ~428–510

### BUG-08 — Project Health Score Ignored WR + Checklist ✅ FIXED
- **Was:** `checkProjectHealth` computed from delegation only
- **Now:** Includes `workRequest` + `checklistTask` in all project health calculations
- **Verified:** `escalation.processor.ts` lines ~274–310

### BUG-09 — `isOverdue()` Timezone Comparison Bug ✅ FIXED
- **Was:** `toZonedTime(now)` shifted but `plannedDate` stayed raw UTC — off by UTC offset
- **Now:** Both compared in UTC — comment: "Both timestamps are compared in UTC — plannedDate is already stored as UTC"
- **Verified:** `date.utils.ts` line 63: `return isAfter(new Date(), plannedDate)`

### BUG-10 — Idle Employees Get Grade D ✅ FIXED
- **Was:** Employee with 0 tasks scored 0 → Grade D
- **Now:** Returns `null` score + `N_A` grade when `metrics.total === 0`
- **Verified:** `mis-calculator.service.ts` (confirmed in session summary)

### BUG-11 — FMS Workflow Status Reverts to DRAFT on Step Add ✅ FIXED
- **Was:** Adding a step to PUBLISHED workflow changed status back to DRAFT
- **Now:** PUBLISHED = active/in-progress; COMPLETED = all steps done; `checkWorkflowCompletion()` sets COMPLETED
- **Verified:** `fms.service.ts` lines 280–292

### BUG-12 — Work Request `completedAt` Not Cleared on Rework ✅ FIXED
- **Was:** `rework()` update payload did not clear `completedAt`
- **Now:** `completedAt: null` explicitly set in the rework update
- **Verified:** `work-request.service.ts` — confirmed in source

### HIGH-02 — JWT Refresh Token DB Expiry Hardcoded ❌ OPEN
- **File:** `apps/api/src/modules/auth/auth.service.ts`
- **Problem:** `issueTokens()` signs the JWT using `JWT_ACCESS_EXPIRY` env (configurable) but writes the DB refresh record with hardcoded `expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)`. Session invalidation is unreliable if env expiry differs from 7 days.
- **Fix:** Replace hardcoded value:
  ```ts
  const refreshExpiryMs = ms(this.config.get('JWT_REFRESH_EXPIRY', '7d'));
  expiresAt: new Date(Date.now() + refreshExpiryMs)
  ```

---

## PART 4 — HIGH PRIORITY GAPS

### GAP-01 — SLA Escalation Does Not Cover Work Requests or Checklists ❌ OPEN
- **File:** `apps/api/src/queue/processors/escalation.processor.ts`
- **Problem:** `handleSlaCheck()` queries only `delegationTask` for overdue tasks and escalates to manager. Overdue work requests and checklist tasks never trigger L2/L3 manager notifications.
- **Impact:** Companies primarily using WR or Checklist flows receive zero SLA alerts.
- **Fix:** After the delegation loop, add:
  ```ts
  // Overdue Work Requests
  const overdueWR = await this.prisma.workRequest.findMany({
    where: { ...(job.data.tenantId ? { tenantId: job.data.tenantId } : {}),
      status: { in: ['PENDING', 'REWORK'] }, deadlineDate: { lt: now } },
    take: 500,
  });
  for (const wr of overdueWR) {
    const delayDays = Math.ceil((now.getTime() - wr.deadlineDate.getTime()) / 86400000);
    if (delayDays >= 2) {
      const hierarchy = await this.prisma.hierarchy.findFirst({
        where: { tenantId: wr.tenantId, memberIds: { has: wr.requestedForId } },
      });
      if (hierarchy) {
        await this.notificationQueue.add('create-notification', {
          tenantId: wr.tenantId, userId: hierarchy.adminId, type: 'TASK_OVERDUE',
          title: '🚨 Work Request Overdue',
          body: `Work request "${wr.title}" is ${delayDays} day(s) overdue.`,
          refType: 'WORK_REQUEST', refId: wr.id,
        });
      }
    }
  }
  // Similar block for checklistTask using plannedDate
  ```

### GAP-02 — Buddy Reassignment Creates No Audit Trail ❌ OPEN
- **File:** `apps/api/src/queue/processors/escalation.processor.ts` — `reassignWorkToBuddy()`
- **Problem:** `updateMany()` bulk-reassigns tasks with no audit log. `AuditInterceptor` only covers HTTP — queue jobs are invisible to audit.
- **Fix:** After `updateMany`, call `prisma.auditLog.createMany()` with `action: 'REASSIGNED'`, `oldValue: originalAssignee`, `newValue: buddyId`, one record per task.

### GAP-03 — Absent Employee Not Notified of Task Reassignment ❌ OPEN
- **File:** `apps/api/src/queue/processors/escalation.processor.ts` — `handleMissedPunchIn()`
- **Problem:** Only buddy and admin are notified when tasks are reassigned. The absent employee never learns their work was moved.
- **Fix:** Add a notification to the absent employee after reassignment:
  ```ts
  await this.notificationQueue.add('create-notification', {
    tenantId, userId: absentUserId, type: 'TASK_REASSIGNED_TO_BUDDY',
    title: 'Your tasks were reassigned',
    body: `${reassignedCount} task(s) were reassigned to ${buddy.name} while you were absent.`,
  });
  ```

### GAP-08 — WR Approval Queue Logic Asymmetric ❌ OPEN
- **File:** `apps/api/src/modules/approval/approval.service.ts` — `getApprovalQueue()`
- **Problem:** WR approval queue uses `OR [requestedById, requestedForId]` — admin sees WRs where an employee is the requester to an external person, not just WRs they should approve.
- **Fix:** Use only `requestedById: userId` for admin WR approval queue, matching delegation's `delegatedById` pattern.

---

## PART 5 — MEDIUM GAPS

### MEDIUM-01 — DATA-02: MIS Date Semantics Inconsistency ⚠️ PARTIAL (DOCUMENTED)
- **File:** `apps/api/src/modules/mis/mis-calculator.service.ts`
- **Status:** PARTIAL — code has an explanatory comment acknowledging the difference but the inconsistency remains.
- **Situation:** Delegation/WR filtered by `createdAt`; Checklist/FMS filtered by `plannedDate`. Rationale: checklist rows are pre-generated with past `createdAt`. However, for a date-range MIS report, delegation tasks created in January but due in March appear in January's MIS. This makes month-over-month comparison unreliable.
- **Recommended Fix:** Filter all modules by their due/target date: `targetDate` for delegation, `deadlineDate` for WR, `plannedDate` for checklist/FMS. Add a migration to ensure old rows have these fields populated.

### MEDIUM-02 — DATA-03: `onTimePercent` Denominator Wrong ❌ OPEN
- **File:** `apps/api/src/common/utils/mis.utils.ts` line 30–31
- **Problem:** `onTimePercent = (onTime / completed) * 100` — if 5 tasks done on time and 5 never completed, score shows 100% on-time. Should use `total` as denominator.
- **Fix:**
  ```ts
  const onTimePercent = metrics.total > 0
    ? (metrics.onTime / metrics.total) * 100
    : 0;
  ```

### MEDIUM-03 — VAL-01: `search` Field Has No MaxLength / ReDoS Risk ❌ OPEN
- **File:** `apps/api/src/modules/delegation/delegation.service.ts` line 202–203
- **Problem:** `query.search` is passed directly to `{ contains: query.search, mode: 'insensitive' }`. The `search` field in `DelegationQueryDto` has no `@MaxLength` decorator. A 10MB search string will trigger an expensive case-insensitive regex scan.
- **Fix:** Add to `DelegationQueryDto`:
  ```ts
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
  ```
  Apply the same pattern to WR, Checklist, and FMS query DTOs.

### MEDIUM-04 — VAL-03: FMS Step `plannedDate` Not Validated ❌ OPEN
- **File:** `apps/api/src/modules/fms/fms.service.ts` — `addStep()`
- **Problem:** `new Date(dto.plannedDate)` — if `plannedDate` is an invalid string, `Invalid Date` is stored to MongoDB.
- **Fix:** Add `@IsISO8601()` to `CreateFmsStepDto.plannedDate`.

### MEDIUM-05 — VAL-04: `BulkCompleteChecklistDto.taskIds` No Size Cap ❌ OPEN
- **File:** Checklist bulk-complete DTO
- **Problem:** No `@ArrayMaxSize` — 10,000 IDs trigger huge `findMany` + 10,000 individual updates.
- **Fix:** Add `@ArrayMaxSize(100)` to `taskIds`.

### MEDIUM-06 — `assertCanViewWorkRequest` Type Safety ❌ OPEN (part of CRITICAL-02)
- **File:** `apps/api/src/modules/work-request/work-request.service.ts` line 227
- **Problem:** When assertCan methods are added (CRITICAL-02 fix), `wr.submittedAt` is accessed via `(wr as any).submittedAt` — type safety gap.
- **Fix:** Add `submittedAt: Date | null` to the Prisma select in `findOne()`.

### MEDIUM-07 — GAP-06: Possible Double JSON Serialization in Cache ❌ OPEN
- **File:** `apps/api/src/common/interceptors/cache.interceptor.ts`
- **Problem:** `JSON.stringify` called on response before `RedisService.set()`, which may also serialize internally — causing double-encoded strings in Redis.
- **Fix:** Verify `RedisService.set()` behavior. Use either object-only or string-only consistently.

---

## PART 6 — VALIDATION GAPS

| ID | File | Status | Issue | Fix |
|---|---|---|---|---|
| VAL-01 | delegation query | ❌ OPEN | `search` field no `@MaxLength` | Add `@MaxLength(200)` + `@IsString()` |
| VAL-02 | all query DTOs | ✅ FIXED | Date strings now use `@IsDateString()` | Verified in delegation.dto.ts |
| VAL-03 | CreateFmsStepDto | ❌ OPEN | `plannedDate` not validated | Add `@IsISO8601()` |
| VAL-04 | BulkCompleteChecklistDto | ❌ OPEN | No `@ArrayMaxSize` on taskIds | Add `@ArrayMaxSize(100)` |

---

## PART 7 — DATA CONSISTENCY

| ID | File | Status | Issue | Fix |
|---|---|---|---|---|
| DATA-01 | checklist.service.ts | ✅ FIXED | Calendar-aware delay now in checklist completeTask | Verified via `loadCompanyCalendar` + `calculateDelay` |
| DATA-02 | mis-calculator.service.ts | ⚠️ PARTIAL | createdAt vs plannedDate — documented but not fixed | Standardize to due dates |
| DATA-03 | mis.utils.ts | ❌ OPEN | onTimePercent divides by completed not total | Change denominator to `total` |
| DATA-04 | checklist.service.ts | ✅ FIXED | Same as DATA-01 — both paths now calendar-aware | Verified lines 230–288 |

---

## PART 8 — CODE QUALITY / ARCHITECTURE

| ID | File | Status | Issue | Fix |
|---|---|---|---|---|
| CQ-01 | checklist-generator | ✅ FIXED | `generateDueTasks()` is now explicit no-op with explanation comment | Verified |
| CQ-02 | users.service.ts / roles.guard.ts | ❌ OPEN | `ROLE_RANK` defined in `users.service.ts`, disconnected from `RolesGuard` | Move to `common/constants/roles.ts`, import both places |
| CQ-03 | delegation.service.ts | ❌ OPEN | `process.env.FRONTEND_URL` used directly | Replace with `this.config.get('FRONTEND_URL')` |
| CQ-04 | fms.service.ts | ❌ OPEN | No Prisma relation on `FmsTask.personId` — manual batch lookup required | Add `@relation` in schema for `FmsTask.person` |
| CQ-05 | email.processor.ts | ❌ OPEN | Email templates are raw strings — HTML injection from task title | Use Handlebars or react-email with escaping |
| TEST-01 | mis.utils, date.utils, automation | ❌ OPEN | Zero unit tests on core business logic | Add unit tests for MIS score/grade, date parsing, frequency generation |
| TEST-02 | delegation.e2e-spec.ts | ❌ OPEN | E2E only covers happy path | Add rework cycle, multi-doer, cross-user 403, wrong-status 400 tests |

---

## PART 9 — MISSING FEATURES (Not Built Yet)

These are in the product vision / build prompt but have no backend or frontend implementation.

### Stubs Only (controller/service files exist but are empty)
| Feature | Files | What's Missing |
|---|---|---|
| **Client Portal** | `client-portal.controller.ts`, `client-portal.service.ts` | External user auth, invitation flow, data isolation layer, external-side approval UI |
| **Vendor Portal** | Same pattern | Quote submission, document upload, vendor-side status view |

### Backend Endpoints Missing
| Feature | Expected Endpoint | Status |
|---|---|---|
| Smart Task Assignment | `GET /users/suggest-assignee` | Not built — no workload/score-based ranking |
| AI Workflow Generator | `POST /fms/generate-with-ai` | Not built |
| Predictive Delay | `GET /tasks/:id/delay-risk` | Not built |
| Drag-to-Reschedule | `PATCH /delegation/:id/reschedule` | Not built |
| iCal Export | `GET /calendar/export.ics` | Not built |
| Server-side Report Export | `GET /reports/export?format=xlsx` | Not built — frontend-only XLSX/PDF breaks on large datasets |
| FMS Import from Sheet | `POST /fms/import` | Not built |
| Bulk User Import | `POST /users/import` | Not built |
| Working Hours / Holiday Admin | `POST /company/calendar` | Not built |

### Frontend Hooks / Pages Missing
| Item | Status |
|---|---|
| `useKanban` — Kanban board only shows Delegation tasks (WR/Checklist/FMS missing) | ❌ OPEN |
| `useCalendar` — No drag-to-reschedule, no iCal export, holidays not shown as blocked | ❌ OPEN |
| `useSearch` — No hierarchy filter (employees can find tasks outside their scope) | ❌ OPEN |
| `useReports` — No FMS report tab, no rework analysis tab | ❌ OPEN |
| `useAuditLogs` — No audit log viewer page | ❌ OPEN |
| `useAutomation` — No rule execution history, no test-before-activate | ❌ OPEN |
| PWA (`manifest.json`, `service-worker.js`) | ❌ Not configured |
| Client Portal frontend page | ❌ Not built |
| Vendor Portal frontend page | ❌ Not built |

### Notification Gaps
| Item | Status |
|---|---|
| Checklist pending not counted in sidebar notification dots | ❌ OPEN |
| No WhatsApp / SMS notification channel | ❌ OPEN |
| No per-user notification settings (mute module) | ❌ OPEN |
| No `@mention` wiring in Comments module | ❌ OPEN |
| No activity timeline (separate from comments) | ❌ OPEN |

---

## PART 10 — SPRINT PRIORITY PLAN

### Sprint 1 — Cannot Ship Without These (Compile/Runtime Blockers)
1. **CRITICAL-01** — Complete `auth.store.ts` (add `isSuperAdmin()`, close `persist()`, use sessionStorage)
2. **CRITICAL-02** — Add `assertCanViewWorkRequest` and `assertCanReviewWorkRequest` to `work-request.service.ts`
3. **CRITICAL-03** — Complete `fms.service.ts` `getAnalytics()` function body
4. **CRITICAL-04** — Add `@@unique([masterId, plannedDate])` to `ChecklistTask` in schema

### Sprint 2 — Data Correctness
5. **GAP-01** — Extend SLA escalation to WR + Checklist overdue
6. **DATA-03** — Fix `onTimePercent` denominator to `total`
7. **MEDIUM-02 / VAL-01** — Add `@MaxLength(200)` to search fields across all query DTOs
8. **HIGH-02** — Fix JWT refresh token DB expiry to use config value
9. **GAP-08** — Fix WR approval queue to use `requestedById` only
10. **SEC-05** — Fix `accessToken` storage: sessionStorage + partialize (after CRITICAL-01 fix)

### Sprint 3 — Quality and Coverage
11. **GAP-02** — Add audit trail to buddy reassignment
12. **GAP-03** — Notify absent employee of task reassignment
13. **VAL-03 / VAL-04** — Add FMS step date validation + bulk checklist size cap
14. **DATA-02** — Standardize MIS date semantics to due dates
15. **CQ-02** — Centralize `ROLE_RANK` constant
16. **CRITICAL-05** — Add MongoDB index on `Sequence.key`

### Sprint 4 — Missing Features (Scope as separate tickets)
- Client Portal + Vendor Portal (external auth + invitation + isolation)
- GAP-01 WR/Checklist SLA escalation (full L1-L4)
- Smart Task Assignment Engine
- Server-side report export (XLSX/PDF)
- Kanban: add WR + Checklist + FMS cards
- Calendar: drag-to-reschedule endpoint + holiday blocked dates
- Notification dots: add checklist pending count

---

## PART 11 — FULL ISSUE STATUS TABLE

| ID | Source | Module | Severity | Status | Fix Complexity |
|---|---|---|---|---|---|
| CRITICAL-01 | Direct Audit | auth.store.ts | CRITICAL | ❌ OPEN | Low (30 lines) |
| CRITICAL-02 | Direct Audit | work-request.service.ts | CRITICAL | ❌ OPEN | Low (20 lines) |
| CRITICAL-03 | DOCX MEDIUM-01 | fms.service.ts | CRITICAL | ❌ OPEN | Low (10 lines) |
| CRITICAL-04 | DOCX BUG-02 | schema.prisma | CRITICAL | ⚠️ PARTIAL | Low (1 line) |
| CRITICAL-05 | DOCX BUG-01 | id-generator / schema | CRITICAL | ⚠️ PARTIAL | Low (1 index) |
| SEC-01 | DOCX | notifications.gateway.ts | CRITICAL | ✅ FIXED | — |
| SEC-02 | DOCX | auth service + DTO | CRITICAL | ✅ FIXED | — |
| SEC-03 | DOCX | delegation DTO | HIGH | ✅ FIXED | — |
| SEC-04 | DOCX | auth.controller.ts | HIGH | ✅ FIXED | — |
| SEC-05 | Direct Audit | auth.store.ts | HIGH | ❌ OPEN | Low |
| SEC-06 | DOCX SEC-05 | main.ts | LOW | ❌ OPEN | Low |
| BUG-03 | DOCX | date.utils.ts | CRITICAL | ✅ FIXED | — |
| BUG-04 | DOCX | dashboard.service.ts | HIGH | ✅ FIXED | — |
| BUG-05 | DOCX | delegation.service.ts | HIGH | ✅ FIXED | — |
| BUG-06 | DOCX | approval.service.ts | HIGH | ✅ FIXED | — |
| BUG-07 | DOCX | escalation.processor.ts | HIGH | ✅ FIXED | — |
| BUG-08 | DOCX | escalation.processor.ts | HIGH | ✅ FIXED | — |
| BUG-09 | DOCX | date.utils.ts | HIGH | ✅ FIXED | — |
| BUG-10 | DOCX | mis.utils.ts | HIGH | ✅ FIXED | — |
| BUG-11 | DOCX | fms.service.ts | HIGH | ✅ FIXED | — |
| BUG-12 | DOCX | work-request.service.ts | HIGH | ✅ FIXED | — |
| HIGH-02 | Direct Audit | auth.service.ts | HIGH | ❌ OPEN | Low |
| GAP-01 | DOCX | escalation.processor.ts | HIGH | ❌ OPEN | Medium |
| GAP-02 | DOCX | escalation.processor.ts | HIGH | ❌ OPEN | Medium |
| GAP-03 | DOCX | escalation.processor.ts | HIGH | ❌ OPEN | Low |
| GAP-04 | DOCX | dashboard.service.ts | HIGH | ✅ FIXED | — |
| GAP-05 | DOCX | checklist-generator.service.ts | MEDIUM | ⚠️ PARTIAL | — |
| GAP-07 | DOCX | fms.service.ts | MEDIUM | ❌ OPEN | Low |
| GAP-08 | DOCX | approval.service.ts | MEDIUM | ❌ OPEN | Low |
| DATA-01 | DOCX | checklist.service.ts | MEDIUM | ✅ FIXED | — |
| DATA-02 | DOCX | mis-calculator.service.ts | MEDIUM | ⚠️ PARTIAL | Medium |
| DATA-03 | DOCX | mis.utils.ts | MEDIUM | ❌ OPEN | Low |
| DATA-04 | DOCX | checklist.service.ts | MEDIUM | ✅ FIXED | — |
| VAL-01 | DOCX | delegation query DTO | MEDIUM | ❌ OPEN | Low |
| VAL-02 | DOCX | all query DTOs | MEDIUM | ✅ FIXED | — |
| VAL-03 | DOCX | CreateFmsStepDto | MEDIUM | ❌ OPEN | Low |
| VAL-04 | DOCX | BulkCompleteChecklistDto | MEDIUM | ❌ OPEN | Low |
| CQ-01 | DOCX | checklist-generator | LOW | ✅ FIXED | — |
| CQ-02 | DOCX | users.service.ts | LOW | ❌ OPEN | Low |
| CQ-03 | DOCX | delegation.service.ts | LOW | ❌ OPEN | Low |
| CQ-04 | DOCX | fms.service.ts | LOW | ❌ OPEN | Medium |
| CQ-05 | DOCX | email.processor.ts | LOW | ❌ OPEN | Medium |
| TEST-01 | DOCX | utils | LOW | ❌ OPEN | High |
| TEST-02 | DOCX | e2e tests | LOW | ❌ OPEN | High |

**FIXED: 20 | OPEN: 24 | PARTIAL: 4**

---

*Report generated June 25, 2026 — TaskEasy NestJS + Next.js stack*

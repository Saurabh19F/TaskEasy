# TaskEasy — Full QA Audit Report
**Reviewer:** QA (10 Years Experience)
**Date:** 2026-06-23
**Scope:** Full backend source review — Auth, Delegation, Work Request, Checklist, FMS, Approval, MIS, Dashboard, Escalation, Utilities, Security

---

## SEVERITY LEGEND
| Level | Meaning |
|---|---|
| 🔴 CRITICAL | Data corruption, security breach, or broken core flow |
| 🟠 HIGH | Feature doesn't work correctly, wrong output, data loss risk |
| 🟡 MEDIUM | Wrong behavior in edge cases, UX impact, silent wrong result |
| 🔵 LOW | Code quality, minor inconsistency, missing best practice |

---

## 1. SECURITY ISSUES

### 🔴 [SEC-01] WebSocket CORS is Wide Open
**File:** `notifications/notifications.gateway.ts`
```ts
cors: { origin: '*', credentials: true }
```
`afterInit()` logs but never tightens CORS. Any origin can connect to your WebSocket and receive real-time task/notification events for any user whose JWT they intercept. **Fix:** Read `FRONTEND_URL` from ConfigService inside `afterInit()` and call `server.use()` to restrict origins.

---

### 🔴 [SEC-02] Weak Password Validation — Inconsistent Rules
**File:** `auth.service.ts` + `login.dto.ts`
- `LoginDto` uses `@MinLength(6)` — so you can log in with a 6-char password
- `validatePasswordStrength()` only checks `length < 8` — no uppercase, lowercase, digit, or special char requirement
- These two constraints are also inconsistent with each other (6 vs 8)
**Fix:** Apply a single shared password policy (e.g. `^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%]).{8,}$`) both in DTO and service validator.

---

### 🟠 [SEC-03] Rating Field Has Zero Validation
**File:** `delegation/dto/delegation.dto.ts` — `ApproveDelegationDto`
```ts
@ApiPropertyOptional({ example: 5, description: 'Rating 1-5' })
@IsOptional()
rating?: number;
```
No `@IsNumber()`, `@Min(1)`, or `@Max(5)`. An admin can send `rating: 999999` or `rating: -1` or `rating: "abc"`. These land directly in the DB and corrupt MIS/reporting data.
**Fix:** Add `@IsNumber() @Min(1) @Max(5)`.

---

### 🟠 [SEC-04] No Rate Limiting on Auth Endpoints
**File:** `main.ts` / `auth.controller.ts`
The forgot-password endpoint, login, and 2FA endpoints have no HTTP-level rate limiting. Account lockout triggers at 5 attempts but someone can hammer `/auth/forgot-password` with thousands of emails with no throttling. **Fix:** Add `@nestjs/throttler` and apply `ThrottlerGuard` to auth routes (e.g. 10 req/min on login, 3 req/hour on forgot-password).

---

### 🔵 [SEC-05] Swagger Docs Exposed in Staging/Pre-prod
**File:** `main.ts`
```ts
if (configService.get('NODE_ENV') !== 'production')
```
Swagger is shown in development AND staging. If `NODE_ENV` is set incorrectly in staging, full API docs (all endpoints, schemas, auth flows) are publicly visible. Consider IP-restricting or adding basic-auth to the Swagger route.

---

## 2. CRITICAL LOGIC BUGS

### 🔴 [BUG-01] Duplicate Human-Readable ID Generation (Race Condition)
**Files:** `delegation.service.ts`, `work-request.service.ts`, `checklist.service.ts`
```ts
const existingCount = await prisma.delegationTask.count({ where: { tenantId } });
const taskId = generateDelegationId(existingCount + 1);
```
Two concurrent requests both read `count = 100`, both generate `TASK-2026-0101`. Result: **duplicate `taskId` values** in the DB. `taskId` is the human-readable ID shown to users. If there's no unique constraint on this field, both rows silently coexist with the same ID.
**Fix:** Use a DB-level atomic sequence (e.g. MongoDB `$inc` on a counters collection, or Prisma's `upsert` on a sequences table) — never count + 1 for unique identifiers under concurrent load.

---

### 🔴 [BUG-02] Two Checklist Generators Can Create Duplicate Tasks
**Files:** `checklist-generator.service.ts` (scheduler) + `checklist.processor.ts` (queue)
- `ChecklistProcessor.handleGenerateTasks()` runs on master creation and generates **up to 365 occurrences** from `startDate`
- `ChecklistGeneratorService.generateDueTasks()` also runs on a daily schedule and generates the **next** occurrence from `now`
- The generator checks `findFirst({ where: { masterId, plannedDate } })` for duplicates, but only for the exact computed date from `getNextPlannedDate(frequency, now)` — not the dates already created by the processor

**Scenario:** Master created with frequency=WEEKLY, processor generates 52 weeks of tasks. Next day the scheduler runs, computes next-week's date, and since the exact date may differ by milliseconds (processor used `parseFrontendDateTime` + timezone, scheduler uses `getNextPlannedDate(WEEKLY, now)`), duplicate tasks can be created.
**Fix:** Consolidate into a single generation strategy. Remove `ChecklistGeneratorService.generateDueTasks()` or ensure both paths write `plannedDate` identically and the uniqueness check covers the full range.

---

### 🔴 [BUG-03] `parseFrontendDateTime` Uses Wrong Date Constructor Semantics
**File:** `common/utils/date.utils.ts`
```ts
const zonedDate = new Date(year, month - 1, day, hour, minute, 0);
return fromZonedTime(zonedDate, timezone);
```
`new Date(y, m, d, h, min, 0)` constructs a date in the **Node.js process's local timezone** (often UTC in a Docker container). `fromZonedTime()` then interprets those year/month/day/hour values as being in `timezone`. If the server runs UTC and the tenant's timezone is `Asia/Kolkata` (+5:30), the function constructs a UTC date and then converts it as if it were IST — resulting in a **5h 30m shift error** in all target dates for Indian companies. This silently breaks all due date calculations.
**Fix:** Use `new Date(Date.UTC(year, month-1, day, hour, minute, 0))` or construct a plain ISO string: `return fromZonedTime(\`${dateStr}T${timeStr}:00\`, timezone)`.

---

### 🔴 [BUG-04] `approvalPending` Count in Dashboard is Incorrect
**File:** `dashboard.service.ts`
```ts
// Approval count
this.prisma.delegationTask.count({
  where: { tenantId, status: 'SEND_FOR_APPROVAL', ...(idFilter ? { delegatedToId: idFilter } : {}) }
})
```
`approvalPending` is shown to admins as "tasks waiting for your approval". But filtering by `delegatedToId` finds tasks submitted **by** doers — not tasks the current admin needs to review. The filter should be `delegatedById: userId` (tasks the admin assigned that are now awaiting their review). Additionally, Work Request approvals are entirely missing from this count.

---

### 🟠 [BUG-05] `findMyPending` Hides Tasks Already Submitted for Approval
**File:** `delegation.service.ts`
```ts
status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] }
```
After an employee submits a task (`status = SEND_FOR_APPROVAL`), it vanishes from their "My Pending Tasks" list — they can't track its approval progress. **Fix:** Include `SEND_FOR_APPROVAL` in the status filter or create a separate "My Submissions" endpoint (which actually already exists in ApprovalService but isn't linked from the pending view).

---

### 🟠 [BUG-06] `getReworkHistory` Duplicates `getApprovalQueue(tab='rework')`
**File:** `approval.service.ts`
Both `getReworkHistory()` and `getApprovalQueue(tab='rework')` return items with `status: 'REWORK'`. They use slightly different `wrWhere` construction logic. Two endpoints can return different sets of rework items, creating confusion. `getReworkHistory` is now dead code since the fix to `getApprovalQueue`. **Fix:** Remove `getReworkHistory` or consolidate both into `getApprovalQueue`.

---

### 🟠 [BUG-07] Daily Summary Email Only Counts Delegation Tasks
**File:** `queue/processors/escalation.processor.ts` — `handleDailySummary()`
```ts
pendingApprovals: 0,  // ← hardcoded zero
```
The daily digest email tells users they have N pending tasks and N overdue — but only queries `delegationTask`. Work Requests, Checklists, and FMS tasks are completely ignored. Additionally, `pendingApprovals` is always 0. For a company where most work goes through Checklists or FMS, this email is nearly useless.

---

### 🟠 [BUG-08] Project Health Only Uses Delegation Data
**File:** `escalation.processor.ts` — `checkProjectHealth()`
```ts
const tasks = await this.prisma.delegationTask.findMany({
  where: { tenantId: project.tenantId, projectId: project.id, ... }
});
```
Project health score (0-100) is computed from delegation tasks only. Work Requests and Checklists linked to the same project are ignored. A project with 0 delegations but 50 late checklists will show health = undefined / skip the check entirely (`tasks.length === 0 → continue`).

---

### 🟠 [BUG-09] `isOverdue` Utility Has Incorrect Timezone Comparison
**File:** `common/utils/date.utils.ts`
```ts
export function isOverdue(plannedDate: Date, status: string, timezone: string): boolean {
  const now = toZonedTime(new Date(), timezone);
  return isAfter(now, plannedDate);
}
```
`now` is converted to the timezone (so it shows the correct wall-clock time in that zone), but `plannedDate` is a raw UTC Date object stored in the DB — it is NOT converted to the same timezone. You're comparing an IST-shifted timestamp against a UTC timestamp. The comparison is off by the UTC offset. **Fix:** Either convert both to UTC (remove `toZonedTime`) or convert `plannedDate` to zoned time as well.

---

### 🟠 [BUG-10] MIS Score of 0 Gives Grade 'D' for Idle Employees
**File:** `common/utils/mis.utils.ts`
```ts
if (metrics.total === 0) return 0;  // → scoreToGrade(0) → 'D'
```
An employee with no tasks assigned in the selected period gets score=0 and grade=D. This misrepresents their performance — they simply had nothing to do. **Fix:** Return `null` score and `'N/A'` grade when `total === 0`. The frontend and MIS cards must handle `null`.

---

### 🟠 [BUG-11] FMS Workflow Status Reverts to 'DRAFT' Incorrectly
**File:** `fms.service.ts` — `addStep()`
```ts
if (workflow.status === 'PUBLISHED') {
  await this.prisma.fmsWorkflow.update({ where: { id: workflow.id }, data: { status: 'DRAFT' } });
}
```
This reverts an already-completed workflow to DRAFT when a step is added. But `PUBLISHED` is the name used for "completed" (all steps done), not for a published/active workflow template. This naming clash is confusing, and silently marking a completed workflow as DRAFT could break reports that filter by `status: 'PUBLISHED'`.

---

### 🟠 [BUG-12] `workRequest.rework()` Doesn't Clear `completedAt`
**File:** `work-request.service.ts`
```ts
data: {
  status: 'REWORK',
  reworkRemark: dto.reworkRemark,
  reworkCount: { increment: 1 },
  submittedAt: null,
  approvedAt: null,
  // completedAt: null  ← MISSING
}
```
If `completedAt` was ever set, it persists through a rework cycle. Reports filtering by `completedAt` will count this work request as completed even though it's in REWORK. **Fix:** Add `completedAt: null` to the rework update.

---

## 3. HIGH PRIORITY GAPS

### 🟠 [GAP-01] SLA Escalation Only Covers Delegation — Checklists and WR Silently Skip
**File:** `escalation.processor.ts` — `handleSlaCheck()`
The main SLA check fetches only `delegationTask` for overdue processing. Work Requests with missed deadlines and Checklist tasks (beyond the separate `check-missed` job) never trigger the Level-2 (notify manager) or automation escalation logic. An overdue Work Request never pings the admin at day 2+.

---

### 🟠 [GAP-02] Buddy Reassignment Has No Audit Trail
**File:** `escalation.processor.ts` — `reassignWorkToBuddy()`
`updateMany()` bulk-reassigns tasks but creates no per-task audit log. The `AuditInterceptor` only intercepts HTTP requests — queue jobs are invisible to it. After reassignment, there's no record of "task X was reassigned from A to B on this date at this time." This is a compliance gap.
**Fix:** Manually call `prisma.auditLog.createMany()` after the bulk updateMany with action=`REASSIGNED`.

---

### 🟠 [GAP-03] Absent User Gets No Notification of Task Reassignment
**File:** `escalation.processor.ts` — `handleMissedPunchIn()`
The buddy receives a notification. The admin receives a notification. The absent employee receives **nothing**. When they log in later, they see their tasks are gone with no explanation.

---

### 🟠 [GAP-04] `buildTrend` Makes 56+ DB Queries Per Dashboard Load
**File:** `dashboard.service.ts` — `buildTrend()`
For 7 days × (8 completion queries + 6 delayed queries + 2 pending queries) = **up to 98 queries per dashboard load**. Even though the dashboard result is cached for 5 minutes, the first uncached load — or if Redis is unavailable — will hammer MongoDB.
**Fix:** Replace per-day loops with aggregation pipelines or `groupBy` queries that scan once and bucket by date.

---

### 🟠 [GAP-05] `ChecklistGeneratorService` Has No Retry on Failure
**File:** `checklist-generator.service.ts`
```ts
} catch (err) {
  this.logger.error(`Failed to generate task for master ${master.id}: ${err.message}`);
}
```
Errors are swallowed silently per master. If a DB connection blip causes 50 masters to fail, no alert fires and tomorrow's tasks are never generated. Unlike the processor (which uses BullMQ with built-in retries), the scheduler path has no mechanism to detect or recover. **Fix:** Track failed masterIds and re-queue them, or emit a metric.

---

### 🟡 [GAP-06] HTTP Cache Interceptor May Double-Serialize JSON
**File:** `common/interceptors/cache.interceptor.ts`
```ts
await this.redis.set(key, JSON.stringify(data), DEFAULT_TTL);  // stores string
// ...
const cached = await this.redis.get(key);
return of(JSON.parse(cached));  // parses it back
```
If `RedisService.get()` already deserializes JSON internally (which `RedisService.set()` with an object usually does in most wrappers), calling `JSON.stringify` on an already-stringified response will double-encode it. Then `JSON.parse` on a double-encoded string produces `"[object Object]"`. Needs to be verified against the actual `RedisService` implementation.

---

### 🟡 [GAP-07] FMS ID Generation Ignores Utility Function
**File:** `fms.service.ts` — `createWorkflow()`
```ts
const workflowId = `WF-${String(count + 1).padStart(3, '0')}`;
```
`id-generator.utils.ts` has `generateFmsWorkflowId()` that produces `WF-2026-001`, but the service uses its own inline format `WF-001` (no year). All other modules use the utility. FMS workflow IDs are inconsistent and will collide across years.

---

### 🟡 [GAP-08] `getApprovalQueue` Work Request Logic is Asymmetric
**File:** `approval.service.ts`
For delegation: query uses `delegatedToId` (the doer) to find submissions — correct.
For work requests: query uses `OR: [requestedById, requestedForId]` — which means admins see ALL work requests their team is involved in, including ones where the team member is the requester, not the doer. An admin can see and approve a work request that was created by their employee to someone outside the team. The approver should typically be `requestedById` only.

---

## 4. MISSING VALIDATION

### 🟡 [VAL-01] `DelegationQueryDto.search` Has No Max Length
```ts
@IsOptional()
search?: string;
```
No `@MaxLength()`. A user can send a 10MB search string. With `mode: 'insensitive'` Prisma passes it to MongoDB regex — a crafted string could cause a slow regex (ReDoS). **Fix:** Add `@MaxLength(200)`.

---

### 🟡 [VAL-02] `dateFrom` / `dateTo` Not Validated as Dates
In `DelegationQueryDto`, `WorkRequestQueryDto`, etc.:
```ts
dateFrom?: string;
dateTo?: string;
```
No `@IsDateString()` or `@IsISO8601()`. Invalid values like `"yesterday"` or `"abc"` are passed directly to `new Date("abc")` which produces `Invalid Date` and causes a runtime error or silently stores `NaN` in the query.

---

### 🟡 [VAL-03] FMS `addStep` — `plannedDate` Not Validated
**File:** `fms.service.ts`
```ts
plannedDate: new Date(dto.plannedDate),
```
No check that this is a valid date. `new Date("garbage")` → `Invalid Date` stored to DB.

---

### 🟡 [VAL-04] `BulkCompleteChecklistDto.taskIds` Has No Max Size
No upper bound on how many task IDs can be sent. Sending 10,000 IDs would cause a massive `findMany({ id: { in: [...10000] } })` query + 10,000 individual updates in a `Promise.all`. **Fix:** `@ArrayMaxSize(100)`.

---

## 5. DATA CONSISTENCY ISSUES

### 🟡 [DATA-01] Checklist `completeTask` — `onTimeStatus` Uses Raw Milliseconds, Not Working Days
**File:** `checklist.service.ts`
```ts
const isLate = task.plannedDate < now;
delayDays: isLate ? Math.ceil((now.getTime() - task.plannedDate.getTime()) / 86400000) : 0,
```
Delegation and FMS use `calculateDelay()` with calendar-aware, holiday-excluding working-day logic. Checklist uses raw millisecond math — so completing a checklist on a Monday after a Friday deadline shows 3 delay days (Saturday + Sunday + Monday) instead of 1 working day. MIS scores are inconsistent between modules.

---

### 🟡 [DATA-02] MIS Calculator Filters Checklist/FMS by `plannedDate`, Delegation/WR by `createdAt`
**File:** `mis-calculator.service.ts`
```ts
delegationTask: { createdAt: dateFilter }     // delegation
checklistTask:  { plannedDate: dateFilter }   // checklist
fmsTask:        { plannedDate: dateFilter }   // fms
```
When filtering "This Week's MIS", delegation tasks are those **created** this week, but checklist tasks are those **due** this week. A delegation task created Monday with a Wednesday due date appears in this week's MIS. A checklist task created 2 weeks ago but due this Thursday also appears. These are different semantics and produce an apples-to-oranges comparison.

---

### 🟡 [DATA-03] `onTimePercent` Divides by `completed`, Not `total`
**File:** `mis-calculator.service.ts`
```ts
const onTimePercent = completed > 0 ? Math.round((onTime / completed) * 100) : 0;
```
This gives "% of completed tasks that were on time." It ignores pending/overdue tasks entirely. An employee with 10 tasks, 5 completed on time, 5 never completed shows `onTimePercent = 100%` and `pending = 5` — misleading top-level metric.

---

### 🟡 [DATA-04] `calculateDelay` for Checklist Approval Path Not Called
**File:** `checklist.service.ts` — `completeTask()`
When a checklist is completed, delay is calculated with raw ms (per DATA-01). There's no `loadCompanyCalendar()` call. But when delegations and work requests are approved, they correctly use the calendar-aware path. The checklist completion path skips it entirely.

---

## 6. TEST COVERAGE GAPS

### 🔵 [TEST-01] Zero Unit Tests on Critical Business Logic
The following files have **no unit test coverage** and contain complex branching logic:
- `mis-calculator.service.ts` — MIS score calculation, grade logic
- `mis.utils.ts` — `calculateMisScore()`, `scoreToGrade()`
- `date.utils.ts` — `parseFrontendDateTime()`, `calculateDelay()`, `getPeriodRange()`
- `checklist-generator.service.ts` — ONE_TIME guard, frequency-based generation
- `automation.service.ts` — `triggerEvent()` with condition evaluation
- `escalation.processor.ts` — SLA check, workload, project health, punch-in
- `hierarchy.service.ts` — `getVisibleUserIds()` RBAC branching

These files represent the core correctness of the product. A wrong value in `calculateMisScore()` silently corrupts performance records for all employees.

---

### 🔵 [TEST-02] E2E Tests Miss Rework Cycle and Multi-User Scenarios
**Files:** `delegation.e2e-spec.ts`, `approval.spec.ts`
Existing e2e tests appear to cover the happy path (create → submit → approve). They do not cover:
- Full rework cycle (submit → rework → resubmit → approve)
- Multi-doer delegation (delegatedToIds with 3 users)
- Employee trying to submit another employee's task (should be 403)
- Admin approving a task that isn't `SEND_FOR_APPROVAL` (should be 400)

---

### 🔵 [TEST-03] No Integration Test for Checklist Frequency Generation
`generateOccurrenceDates()` in `checklist.processor.ts` is a pure function that produces dates for DAILY / WEEKLY / MONTHLY etc. Given the bugs found in date generation (DATA-01), this is a high-risk untested function. At minimum: unit test each frequency, assert correct date count and values.

---

## 7. CODE QUALITY ISSUES

### 🔵 [CQ-01] `generateDueTasks` and `generate-tasks` Job Are Architecturally Redundant
As noted in BUG-02, two systems both generate checklist tasks. This is an architectural smell — the design decision (which path is authoritative?) is not documented and causes the duplicate risk. Pick one approach and remove the other.

---

### 🔵 [CQ-02] `ROLE_RANK` in `users.service.ts` Is Disconnected from `RolesGuard`
`users.service.ts` defines `ROLE_RANK` locally to prevent privilege escalation. But `RolesGuard` uses a simple array comparison with no rank awareness. If a new role is added to the guard decorator but not to `ROLE_RANK`, privilege escalation becomes possible again. Centralize role ranking.

---

### 🔵 [CQ-03] `process.env.FRONTEND_URL` Mixed with `ConfigService`
**File:** `delegation.service.ts`
```ts
taskUrl: `${process.env.FRONTEND_URL}/delegation`,
```
The rest of the app uses `ConfigService` (the NestJS-idiomatic way). One direct `process.env` access is easy to miss in environment audits and won't be caught if `ConfigService` validation is added later.

---

### 🔵 [CQ-04] `FmsTask.personId` Has No Prisma Relation — Silent N+1 Risk
**File:** `fms.service.ts`
The code comments this correctly and batches the lookup. But without a Prisma relation, it can't use `include: { person: true }` — making it easy for a future developer to accidentally re-introduce an N+1 query by adding a per-task user lookup in a loop. Add a proper Prisma relation.

---

### 🔵 [CQ-05] Email Templates Are Inline HTML Strings (No Template Engine)
**File:** `queue/processors/email.processor.ts`
```ts
'task-assigned': (d) => `<h2>New Task Assigned</h2><p>Hi ${d.assigneeName}</p>...`
```
Email bodies are raw string templates with no sanitization of `d.*` values. If a task title contains `<script>` or quotes, the email HTML is malformed. Use Handlebars, MJML, or react-email.

---

## 8. SUMMARY TABLE

| ID | Area | Severity | Issue |
|---|---|---|---|
| SEC-01 | WebSocket | 🔴 CRITICAL | CORS `*` allows any origin |
| SEC-02 | Auth | 🔴 CRITICAL | Weak/inconsistent password rules |
| SEC-03 | Approval | 🟠 HIGH | Rating field unvalidated |
| SEC-04 | Auth | 🟠 HIGH | No rate limiting on auth endpoints |
| BUG-01 | All modules | 🔴 CRITICAL | Race condition on ID generation |
| BUG-02 | Checklist | 🔴 CRITICAL | Dual generators create duplicate tasks |
| BUG-03 | Date Utils | 🔴 CRITICAL | `parseFrontendDateTime` timezone bug |
| BUG-04 | Dashboard | 🟠 HIGH | `approvalPending` count is wrong |
| BUG-05 | Delegation | 🟠 HIGH | Submitted tasks disappear from My Pending |
| BUG-06 | Approval | 🟠 HIGH | `getReworkHistory` is now dead/conflicting code |
| BUG-07 | Escalation | 🟠 HIGH | Daily digest ignores 3 of 4 modules |
| BUG-08 | Escalation | 🟠 HIGH | Project health ignores WR+Checklist |
| BUG-09 | Date Utils | 🟠 HIGH | `isOverdue` timezone comparison is wrong |
| BUG-10 | MIS | 🟠 HIGH | Idle employees get grade D |
| BUG-11 | FMS | 🟠 HIGH | Workflow reverts to DRAFT incorrectly |
| BUG-12 | Work Request | 🟠 HIGH | `completedAt` not cleared on rework |
| GAP-01 | Escalation | 🟠 HIGH | SLA escalation skips WR and Checklist |
| GAP-02 | Escalation | 🟠 HIGH | Buddy reassignment has no audit trail |
| GAP-03 | Escalation | 🟠 HIGH | Absent user not notified of reassignment |
| GAP-04 | Dashboard | 🟠 HIGH | `buildTrend` fires 98 queries per load |
| GAP-05 | Checklist | 🟡 MEDIUM | Generator has no retry/alerting on failure |
| GAP-06 | Cache | 🟡 MEDIUM | Possible double JSON serialization |
| GAP-07 | FMS | 🟡 MEDIUM | Workflow ID format inconsistent with utilities |
| GAP-08 | Approval | 🟡 MEDIUM | WR approval queue logic is asymmetric |
| VAL-01 | Validation | 🟡 MEDIUM | No max length on search input |
| VAL-02 | Validation | 🟡 MEDIUM | `dateFrom`/`dateTo` not validated as dates |
| VAL-03 | Validation | 🟡 MEDIUM | FMS `plannedDate` not validated |
| VAL-04 | Validation | 🟡 MEDIUM | `taskIds` array has no max size |
| DATA-01 | Checklist | 🟡 MEDIUM | Checklist delay uses raw ms, not working days |
| DATA-02 | MIS | 🟡 MEDIUM | Inconsistent date filter semantics per module |
| DATA-03 | MIS | 🟡 MEDIUM | `onTimePercent` ignores pending tasks |
| DATA-04 | Checklist | 🟡 MEDIUM | Calendar-aware delay not applied to checklist |
| TEST-01 | Testing | 🔵 LOW | Zero unit tests on core business logic |
| TEST-02 | Testing | 🔵 LOW | E2E tests miss rework/multi-user scenarios |
| TEST-03 | Testing | 🔵 LOW | No test for checklist frequency generation |
| CQ-01 | Architecture | 🔵 LOW | Redundant dual checklist generator systems |
| CQ-02 | RBAC | 🔵 LOW | `ROLE_RANK` disconnected from `RolesGuard` |
| CQ-03 | Config | 🔵 LOW | `process.env` mixed with `ConfigService` |
| CQ-04 | FMS | 🔵 LOW | Missing Prisma relation on `personId` |
| CQ-05 | Email | 🔵 LOW | Raw string email templates, no sanitization |

---

## 9. TOP 5 FIXES TO DO FIRST

1. **BUG-03** — Fix `parseFrontendDateTime` timezone bug. All due dates across the entire app are wrong for non-UTC companies. Every task's on-time/late status is incorrect.

2. **BUG-01** — Replace count-based ID generation with atomic DB sequences. Race conditions will produce duplicate `taskId` values under any real concurrent load.

3. **SEC-01** — Lock down WebSocket CORS. Currently any website can open a WS connection using a stolen JWT and receive real-time task data.

4. **BUG-02** — Remove one of the two checklist generators. The dual-path architecture actively creates duplicate tasks in production.

5. **GAP-04** — Replace `buildTrend`'s per-day loop with a single aggregation query. 98 DB queries on each uncached dashboard load will visibly degrade performance as data grows.

---

*Report generated by full static code review — no automated scanner was used.*

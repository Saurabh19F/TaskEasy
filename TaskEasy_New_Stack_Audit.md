# TaskEasy — New TypeScript Stack Audit Report
**Stack:** NestJS (apps/api) + Next.js (apps/web) + Prisma + MongoDB Atlas + Redis + BullMQ + Socket.IO  
**Date:** 2026-06-25  
**Auditor:** Claude (Cowork)

---

## Executive Summary

The new TypeScript rewrite is **significantly more production-ready** than the old GAS code. The inline BUG-XX / LE-XX / SEC-XX / FE-XX / GAP-XX / DATA-XX comments throughout the codebase show many fixes have already been applied during development. Multi-tenant isolation, timezone-safe dates, atomic IDs, hierarchy-based data filtering, Redis caching, WebSocket notifications, and a full BullMQ escalation engine are all correctly wired.

This report focuses on **remaining gaps** — issues that are not yet fixed, or that are introduced by the new architecture itself.

---

## CRITICAL Gaps (would break the app in production)

---

### CRITICAL-01 — `auth.store.ts` file is truncated / incomplete
**File:** `apps/web/src/store/auth.store.ts` (59 lines)  
**Problem:** The file ends abruptly mid-comment on line 59:
```ts
      // SEC-10 fix: isSuperAdmin was identical to isAdmin — now correctly checks elevated roles
```
The `isSuperAdmin()` implementation is missing. The `persist()` middleware call is never closed. The `createJSONStorage` import is declared but never used. The file has no closing `}`, `)`, or export.

**Impact:** TypeScript compiler will error on this file. The entire web app will fail to build. Even if somehow compiled, `isSuperAdmin()` returns `undefined`, causing sidebar role-visibility to break for super-admin routes.

**Fix:** Complete the function and close the file:
```ts
      isSuperAdmin: () => {
        const role = String(get().user?.role ?? '').toUpperCase();
        return ['COMPANY_OWNER', 'SAAS_OWNER'].includes(role);
      },
    }),
    {
      name: 'taskeasy-auth',
      storage: createJSONStorage(() => sessionStorage), // see SECURITY-01 below
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
```

---

### CRITICAL-02 — `assertCanViewWorkRequest` / `assertCanReviewWorkRequest` never defined
**File:** `apps/api/src/modules/work-request/work-request.service.ts`  
**Lines called:** 185, 227, 298  
**Problem:** Both private helper methods are called but never implemented anywhere in the 313-line file. At runtime these calls throw `TypeError: this.assertCanViewWorkRequest is not a function`.

**Impact:** Every work-request `findOne`, `approve`, and `rework` call crashes with a 500 error. The entire Work Request approval workflow is broken.

**Fix:** Add the private helpers at the bottom of the service:
```ts
private async assertCanViewWorkRequest(
  wr: any,
  tenantId: string,
  userId: string,
  role: string,
) {
  if (isTenantWideRole(role)) return; // SAAS_OWNER / COMPANY_OWNER sees all
  const visibleIds = await this.hierarchy.getVisibleUserIds(userId, role, tenantId);
  if (visibleIds && !visibleIds.includes(wr.requestedById) && !visibleIds.includes(wr.requestedForId)) {
    throw new ForbiddenException('Work request is outside your visibility scope');
  }
}

private async assertCanReviewWorkRequest(
  wr: any,
  tenantId: string,
  reviewerId: string,
) {
  const reviewer = await this.prisma.user.findUnique({
    where: { id: reviewerId },
    select: { role: true },
  });
  if (!reviewer) throw new NotFoundException('Reviewer not found');
  if (isApproverRole(reviewer.role)) return; // admin/manager can always review
  if (wr.requestedById !== reviewerId) {
    throw new ForbiddenException('Only the requester or an admin can approve/rework');
  }
}
```

---

### CRITICAL-03 — `getPeriodRange()` returns `null` but callers destructure without null-check
**File:** `apps/api/src/modules/work-request/work-request.service.ts` line 145  
**Also affects:** any other service that calls `getPeriodRange`  
**Problem:** `getPeriodRange()` signature returns `{ from: Date; to: Date } | null` (returns `null` for unknown period strings). The caller does:
```ts
const { from, to } = getPeriodRange(query.period as any);  // ← null destructure = TypeError
```
**Impact:** Passing any unrecognised `period` value (even from a URL query string) throws `TypeError: Cannot destructure property 'from' of null`. This is a trivially exploitable 500 error.

**Fix:**
```ts
if (query.period) {
  const range = getPeriodRange(query.period as any);
  if (range) where.createdAt = { gte: range.from, lte: range.to };
}
```
Apply the same null-guard in every service that calls `getPeriodRange`.

---

## HIGH Gaps (significant bugs, data or security issues)

---

### HIGH-01 — Checklist task IDs not atomic (concurrent job race condition)
**File:** `apps/api/src/queue/processors/checklist.processor.ts`  
**Line:** `taskId: generateChecklistTaskId(existingCount + i + 1)`  
**Problem:** `existingCount` is fetched with `prisma.checklistTask.count({ where: { tenantId } })` before the batch insert. If two `generate-tasks` jobs run simultaneously for the same tenant (e.g., an admin assigns 3 checklists at once), both jobs read the same `existingCount` and produce overlapping `CL-YYYY-XXXX` IDs. Note: checklist *master* IDs use `atomicNextChecklistMasterId()` correctly — only the *task* IDs have this bug.

**Fix:** Replace the count-based offset with a single `atomicNextSequence` call per task:
```ts
const tasks = await Promise.all(dates.map(async (date) => {
  const seq = await atomicNextSequence(this.prisma, tenantId, 'CL');
  return {
    tenantId, masterId,
    taskId: generateChecklistTaskId(seq),
    // ...rest of fields
  };
}));
```

---

### HIGH-02 — Refresh token DB expiry hardcoded, ignores `JWT_REFRESH_EXPIRY` env var
**File:** `apps/api/src/modules/auth/auth.service.ts` — `issueTokens()` method  
**Problem:** The refresh token JWT is signed with `expiresIn: this.configService.get('JWT_REFRESH_EXPIRY', '7d')` (reads from env). But the DB record is always created with `expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)` (hardcoded 7 days). If the env sets `JWT_REFRESH_EXPIRY=30d`, the DB record expires 23 days before the JWT, causing valid refresh tokens to be rejected. If `JWT_REFRESH_EXPIRY=1d`, the DB thinks the token is valid for 7 days after the JWT has already expired.

**Fix:** Parse the expiry from the env value and use it for both:
```ts
const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRY', '7d');
const expiresAt = parseExpiry(refreshExpiresIn); // helper: '7d'→7*86400000ms, '30d'→30*86400000ms

await this.prisma.refreshToken.create({
  data: { userId, tokenHash, expiresAt },
});
```

---

### HIGH-03 — `check-missed` checklist job uses server local time, not tenant timezone
**File:** `apps/api/src/queue/processors/checklist.processor.ts` — `handleCheckMissed()`  
**Problem:**
```ts
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(23, 59, 59, 999);
```
`setDate`/`setHours` operate in the **Node.js server's local timezone**, not the tenant's timezone. A task planned for 23:00 IST (UTC+5:30) is 17:30 UTC. If the server runs on UTC, `yesterday` ends at 23:59 UTC — 6.5 hours after the task's UTC time. But a multi-tenant SaaS will have tenants across timezones: a tenant in UTC-5 would have a task planned for 23:00 their time (04:00 UTC next day) incorrectly marked LATE before their day ends.

**Fix:** Group missed tasks by tenant and evaluate each against the tenant's configured timezone using `toZonedTime` / `fromZonedTime` from `date-fns-tz` (already imported elsewhere in the codebase).

---

### HIGH-04 — `Sequence` collection has no index — atomic ID generation degrades at scale
**File:** `apps/api/src/common/utils/id-generator.utils.ts`  
**Problem:** The `atomicNextSequence()` function queries/updates a `Sequence` collection via `$runCommandRaw`. There is no `model Sequence` in `prisma/schema.prisma` and therefore no Prisma-managed index on the `key` field. MongoDB will do a full collection scan on every `findAndModify` call once the collection grows.

**Fix:** Add to `prisma/schema.prisma`:
```prisma
model Sequence {
  id    String @id @default(auto()) @map("_id") @db.ObjectId
  key   String @unique  // tenantId:prefix:year  ← this index is critical
  value Int    @default(0)
  @@map("sequences")
}
```
Then replace `$runCommandRaw` with a Prisma upsert. This also gives you type safety and migration tracking.

---

## SECURITY Gaps

---

### SECURITY-01 — JWT access token persisted to localStorage (XSS risk)
**File:** `apps/web/src/store/auth.store.ts`  
**Problem:** The zustand `persist` middleware defaults to `localStorage`. The access token (a JWT) is stored in `localStorage`. Any XSS attack (even from a third-party script or React dangerouslySetInnerHTML) can read `localStorage` and steal the token.

**Fix options (pick one):**
1. Switch to `sessionStorage` as shown in CRITICAL-01 fix — cleared on tab close, not accessible across tabs (lower risk).
2. Better: use `partialize` to persist only non-sensitive state (user metadata) and keep `accessToken` in memory only (it will be refreshed from the httpOnly cookie on next load via the `/auth/refresh` endpoint, which already runs automatically via the axios interceptor).
```ts
partialize: (state) => ({ user: state.user }), // don't persist token
```

---

### SECURITY-02 — FMS step completion allows any approver role to complete another user's task with no team-scope check
**File:** `apps/api/src/modules/fms/fms.service.ts` — `completeStep()`  
**Problem:**
```ts
if (task.personId !== userId) {
  const user = await this.prisma.user.findUnique(...);
  if (!isApproverRole(user?.role)) throw new ForbiddenException(...);
  const visibleIds = await this.hierarchy.getVisibleUserIds(userId, user.role, tenantId);
  if (visibleIds && !visibleIds.includes(task.personId)) throw new ForbiddenException(...);
}
```
This is correct **when `visibleIds` is non-null** (admin with a hierarchy group). But for `SAAS_OWNER` and `COMPANY_OWNER`, `getVisibleUserIds()` returns `null` (meaning "no filter — see everything"). The `if (visibleIds && ...)` check is skipped, which is correct. However if an approver role user has no hierarchy group assigned at all (common during initial setup), `getVisibleUserIds()` also returns `[userId]` for a MANAGER — meaning they can't complete any FMS step except their own. This is the correct behavior but not clearly documented, and could confuse admins who expect cross-team access.

**Recommendation:** Document the behavior and ensure onboarding creates hierarchy groups before assigning FMS tasks.

---

## MEDIUM Gaps

---

### MEDIUM-01 — FMS `getAnalytics()` function incomplete (cut off in source)
**File:** `apps/api/src/modules/fms/fms.service.ts`  
**Problem:** The `getAnalytics()` method starts building `[total, completed, late, onTime, workflows]` counts with `Promise.all` but the function body appears to end without returning, computing, or aggregating results. The full response shape and the analytics endpoint would return either nothing or crash.

**Fix:** Complete the function:
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
    this.prisma.fmsWorkflow.count({ where: { tenantId, status: 'PUBLISHED' } }),
  ]);

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const onTimeRate = completed > 0 ? Math.round((onTime / completed) * 100) : 0;

  return { total, completed, pending: total - completed, late, onTime, completionRate, onTimeRate, activeWorkflows: workflows };
}
```

---

### MEDIUM-02 — MIS: FMS tasks silently ignore `projectId` filter
**File:** `apps/api/src/modules/mis/mis-calculator.service.ts`  
**Lines:** FmsTask query block  
**Problem:** A comment acknowledges this: `FmsTask has no projectId of its own (only its parent FmsWorkflow does), so a project filter can't be applied here without an extra join`. When an admin views MIS filtered by project, delegation/WR/checklist are correctly filtered but FMS tasks are always included regardless of project. This can make project-scoped MIS figures inaccurate.

**Fix:** Add a join through `FmsWorkflow`:
```ts
const fmsTasks = await this.prisma.fmsTask.findMany({
  where: {
    tenantId,
    personId: userId,
    plannedDate: dateFilter,
    ...(projectId
      ? { workflow: { projectId } }  // filter via relation
      : {}),
  },
  select: { status: true, onTimeStatus: true, delayDays: true },
});
```
Requires `FmsWorkflow.projectId` to exist in the schema (it does — `projectId String? @db.ObjectId`).

---

### MEDIUM-03 — Reports service: `getChecklistReport` date filter uses `createdAt` not `plannedDate`
**File:** `apps/api/src/modules/reports/reports.service.ts`  
**Problem:** Delegation and Work Request reports filter by `createdAt`, which matches the task's creation date (correct). But Checklist report also filters by `createdAt`. Checklist tasks are generated ahead of time (the processor runs on master creation and creates all future occurrence rows). A daily checklist created in January will have `createdAt = January` for every row including rows planned for June. A "This Month" filter would return 0 checklist rows even though June tasks are pending.

**Fix:** Use `plannedDate` for checklist report filtering (same as MIS calculator does):
```ts
if (dateFilter) where.plannedDate = dateFilter;  // was: where.createdAt = dateFilter
```

---

### MEDIUM-04 — Dashboard `approvalCount` only checks delegation, not Work Requests
**File:** `apps/api/src/modules/dashboard/dashboard.service.ts`  
**Problem:** The BUG-04 fix comment says `approvalCount` was fixed to count tasks awaiting the current user as reviewer. But based on the partial read (100 lines), the approval count query only reads `DelegationTask` with `delegatedById=userId`. Work Requests awaiting the user's approval (`requestedById=userId, status=SEND_FOR_APPROVAL`) are not counted. The sidebar notification dot and dashboard approval card will under-count.

**Fix:** Add WR approval count and sum both:
```ts
const [delegApproval, wrApproval] = await Promise.all([
  this.prisma.delegationTask.count({
    where: { tenantId, delegatedById: userId, status: 'SEND_FOR_APPROVAL' },
  }),
  this.prisma.workRequest.count({
    where: { tenantId, requestedById: userId, status: 'SEND_FOR_APPROVAL' },
  }),
]);
const approvalCount = delegApproval + wrApproval;
```

---

### MEDIUM-05 — `workRequest.service.ts`: `submittedAt` is cast with `as any` (type safety gap)
**File:** `apps/api/src/modules/work-request/work-request.service.ts`  
**Line:** `const submittedAt = (wr as any).submittedAt as Date | undefined;`  
**Problem:** `submittedAt` is cast with `as any` to access the field, meaning Prisma's generated types don't include it. This means the `WorkRequest` Prisma model likely has `submittedAt` in `schema.prisma` but the `findOne` `include` query does not select it — so Prisma strips it from the returned type and it comes back as `undefined` at runtime, triggering the `BadRequestException('Work request is missing a submission timestamp')` on every approve attempt.

**Fix:** Either add `submittedAt: true` to the `findOne` select/include, or (better) remove the as-any cast once the Prisma type correctly exposes it:
```ts
const wr = await this.prisma.workRequest.findFirst({
  where: { id, tenantId },
  include: {
    requestedBy: { select: { id: true, name: true } },
    requestFor: { select: { id: true, name: true } },
    project: { select: { id: true, name: true } },
    // submittedAt is a scalar, just needs to not be excluded:
  },
});
// submittedAt will now be in the return type automatically
```

---

## LOW / QUALITY Gaps

---

### LOW-01 — `useSocket.ts` cleanup is a no-op (intentional but undocumented)
**File:** `apps/web/src/hooks/useSocket.ts`  
**Problem:** The `useEffect` cleanup function is empty: `return () => {}`. This is intentional (socket stays alive across route changes) but will cause a React lint warning about missing cleanup. More importantly, if a component using `useSocket` unmounts for a reason other than logout (e.g., error boundary), the socket remains connected without any component managing it.

**Recommendation:** Add a JSDoc comment explaining why cleanup is intentional, and ensure `useSocket` is called only once (in the root layout).

---

### LOW-02 — `env.example` has inconsistent key names vs code
**File:** `.env.example` vs `apps/api/src/modules/auth/auth.service.ts`  
**Problem:** `.env.example` defines `JWT_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN`. The auth service reads `JWT_ACCESS_EXPIRY` and `JWT_REFRESH_EXPIRY` (different key names). A new developer copying `.env.example` will not have the correct keys set.

**Fix:** Update `.env.example` to use the actual key names the code reads:
```env
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"
```

---

### LOW-03 — FMS processor `fms.processor.ts` queue handler not verified
**File:** `apps/api/src/queue/processors/fms.processor.ts`  
**Problem:** The escalation processor queues `fmsQueue.add('escalate-step', {...})` on line in `escalation.processor.ts`. This requires an `@Process('escalate-step')` handler in `fms.processor.ts`. This handler was not audited but it's critical for FMS escalation emails to fire.

**Recommendation:** Verify `@Process('escalate-step')` exists in `fms.processor.ts` and sends the correct escalation email.

---

### LOW-04 — `checklist.processor.ts`: `ONE_TIME` frequency pushes one date then falls into infinite loop guard
**File:** `apps/api/src/queue/processors/checklist.processor.ts` — `generateOccurrenceDates()`  
**Problem:**
```ts
default: return dates; // ONE_TIME or unknown — one occurrence
```
For `ONE_TIME`, the loop adds `startDate` to `dates`, then hits `default: return dates` on the next iteration step — correct behavior but only because the `default` case is reached after the first push. If a new frequency is added to the enum later and not added to the switch, it would silently behave as ONE_TIME. 

**Recommendation:** Split the `default` into an explicit `case 'ONE_TIME'` (returns immediately) and a `default` that throws `new Error('Unknown frequency: ' + frequency)` to surface typos or new enum values.

---

### LOW-05 — `NOTIFICATION_TYPE` enum has `CHECKLIST_APPROVAL_STALE` used in code but missing from Prisma schema
**File:** `prisma/schema.prisma` vs `apps/api/src/queue/processors/escalation.processor.ts`  
**Problem:** `escalation.processor.ts` queues a notification with `type: 'CHECKLIST_APPROVAL_STALE'`. If this value is not in the `NotificationType` enum in `schema.prisma`, Prisma's MongoDB adapter may silently store it as a string — but TypeScript type-checking at the Prisma client call will fail (or require `as any`).

**Fix:** Confirm `CHECKLIST_APPROVAL_STALE` exists in `schema.prisma`'s `NotificationType` enum. If not, add it:
```prisma
enum NotificationType {
  // ... existing values ...
  CHECKLIST_APPROVAL_STALE
  TASK_REASSIGNED_TO_BUDDY
  PUNCH_IN_MISSED
}
```
Also verify `TASK_REASSIGNED_TO_BUDDY` and `PUNCH_IN_MISSED` are in the enum (also used in escalation.processor.ts).

---

### LOW-06 — `auth.service.ts` `issueTokens()`: device info / IP not captured in RefreshToken
**File:** `apps/api/src/modules/auth/auth.service.ts`  
**Problem:** The `RefreshToken` Prisma model has `deviceInfo` and `ipAddress` fields (visible in `getSessions()` response). But `issueTokens()` creates the refresh token record without these fields, so session management always shows blank device/IP. The `login()` call has access to the request object where these could be extracted.

**Fix:** Pass `ipAddress` and `deviceInfo` from the controller through to `issueTokens()` and save them:
```ts
await this.prisma.refreshToken.create({
  data: { userId, tokenHash, expiresAt, ipAddress, deviceInfo },
});
```

---

## Summary Table

| # | Severity | File | Issue |
|---|----------|------|-------|
| CRITICAL-01 | 🔴 Critical | `auth.store.ts` | File truncated — `isSuperAdmin()` missing, syntax error, app won't build |
| CRITICAL-02 | 🔴 Critical | `work-request.service.ts` | `assertCanViewWorkRequest` / `assertCanReviewWorkRequest` never defined — all WR approval calls crash |
| CRITICAL-03 | 🔴 Critical | `work-request.service.ts` | `getPeriodRange()` null return destructured without guard — 500 on bad period |
| HIGH-01 | 🟠 High | `checklist.processor.ts` | Checklist task IDs not atomic — duplicate IDs under concurrent jobs |
| HIGH-02 | 🟠 High | `auth.service.ts` | Refresh token DB expiry hardcoded to 7d, ignores `JWT_REFRESH_EXPIRY` env |
| HIGH-03 | 🟠 High | `checklist.processor.ts` | `check-missed` job uses server local time, not tenant timezone |
| HIGH-04 | 🟠 High | `id-generator.utils.ts` | `Sequence` collection has no DB index — full-scan on every atomic ID call |
| SECURITY-01 | 🔐 Security | `auth.store.ts` | JWT access token in localStorage (XSS risk) |
| SECURITY-02 | 🔐 Security | `fms.service.ts` | Approver with no hierarchy group can't complete team FMS (undocumented restriction) |
| MEDIUM-01 | 🟡 Medium | `fms.service.ts` | `getAnalytics()` incomplete — function body cut off, endpoint returns nothing |
| MEDIUM-02 | 🟡 Medium | `mis-calculator.service.ts` | FMS tasks silently ignore `projectId` filter in project-scoped MIS |
| MEDIUM-03 | 🟡 Medium | `reports.service.ts` | Checklist report filters by `createdAt` instead of `plannedDate` |
| MEDIUM-04 | 🟡 Medium | `dashboard.service.ts` | `approvalCount` doesn't include Work Request approvals |
| MEDIUM-05 | 🟡 Medium | `work-request.service.ts` | `submittedAt` accessed via `as any` — field likely not included in query select, always `undefined` |
| LOW-01 | 🔵 Low | `useSocket.ts` | Empty cleanup function — intentional but undocumented |
| LOW-02 | 🔵 Low | `.env.example` | Key names don't match what the code reads |
| LOW-03 | 🔵 Low | `fms.processor.ts` | `escalate-step` handler not verified to exist |
| LOW-04 | 🔵 Low | `checklist.processor.ts` | `ONE_TIME` frequency handling fragile — unknown frequencies silently one-time |
| LOW-05 | 🔵 Low | `prisma/schema.prisma` | `CHECKLIST_APPROVAL_STALE`, `TASK_REASSIGNED_TO_BUDDY`, `PUNCH_IN_MISSED` may be missing from `NotificationType` enum |
| LOW-06 | 🔵 Low | `auth.service.ts` | Device info / IP not saved to RefreshToken — session management always blank |

---

## What is Working Correctly (Architecture Highlights)

These are all solid and should not be changed:

- **Multi-tenant isolation**: `TenantGuard` enforces `tenantId` on every request globally — correct.
- **Atomic delegation/WR/checklist-master IDs**: `atomicNextDelegationId`, `atomicNextWorkRequestId`, `atomicNextChecklistMasterId` using `$runCommandRaw findAndModify` — correct.
- **Timezone-safe date parsing**: `parseFrontendDateTime()` builds ISO string then calls `fromZonedTime()` — no double-shift — correct.
- **Working-day delay**: `calculateDelay()` excludes weekends + tenant holidays — correct.
- **Approval bypass fix**: Employee `submitForApproval()` correctly sets `SEND_FOR_APPROVAL` (not `COMPLETED`) — correct.
- **Delay based on submission time, not approval time**: Both delegation and WR use `submittedAt` for `calculateDelay()` — correct.
- **Rework clears completedAt**: WR rework clears `completedAt` so reports don't count reworked tasks as done — correct.
- **Hierarchy filter bug fix**: `assignedToId` filter is applied after the hierarchy scope, not instead of it — correct.
- **Approval tab bug fix**: `tab='rework'` correctly queries REWORK status — correct.
- **Escalation engine**: SLA check, workload check, project health (all 3 modules), stale approvals, daily digest with full 4-module breakdown, punch-in miss + buddy reassignment — comprehensive and correct.
- **JWT token refresh**: Axios interceptor handles queued 401 retry correctly with `_retry` flag and queue draining — correct.
- **Notification isolation on logout**: `logout()` resets notification store — correct.
- **Socket reconnection on token refresh**: New socket created when `accessToken` changes — correct.
- **FMS workflow status disambiguation**: PUBLISHED = active template, COMPLETED = all steps done (distinct states) — correct.
- **Project health score**: Includes delegation + WR + checklist (not just delegation) — correct.
- **Daily digest**: All 4 modules (delegation, WR, checklist, FMS) with per-module breakdown — correct.

---

## Priority Fix Order

1. **CRITICAL-01** — Complete `auth.store.ts` immediately (app won't build)
2. **CRITICAL-02** — Add `assertCanViewWorkRequest` / `assertCanReviewWorkRequest` (all WR approval crashes)
3. **CRITICAL-03** — Null-guard `getPeriodRange` in all callers
4. **MEDIUM-05** — Fix `submittedAt` not included in WR `findOne` select (approval always fails)
5. **HIGH-01** — Make checklist task IDs atomic
6. **HIGH-02** — Sync refresh token DB expiry with env var
7. **MEDIUM-01** — Complete `fms.service.ts getAnalytics()`
8. **MEDIUM-04** — Add WR approvals to dashboard approval count
9. **SECURITY-01** — Move access token out of localStorage
10. **MEDIUM-03** — Fix checklist report date filter to use `plannedDate`

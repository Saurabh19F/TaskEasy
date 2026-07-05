# TaskEasy — QA Tester Audit (Refreshed 2026-07-02)

**Role:** QA Tester · **Scope:** Broken flows, missing coverage, edge cases

**Verification method:** Static audit of controllers, services, and Playwright/Jest test artifacts. Manual browser testing NOT performed in this pass — flagged where required.

---

## 1. Test Suite Inventory

| Layer | File | Lines | Status |
|---|---|---|---|
| API e2e | `apps/api/test/auth.e2e-spec.ts` | 71 | ✅ present |
| API e2e | `apps/api/test/delegation.e2e-spec.ts` | 74 | ✅ present |
| Web e2e (Playwright) | `apps/web/e2e/auth.spec.ts` | 44 | ✅ |
| Web e2e | `apps/web/e2e/dashboard.spec.ts` | 44 | ✅ |
| Web e2e | `apps/web/e2e/delegation.spec.ts` | 70 | ✅ |
| Web e2e | `apps/web/e2e/approval.spec.ts` | 118 | ✅ |
| Web unit (Jest) | `Badge.test.tsx`, `Button.test.tsx`, `DataTable.test.tsx`, `login.test.tsx`, `utils.test.ts` | ~250 total | ✅ |
| API unit tests | (none) | 0 | 🔴 **Missing** |

**Total meaningful test lines: ~671** across **30 backend modules + ~40 web routes**. Coverage estimate: <5%.

**Missing test coverage per module:**

| Module | API unit | API e2e | Web e2e | Priority |
|---|---|---|---|---|
| work-request | 🔴 | 🔴 | 🔴 | 🔴 Critical (core flow) |
| checklist | 🔴 | 🔴 | 🔴 | 🔴 Critical |
| fms | 🔴 | 🔴 | 🔴 | 🔴 Critical |
| approval | 🔴 | 🔴 | ✅ | 🟡 |
| mis | 🔴 | 🔴 | 🔴 | 🟡 |
| reports | 🔴 | 🔴 | 🔴 | 🟡 |
| users | 🔴 | 🔴 | 🔴 | 🟡 |
| hierarchy | 🔴 | 🔴 | 🔴 | 🟡 |
| bulk-import | 🔴 | 🔴 | 🔴 | 🟡 |
| automation | 🔴 | 🔴 | 🔴 | 🟡 |
| notifications | 🔴 | 🔴 | 🔴 | 🟢 |
| audit | 🔴 | 🔴 | 🔴 | 🟢 |
| Others (16) | 🔴 | 🔴 | 🔴 | 🟢 |

---

## 2. Confirmed Broken / Suspect Flows

### 🔴 BUG-QA-01 — Dashboard endpoint accessible cross-role
- **File:** [apps/api/src/modules/dashboard/dashboard.controller.ts](apps/api/src/modules/dashboard/dashboard.controller.ts)
- **Symptom:** No `@UseGuards(RolesGuard, PermissionsGuard)` and no `@Roles(...)`. Global JwtAuthGuard authenticates, but any Employee JWT can hit `/dashboard?view=team` and receive team-level aggregates that should be Admin-only.
- **Repro:** Login as Employee → GET `/dashboard?view=team` → returns team data.
- **Fix:** Add `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN, Role.SUPER_ADMIN)` on the `view=team` route, or split the endpoint.

### 🔴 BUG-QA-02 — 8 controllers unguarded for RBAC
- **Files:** `ai`, `calendar`, `client-portal`, `dashboard`, `kanban`, `notifications`, `search`, `vendor-portal` controllers
- **Symptom:** Any authenticated user (any role) can call all endpoints. JWT + tenant scoping applies globally, but no role checks.
- **Fix:** See ROLE_04 §BE-01.

### 🟡 BUG-QA-03 — Checklist `startTime` default mismatch
- **Files:** [apps/api/src/modules/checklist/checklist.service.ts:78 (`'09:00'`)](apps/api/src/modules/checklist/checklist.service.ts:78) vs [:555 (`'08:00'`)](apps/api/src/modules/checklist/checklist.service.ts:555)
- **Symptom:** Checklists via UI default 09:00; via bulk-import default 08:00. Frequency scheduler fires at different times.
- **Repro:** Import a checklist with StartTime blank → row uses 08:00. Create via UI without startTime → 09:00.
- **Fix:** `DEFAULT_START_TIME = '09:00'` constant used in both paths.

### 🟡 BUG-QA-04 — Frontend delegation page lacks `try/catch` / error toasts
- **File:** [apps/web/src/app/(app)/delegation/page.tsx](apps/web/src/app/(app)/delegation/page.tsx)
- **Symptom:** 0 try/catch/toast.error occurrences. React-Query catches network errors but mutation UI shows no failure feedback.
- **Repro:** API returns 500 → user sees no toast, action appears to succeed.
- **Fix:** Add `onError` on all mutations calling a global toast. Repeat for work-request, checklist, fms, users.

### 🟡 BUG-QA-05 — Kanban/notifications/search/dashboard do NOT invalidate Redis
- **Symptom:** Kanban card status change → dashboard reads cached counts → wrong Total/Done until TTL.
- **Repro:** Move card → refresh dashboard → count wrong up to N seconds.
- **Fix:** Add `redis.delByPattern(\`dashboard:${tenantId}:*\`)` after every mutation. See ROLE_04 §BE-04.

### 🟡 BUG-QA-06 — Password strength check only in `/auth`, not in `/users` admin paths
- **File:** [apps/api/src/modules/users/users.service.ts:123,346,674](apps/api/src/modules/users/users.service.ts:123)
- **Symptom:** Admin creating a user via `POST /users` can set a 3-char password; `validatePasswordStrength` (private in `auth.service.ts:535`) is not reused.
- **Fix:** Extract validator to `common/utils/password.ts`; call from `users.service.create`, `updatePassword`, and bulk-import.

### 🟢 BUG-QA-07 — Duplicate generated Prisma artifacts
- **Files:** `apps/api/src/generated/prisma/*` AND `apps/api/src/generated/apps/api/src/generated/prisma/*` (double-nested)
- **Symptom:** Nested duplicates from a prior misconfigured run; inflates build + confuses go-to-definition.
- **Fix:** Delete `apps/api/src/generated/apps/` tree; re-run `prisma generate`.

### 🟢 BUG-QA-08 — Legacy Google Apps Script files still present
- **Files:** `SaaS-fixes/gasCompatService.js`, `SaaS-fixes/coreTaskService.js`
- **Symptom:** Dead code containing "TaskDone" branding; confuses new devs.
- **Fix:** Move to `docs/legacy/` or delete.

---

## 3. Flow-Level Test Matrix (Manual QA Required)

Run before demo. Each row is a golden-path test case.

| # | Flow | Steps | Expected | Priority |
|---|---|---|---|---|
| TC-001 | Super Admin login | creds → 2FA → `/platform` | Platform dashboard | 🔴 |
| TC-002 | Admin login | creds → `/dashboard?view=team` | Team dashboard | 🔴 |
| TC-003 | Employee login | creds → `/dashboard?view=my` | Own tasks only | 🔴 |
| TC-010 | Employee blocked from `view=team` | GET `/dashboard?view=team` as employee | 403 (currently 200 — BUG-QA-01) | 🔴 |
| TC-020 | User CRUD | Create → edit → deactivate → audit log | Visible in list, audit entry present | 🔴 |
| TC-025 | Delegation assign | Admin assigns to Employee | Task appears in Employee `/delegation` | 🔴 |
| TC-026 | Delegation submit | Employee submits → `SEND_FOR_APPROVAL` | Appears in Admin `/approvals` | 🔴 |
| TC-027 | Delegation approve/rework | Admin approves → COMPLETED; or rework → REWORK | Correct transition | 🔴 |
| TC-030 | Delegation shortcut blocked | Attempt direct status=COMPLETED | 403/400 | 🔴 |
| TC-042 | Work Request loop | Requester → Doer submits → Requester approves | COMPLETED | 🔴 |
| TC-053 | Checklist create startTime='10:30' | Verify DB and scheduler fires 10:30 | Time honored | 🔴 |
| TC-054 | Checklist bulk import no StartTime | Import → all rows startTime='09:00' post BUG-QA-03 fix | Same default as UI | 🟡 |
| TC-061 | FMS Pending → Done | Mark step done past due-time | Delay minutes correct | 🔴 |
| TC-062 | FMS Import Sheet | Header menu → Import → upload → rows | Modal opens, import runs | 🔴 |
| TC-063 | FMS Analytics | Analytics → modal → data | Chart renders | 🔴 |
| TC-064 | FMS Generate with AI | AI → prompt → preview → save | Rows saved | 🔴 |
| TC-070 | Approve/Review consolidated | Tab shows delegation+WR+checklist items | All three visible | 🔴 |
| TC-090 | MIS employee score | Complete task with delay → run calc | Score negative | 🔴 |
| TC-091 | MIS weekly snapshot | Trigger snapshot | Row in `mis_snapshots` | 🟡 |
| TC-100 | Reports Excel export | `/reports` → export → open in Excel | Opens cleanly | 🔴 |
| TC-101 | Reports PDF export | `/reports` → export → open in reader | Opens cleanly | 🔴 |
| TC-110 | Notification dot | Assign task → Employee sidebar shows dot | Dot within TTL | 🟡 |
| TC-120 | Cache staleness | Assign 5 tasks → count=5; delete 1 → count=4 immediately | Invalidation works | 🔴 |
| TC-121 | Kanban→Dashboard cache | Move kanban card → dashboard count changes | Currently FAILS (BUG-QA-05) | 🟡 |
| TC-130 | Cross-tenant isolation | Tenant A user fetches Tenant B taskId | 403 / not found | 🔴 |
| TC-140 | Dark mode | Toggle → every page renders | No white flashes | 🟢 |
| TC-141 | Mobile PWA install | Chrome mobile → Add to Home → offline page | Manifest + offline page load | 🟢 |
| TC-150 | Audit log | Create/update/approve/rework → one row each | Rows in `/audit-logs` | 🟡 |
| TC-160 | Rate limiting | Rapid login attempts | Throttled after N | 🟡 |
| TC-170 | Password reset | Request → email → reset → login | End-to-end works | 🔴 |
| TC-180 | File upload | Cloudinary upload from task detail | URL saved, thumbnail | 🟡 |
| TC-190 | Bulk import users | Upload CSV → validation → import → login | Weak passwords blocked post BUG-QA-06 | 🟡 |

---

## 4. Edge Cases Not Covered

| # | Case | Where |
|---|---|---|
| EC-1 | Approver deleted/deactivated mid-flow | Delegation, WR |
| EC-2 | Assignee re-assigned to different manager | Hierarchy, delegation approve |
| EC-3 | Tenant suspended mid-session | Global — 401 next request |
| EC-4 | Same email on two tenants | Users.create — verify tenant-scoped uniqueness |
| EC-5 | Checklist WEEKLY with startDay changes | Checklist processor |
| EC-6 | Redis down | Should fall back to DB, not 500 |
| EC-7 | BullMQ worker crash mid-job | Retry semantics |
| EC-8 | Cloudinary upload timeout | User sees clear error |
| EC-9 | Excel export with 100k rows | Streaming vs OOM |
| EC-10 | Concurrent approval — two admins click at once | Idempotency |

---

## 5. Recommended Test Additions

Sprint 4 (before demo):
1. API e2e for `work-request` — mirror `delegation.e2e-spec.ts`.
2. API e2e for `checklist` (create + mark done + frequency).
3. API e2e for `fms` (pending → done + delay calc).
4. API e2e for `approval` (consolidated feed).
5. Playwright test for `/reports` Excel + PDF export.
6. Playwright test for cross-tenant isolation (TC-130).

Post-demo:
7. Unit tests for `mis.service.calculateScore` — most demo-visible number.
8. Unit tests for Redis invalidation per mutation.
9. Contract tests for `client-portal` and `vendor-portal` external endpoints.

---

## 6. QA Sign-Off Gates

- [ ] All 🔴 rows in §3 pass in a real browser.
- [ ] Cross-tenant isolation (TC-130) passes.
- [ ] Every write endpoint has been called with a mutation and dashboard verified against a fresh page load.
- [ ] No unhandled promise rejections in server logs during full demo flow.
- [ ] No 5xx in Network tab during demo flow.

---

*Document Owner: QA Tester · Last Refreshed: 2026-07-02 · Version: 2.0*

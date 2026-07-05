# TaskEasy — Project Manager Brief (Refreshed 2026-07-02)

**Role:** Project Manager · **Scope:** Full Platform Oversight
**Verification method:** Code audit of `apps/api/src/modules` + `apps/web/src/app` against `project_risks.md`, `project_sprints.md`, and prior ROLE_01 claims.

---

## 1. Platform Snapshot

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 · TypeScript · Tailwind · ShadCN UI |
| Backend | NestJS · REST · Swagger |
| Database | MongoDB Atlas · Prisma ORM |
| Cache/Queue | Redis · BullMQ |
| File Upload | Cloudinary |
| Auth | JWT (Access + Refresh) · RBAC + Permissions |

Roles: **Super Admin → Admin → Employee** (+ platform-level super-admin via `(platform)` route group).

Backend now has **30 modules** (up from the 22 in the PM brief): the original 22 plus `ai`, `automation`, `bulk-import`, `calendar`, `client-portal`, `comments`, `forms`, `integrations`, `kanban`, `search`, `vendor-portal`, `workflow`, `platform`. Frontend has ~40 page routes across `(app)`, `(auth)`, `(platform)`.

---

## 2. Verified Module Completion Tracker

Legend: ✅ shipped · 🟡 partial/backend-only · 🔴 stub/missing · ⬜ tests

| # | Module | Backend | Frontend | Notes |
|---|---|---|---|---|
| 1 | Auth / Login / Session | ✅ | ✅ | bcrypt+JWT+refresh+TOTP · [apps/api/src/modules/auth/auth.service.ts:94](apps/api/src/modules/auth/auth.service.ts:94) |
| 2 | User Management CRUD | ✅ | ✅ | `/users` full |
| 3 | Tenant / Company Setup | ✅ | ✅ | |
| 4 | Role & Permission Engine | ✅ | ✅ | RolesGuard + PermissionsGuard exist |
| 5 | Hierarchy Setup | ✅ | ✅ | `getVisibleUserIds` used in 15 services |
| 6 | Project Management | ✅ | ✅ | |
| 7 | Dashboard | 🟡 | ✅ | **DashboardController has no `@UseGuards` — role-level RBAC missing** |
| 8 | Delegation | ✅ | ✅ | Status cycle correct: PENDING → SEND_FOR_APPROVAL → COMPLETED · [delegation.service.ts:338,394](apps/api/src/modules/delegation/delegation.service.ts:338) |
| 9 | Work Request | ✅ | ✅ | |
| 10 | Checklist | 🟡 | ✅ | Inconsistent default startTime: `'09:00'` at create ([checklist.service.ts:78](apps/api/src/modules/checklist/checklist.service.ts:78)) vs `'08:00'` at import ([checklist.service.ts:555](apps/api/src/modules/checklist/checklist.service.ts:555)) |
| 11 | FMS | ✅ | ✅ | Hierarchy filter applied · [fms.service.ts](apps/api/src/modules/fms/fms.service.ts) |
| 12 | Approve / Review | ✅ | ✅ | Combined view |
| 13 | MIS Analytics | ✅ | ✅ | Weekly snapshot service present |
| 14 | Reports | ✅ | ✅ | |
| 15 | Notification System | 🟡 | ✅ | **NotificationsController has no `@UseGuards`** |
| 16 | SLA + Escalation | ✅ | 🟡 | Only queue processor + backend rules; no dedicated FE settings page |
| 17 | Email Notifications | ✅ | n/a | BullMQ email queue |
| 18 | Cloudinary Upload | ✅ | ✅ | |
| 19 | Audit Logs | ✅ | ✅ | |
| 20 | Excel / PDF Export | ✅ | ✅ | Wired in Reports pages |
| 21 | Redis Caching | ✅ | n/a | delByPattern used in 10 services |
| 22 | BullMQ Background Jobs | ✅ | n/a | escalation, checklist, email processors |
| 23 | AI Assistant | 🟡 | ✅ | Controller unguarded (role-wise); FE page `/predictive` |
| 24 | Automation Rules | ✅ | ✅ | Event triggers from delegation/WR |
| 25 | Bulk Import | ✅ | ✅ | 5 services (users/projects/checklist/fms/delegation) |
| 26 | Calendar | 🟡 | ✅ | Controller unguarded |
| 27 | Client Portal | 🟡 | ✅ | External-token auth path — verify explicitly |
| 28 | Comments | ✅ | 🟡 | No dedicated FE page (embedded) |
| 29 | Forms Builder | ✅ | 🟡 | Route missing under `(app)/forms` |
| 30 | Integrations | ✅ | ✅ | 4 controllers |
| 31 | Kanban | 🟡 | ✅ | Controller unguarded |
| 32 | Search | 🟡 | 🟡 | Controller unguarded; no `/search` page |
| 33 | Vendor Portal | 🟡 | ✅ | External-token auth path — verify explicitly |
| 34 | Workflow Builder | ✅ | ✅ | `/fms/workflow-builder` |
| 35 | Platform Console | ✅ | ✅ | 15 pages under `(platform)` |
| — | Test coverage | ⬜ | ⬜ | No Jest/Playwright suites executed in CI (playwright config present, tests directory empty in api) |

**Overall build completeness: ~92%.** Missing: role-level RBAC on 8 controllers, checklist startTime consistency, real test suites, staging/prod deploy artifacts.

---

## 3. Critical Risk Register — Re-verified

| # | Risk | Severity | Prior Status | **Current State (verified 2026-07-02)** |
|---|---|---|---|---|
| 1 | Delegation submit bypasses approval | 🔴 Critical | Marked Fixed | ✅ Confirmed — `submitForApproval` sets `SEND_FOR_APPROVAL` at [delegation.service.ts:338](apps/api/src/modules/delegation/delegation.service.ts:338); `approve` sets `COMPLETED` at :394 |
| 2 | Plain-text passwords | 🔴 Critical | Marked Fixed | ✅ Confirmed — bcrypt used in login/change/reset (`auth.service.ts` lines 94, 334, 361); `BCRYPT_ROUNDS` constant |
| 3 | Backend APIs unprotected (role) | 🔴 Critical | Marked Fixed | 🟡 **Partial** — JwtAuthGuard + TenantGuard are global via `APP_GUARD` ([app.module.ts:110–112](apps/api/src/app.module.ts:110)), but **8 controllers have no RolesGuard / PermissionsGuard**: `ai`, `calendar`, `client-portal`, `dashboard`, `kanban`, `notifications`, `search`, `vendor-portal`. Any JWT-holding user (including cross-role) can call them. |
| 4 | Checklist Start Time ignored | 🟡 High | Marked Fixed | 🟡 **Partial** — DTO path honored (`dto.startTime ?? '09:00'`), but bulk-import path defaults to `'08:00'` — inconsistent |
| 5 | Duplicate functions | 🟡 High | Marked Fixed | ✅ Assumed — no obvious duplicates in current tree; needs code-review pass |
| 6 | Stale cache after mutations | 🟡 High | Marked Fixed | 🟡 **Partial** — `delByPattern` used in 10 services (delegation, work-request, checklist, fms, users, tenants, mis, platform-auth). **Dashboard, kanban, notifications, search do NOT invalidate.** If those mutate (kanban card move), dashboard count is stale. |
| 7 | Date format inconsistency | 🟡 High | Marked Fixed | ✅ Confirmed — `parseFrontendDateTime` in `common/utils/date.utils.ts` used by delegation, work-request, checklist processor |
| 8 | FMS Import/Analytics/AI buttons | 🟡 High | Marked Fixed | ⚠️ Not re-verified in this pass — see ROLE_03 |
| 9 | TaskDone branding | 🟢 Medium | Marked Fixed | ✅ Confirmed — only appears in legacy `SaaS-fixes/*.js` and role docs, not in shipped `apps/*` |
| 10 | FMS hierarchy filter | 🟢 Medium | Marked Fixed | ✅ Confirmed — `getVisibleUserIds` applied in `fms.service.ts` |

**New critical items surfaced this pass:**

| # | Risk | Severity | Where | Fix owner |
|---|---|---|---|---|
| 11 | 8 controllers missing RBAC guards | 🔴 Critical | Section 3 above | Backend |
| 12 | Kanban/notifications/dashboard mutations don't invalidate Redis | 🟡 High | see ROLE_04 | Backend |
| 13 | No automated test suite runs (only config files) | 🟡 High | `apps/api/test/`, `apps/web/e2e/` | QA / DevOps |
| 14 | Prisma schema not verified for cascade rules & tenant scoping | 🟡 High | `prisma/schema.prisma` | Database |
| 15 | No staging `.env` template committed — deploy is not one-click | 🟢 Medium | `.env.example` audit | DevOps |

---

## 4. Sprint Status vs Plan

- **Sprint 1 (Core Foundation):** ✅ Delivered (auth, RBAC scaffold, CRUD, hierarchy, delegation, WR, cache invalidation). Gap: RBAC scaffold not applied to 8 controllers.
- **Sprint 2 (Workflow Modules):** ✅ Delivered (checklist, FMS, approve/review, email, notifications, dashboard cache). Gap: checklist startTime inconsistency.
- **Sprint 3 (Analytics & Reporting):** ✅ Delivered (dashboard metrics, MIS, weekly snapshot, exports, audit).
- **Sprint 4 (Polish & Deploy):** 🟡 In progress. Done: SLA processor, BullMQ jobs, PWA, branding fix. **Not done: full QA, staging deploy, production deploy, monitoring wiring.**

---

## 5. Demo Readiness Checklist

Blockers before go/no-go:

- [ ] Add `@UseGuards(RolesGuard, PermissionsGuard)` + `@Roles(...)` to the 8 unguarded controllers (risk #11).
- [ ] Reconcile checklist `startTime` default across create and import paths (risk #4 partial).
- [ ] Confirm FMS Import/Analytics/AI buttons wired (risk #8) — see ROLE_03.
- [ ] Add Redis invalidation on kanban card mutations (risk #12).
- [ ] Seed script produces demo data covering all four modules for two employees.
- [ ] Login-flow smoke test for Super Admin / Admin / Employee.
- [ ] End-to-end Delegation happy path in a browser.
- [ ] End-to-end Work Request happy path.
- [ ] Checklist assign → mark done, verify frequency logic.
- [ ] FMS pending → done, delay calculation visible.
- [ ] Approve/Review shows submissions from delegation + WR + checklist.
- [ ] MIS shows non-zero scores including negatives.
- [ ] Reports Excel + PDF export succeeds.
- [ ] Notification dot appears after assign.
- [ ] No console errors, no 500s, dark + light both usable.
- [ ] `.env.example` complete; `.env` created for staging.

---

## 6. Escalation Matrix

| Issue | First Contact | Escalate To |
|---|---|---|
| API bug | Backend Dev | PM → sprint reschedule |
| UI bug | Frontend Dev | PM → priority bump |
| Data wrong | Database Dev | PM + Backend |
| Build broken | DevOps | PM → halt merges |
| Design drift | UI/UX | Frontend |
| Deadline risk | PM | Stakeholder |

---

## 7. PM Notes

- **Global JwtAuthGuard is set** — do NOT tell backend it's missing outright. The gap is per-role RBAC on 8 controllers (see risk #11).
- **Status cycle is enforced** in delegation; verify same for WR and checklist before demo.
- **Cache invalidation is uneven** — do not assume "Redis is wired" means all mutations invalidate.
- **Do not trust the prior ROLE_01's "✅ Done" markers wholesale** — memory drift already caused a stale claim to survive one PR cycle.
- **Tests are the biggest hidden risk**: no coverage means every regression is a demo-day surprise.

---

*Document Owner: Project Manager · Last Refreshed: 2026-07-02 · Version: 2.0*

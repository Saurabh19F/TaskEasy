# TaskEasy — Backend Developer Audit (Refreshed 2026-07-02)

**Role:** Backend Developer · **Stack:** NestJS · Prisma · Redis · BullMQ · JWT

**Verification method:** Static audit of `apps/api/src/{modules,common,queue,redis}`.

---

## 1. Security Posture — Verified

| Control | Where | Status |
|---|---|---|
| Global JwtAuthGuard | [app.module.ts:111](apps/api/src/app.module.ts:111) | ✅ |
| Global TenantGuard | [app.module.ts:112](apps/api/src/app.module.ts:112) | ✅ |
| Global ThrottlerGuard | [app.module.ts:110](apps/api/src/app.module.ts:110) | ✅ |
| Password hashing (bcrypt) | `auth.service.ts:94/334/361`, `users.service.ts:123/346/674` | ✅ |
| Password strength enforcement | `auth.service.ts:535` only — **not reused in users.service** | 🟡 |
| Password reset token hashing | `auth.service.ts:298/326` (SHA256 stored, raw sent by email) | ✅ |
| Account lockout | `failedLoginAttempts` + `lockedUntil` fields present | ✅ |
| Refresh token rotation | `auth.service.ts` refresh path | ✅ (verify explicitly) |
| TOTP 2FA | Login DTO accepts `totpCode` | ✅ |
| Public route decorator | `common/decorators/public.decorator.ts` | ✅ |
| Audit interceptor | `AuditInterceptor` global | ✅ |

---

## 2. Critical / High Backend Issues

### 🔴 BE-01 — 8 controllers missing RBAC guards
**Files (no `@UseGuards` / `@Roles` / `@Permissions`):**
- `ai/ai.controller.ts`
- `calendar/calendar.controller.ts`
- `client-portal/client-portal.controller.ts` *(external — needs its own token guard, not JWT)*
- `dashboard/dashboard.controller.ts`
- `kanban/kanban.controller.ts`
- `notifications/notifications.controller.ts`
- `search/search.controller.ts`
- `vendor-portal/vendor-portal.controller.ts` *(external — needs vendor token guard)*

Auth webhooks (email, google-calendar, whatsapp) are correctly `@Public()` because they're 3rd-party callbacks — separate concern.

**Impact:** Employees can hit `/dashboard?view=team`, `/calendar/all`, `/notifications/all`, `/search?scope=tenant` — all endpoints that should be role-scoped.

**Fix pattern per controller:**
```ts
@Controller('dashboard')
@UseGuards(RolesGuard, PermissionsGuard)  // JwtAuthGuard is already global
@ApiBearerAuth('access-token')
export class DashboardController {
  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)      // for view=team
  ...
}
```

For `client-portal` and `vendor-portal`: build dedicated `ClientTokenGuard`/`VendorTokenGuard` that verifies a signed portal token instead of a user JWT, then mark the routes `@Public()` so the global JwtAuthGuard is skipped.

### 🔴 BE-02 — Password strength validator not reused by admin user creation
- [users.service.ts:123 (create)](apps/api/src/modules/users/users.service.ts:123), [:346 (updatePassword)](apps/api/src/modules/users/users.service.ts:346), [:674 (bulk import)](apps/api/src/modules/users/users.service.ts:674).
- `validatePasswordStrength` is `private` inside `auth.service.ts:535` — not shared.
- **Fix:** Move to `common/utils/password.ts`, export a pure function, and call from all three sites + auth reset.

### 🔴 BE-03 — TenantGuard has unverified-JWT fallback code path
- [tenant.guard.ts:40-57](apps/api/src/common/guards/tenant.guard.ts:40) base64-decodes the Bearer token WITHOUT verifying the signature.
- Currently unreachable in practice (JwtAuthGuard runs first and validates), but the code exists as a safety net if guard order changes.
- **Fix:** Remove the base64 fallback entirely; if `request.user` is null and scope isn't platform, throw `ForbiddenException`. Rely on `@Public()` decorator for the rare bypass.

### 🟡 BE-04 — Redis invalidation gaps
`redis.delByPattern` used in **10 services**: `delegation`, `work-request`, `checklist`, `fms`, `users`, `tenants`, `mis`, `platform-auth`, plus `redis.service`, `escalation.processor`.
**Missing invalidation** on write endpoints of:
- `kanban` (card create/move/delete — dashboard staleness)
- `notifications` (mark-as-read — badge staleness)
- `automation` (rule create/toggle — trigger cache staleness)
- `bulk-import` (users/projects — user list staleness)
- `projects` (project CRUD — dashboard filter staleness)

**Fix pattern (add to each service):**
```ts
after successful mutation:
  await this.redis.delByPattern(`dashboard:${tenantId}:*`);
  await this.redis.delByPattern(`users:${tenantId}:*`);
```

### 🟡 BE-05 — Checklist `startTime` default inconsistency
- [checklist.service.ts:78](apps/api/src/modules/checklist/checklist.service.ts:78) creates with `'09:00'`.
- [checklist.service.ts:555](apps/api/src/modules/checklist/checklist.service.ts:555) imports with `'08:00'`.
- **Fix:** Define `const DEFAULT_START_TIME = '09:00'` at top of `checklist.service.ts` and use in both places (also update `dto/checklist.dto.ts:54`).

### 🟡 BE-06 — MIS calculator not covered by tests, and its score sign matters for demo
- Files: `mis/mis-calculator.service.ts`, `mis/mis.service.ts`.
- Prior memory says "score negative for delays" is a demo highlight — no unit tests exist. Any refactor risks silent breakage.
- **Fix:** Add `mis-calculator.service.spec.ts` covering: on-time = +score, delayed = -score, reworked = -score, mixed = correct sum.

### 🟡 BE-07 — Duplicate Prisma generated tree
- `apps/api/src/generated/prisma/*` AND `apps/api/src/generated/apps/api/src/generated/prisma/*` (nested).
- 8 stale JS/TS files in the duplicate tree bloat build.
- **Fix:** Delete `apps/api/src/generated/apps/` and confirm `prisma:generate` script targets only the intended output path (root `package.json:20` uses `--schema ../../prisma/schema.prisma` which is fine; check for a stale second `output` in `schema.prisma`).

### 🟡 BE-08 — Delegation status transitions in one service — no state-machine enforcement
- [delegation.service.ts:338](apps/api/src/modules/delegation/delegation.service.ts:338), :372, :394, :447 all set status directly with `if (task.status !== 'SEND_FOR_APPROVAL')` guards.
- Correct today, but if a new status like `CANCELLED` is added, missing branches will not fail loudly.
- **Fix:** Extract a `TaskStateMachine` helper with `assertTransition(from, to)` mapping; call from all mutation methods in delegation/work-request/fms.

### 🟢 BE-09 — Unused/deep-imports scattered
- Multiple services import `RedisService`, `PrismaService` directly rather than through a common index; refactor not urgent.

### 🟢 BE-10 — Swagger docs global but no auth documented per-endpoint for public routes
- Auth webhooks lack `@ApiSecurity('webhook-signature')` — cosmetic, but confuses integrators reading Swagger.

---

## 3. Business Logic Verification (against `project_risks.md`)

| Risk | Verified state |
|---|---|
| Delegation submit → SEND_FOR_APPROVAL not COMPLETED | ✅ `delegation.service.ts:338` |
| Delegation approve → COMPLETED | ✅ `:394` |
| Delegation rework loop | ✅ `:419` — sets REWORK / re-notifies |
| Password hashed on all paths | ✅ auth + users |
| RBAC enforced at API | 🟡 — global JWT+Tenant present, per-role missing on 8 controllers |
| Checklist honors `startTime` | 🟡 — inconsistent default |
| Duplicate functions removed | ✅ — none observed |
| Cache invalidation after mutation | 🟡 — 10/15 mutation modules invalidate |
| Date parsing unified | ✅ `parseFrontendDateTime` in `date.utils.ts` |
| FMS hierarchy filter | ✅ `getVisibleUserIds` in `fms.service.ts` |

---

## 4. Business Logic Not Yet Reviewed (Follow-up)

1. **Work Request status cycle** — is `SEND_FOR_APPROVAL` used by requester approval? Verify [work-request.service.ts].
2. **Checklist recurrence engine** — verify weekly/monthly/one-time handled in [queue/processors/checklist.processor.ts].
3. **SLA escalation** — verify [queue/processors/escalation.processor.ts] triggers before → warn → escalate transitions and notifies correct manager via hierarchy.
4. **Bulk import row-level errors** — verify partial-success semantics (some rows fail, others succeed, all reported to user).
5. **Reports export** — do endpoints stream large exports or buffer? OOM risk on 100k+ rows.
6. **Cloudinary upload signing** — verify signed uploads (not unsigned) and MIME-type allowlist.
7. **Automation trigger fan-out** — do triggers ever call themselves recursively? Circuit breaker?

---

## 5. Fix Roadmap (Backend)

Sprint 4 (before demo — Critical/High only):

1. **BE-01** Add `RolesGuard` + `@Roles(...)` on 6 internal controllers (ai/calendar/dashboard/kanban/notifications/search) + build portal token guards for client/vendor. Est. 2–3h.
2. **BE-02** Extract password validator, apply to `users.service` create/update/import. Est. 30min.
3. **BE-03** Remove TenantGuard base64 fallback. Est. 15min.
4. **BE-04** Add Redis invalidation to kanban/notifications/automation/bulk-import/projects mutation methods. Est. 2h.
5. **BE-05** Consolidate `DEFAULT_START_TIME`. Est. 5min.
6. **BE-06** MIS calculator unit tests. Est. 1h.

Post-demo:

7. **BE-07** Clean duplicate Prisma output tree.
8. **BE-08** TaskStateMachine helper.
9. Follow-up business-logic reviews from §4.

---

## 6. Backend Sign-off Gates

- [ ] Every controller has explicit `@Roles(...)` or is documented as intentionally public.
- [ ] `npm run test:e2e` includes work-request + checklist + fms suites.
- [ ] Password strength enforced on all 4 write paths (auth login DTO, auth reset, users create, users update, bulk import).
- [ ] `redis.delByPattern` present on every mutation service that affects a cached read.
- [ ] Prisma generated tree has no duplicates.
- [ ] MIS calculator has ≥3 unit tests covering positive, negative, mixed cases.

---

*Document Owner: Backend Developer · Last Refreshed: 2026-07-02 · Version: 2.0*

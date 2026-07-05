# TaskEasy — Full Code Review Report
**Date**: 2026-06-24  
**Scope**: NestJS Backend (`apps/api/src/`) + Next.js Frontend (`apps/web/src/`)  
**Reviewer**: AI Code Review (Claude)

---

## SEVERITY LEGEND

| Level | Meaning |
|-------|---------|
| 🔴 CRITICAL | Security breach, data loss, or complete feature failure |
| 🟠 HIGH | Significant security gap, incorrect access control, or broken core flow |
| 🟡 MEDIUM | Logic error, missing validation, or inconsistent guard application |
| 🟢 LOW | Code quality, performance, or minor inconsistency |

---

# PART 1 — BACKEND (NestJS API)

## 1. Infrastructure

### `main.ts`
- 🟡 **MEDIUM** — Swagger exposed in any `NODE_ENV` that isn't exactly `'production'`. Staging environments using `NODE_ENV=staging` will expose full API schema publicly.
- 🟢 **LOW** — No explicit `express.json({ limit: '...' })` — large payloads may be silently rejected.

### `app.module.ts`
- 🟠 **HIGH** — `TenantGuard` exists but is NEVER globally applied. Tokens issued to deleted/suspended tenants continue to work until expiry (up to 15 min).

### `common/guards/roles.guard.ts`
- 🟡 **MEDIUM** — Returns `true` silently when no `@Roles()` decorator is present. Any controller that forgets `@Roles()` has zero role restriction.

### `common/guards/permissions.guard.ts`
- 🟡 **MEDIUM** — Same silent passthrough issue. Any controller without `@RequirePermissions()` bypasses the permissions system entirely.

### `common/interceptors/audit.interceptor.ts`
- 🟢 **LOW** — Audit write failures are silently swallowed (`catch (err) { // silently ignore }`). Failed audit records produce no log or alert.

### `common/interceptors/cache.interceptor.ts`
- 🟡 **MEDIUM** — Cache invalidation is opt-in per controller and inconsistently applied. Several write endpoints don't invalidate the cache of their corresponding read endpoints.

---

## 2. Auth Module

### `modules/auth/auth.service.ts`
- 🔴 **CRITICAL** — Hardcoded fallback JWT secret:
  ```typescript
  secret: this.configService.get('JWT_ACCESS_SECRET') ?? 
          this.configService.get('JWT_SECRET') ?? 
          'change-me-in-production'
  ```
  If env vars are missing, tokens are signed with a known string — any attacker can forge valid JWTs. **Fix**: Fail-fast at startup using Joi/Zod config validation.

- 🟠 **HIGH** — Password strength validation (`validatePasswordStrength()`) is called on `resetPassword()` and `changePassword()` but **NOT on user creation** via `UsersService.create()`. An admin can create a user with password `"a"`.

- 🟡 **MEDIUM** — `decodeToken()` base64-decodes JWT payload without cryptographic verification. Fragile if the DB/Redis lookup is ever bypassed.

- 🟢 **LOW** — Refresh token accepted from request body (`fromBodyField('refreshToken')`). Undermines the XSS protection of httpOnly cookies.

### `modules/auth/strategies/jwt.strategy.ts`
- 🟡 **MEDIUM** — `resolvePermissions()` called on EVERY authenticated request — fetches full user record from DB on each request. No caching.

### `modules/auth/sso.service.ts`
- 🟡 **MEDIUM** — Microsoft OAuth sets unverified emails to `emailVerified = true` by default:
  ```typescript
  const emailVerified = profile.emails?.[0]?.verified ?? true;
  ```
  An attacker with an unverified Microsoft email matching an existing user can authenticate as that user.  
  **Fix**: Default to `false`, block login if not verified.

### `modules/auth/auth.controller.ts`
- 🟢 **LOW** — `/auth/me` has no throttle despite being called on every page load.

---

## 3. Users Module

### `modules/users/users.controller.ts`
- 🟠 **HIGH** — `GET /users/active` has no `@RequirePermissions()` decorator — inconsistent with all other endpoints.
- 🟢 **LOW** — `adminResetPassword()` does not validate password strength.

### `modules/users/users.service.ts`
- 🟡 **MEDIUM** — `assertCanAssignRole()` uses a hardcoded rank table. New roles added to the DB without updating this map will cause `NaN > NaN` comparisons, silently blocking all role assignments for that role.

---

## 4. Delegation Module

### `modules/delegation/delegation.service.ts`
- 🟡 **MEDIUM** — `approve()` calculates `delayDays` at approval time, not submission time. A task submitted on deadline but approved 3 days late shows as "3 days late" — unfairly penalising the doer for the approver's delay.  
  **Fix**: Record `submittedAt` when status → `SEND_FOR_APPROVAL`; calculate delay against `submittedAt`.

---

## 5. Work Request Module

### `modules/work-request/work-request.controller.ts`
- 🔴 **CRITICAL** — `RolesGuard` is MISSING from the guard chain:
  ```typescript
  @UseGuards(JwtAuthGuard, PermissionsGuard) // RolesGuard is ABSENT
  ```
  `@Roles()` decorators on `create`, `approve`, and `rework` are silently ignored. Any user with the right permission (regardless of role) can approve/rework.  
  **Fix**: `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`

### `modules/work-request/work-request.service.ts`
- 🟠 **HIGH** — `approve()` only allows `SUPER_ADMIN | ADMIN` but the controller (incorrectly) intends `MANAGER` too. Managers cannot approve work requests despite the business design.
- 🟡 **MEDIUM** — `rework()` has no ownership/hierarchy check. Any ADMIN can push any work request for rework, even outside their hierarchy.

---

## 6. Checklist Module

### `modules/checklist/checklist.service.ts`
- 🟡 **MEDIUM** — `bulkComplete()` validates task ownership (`assignedTo: userId`) but does NOT include `tenantId` in the query. Add `tenantId` filter to prevent cross-tenant exploitation:
  ```typescript
  where: { id: { in: taskIds }, assignedTo: userId, tenantId }
  ```

---

## 7. FMS Module

### `modules/fms/fms.controller.ts`
- 🟠 **HIGH** — `createWorkflow` and `addStep` have no `@RequirePermissions()`. Any ADMIN-role user can create FMS workflows regardless of permissions.
- 🟠 **HIGH** — `GET /:workflowId/steps` requires `fms.complete` permission instead of `fms.read`. Users can complete steps but not view them, breaking the UI.
- 🟡 **MEDIUM** — `GET /analytics` requires `task.read` instead of `fms.read` — wrong permission scope.

---

## 8. Approval Module

### `modules/approval/approval.controller.ts`
- 🔴 **CRITICAL** — `PermissionsGuard` MISSING from guard chain:
  ```typescript
  @UseGuards(JwtAuthGuard) // PermissionsGuard is ABSENT
  ```
  All `@RequirePermissions('task.approve')` decorators are silently ignored. Any authenticated user can access the approval queue.  
  **Fix**: `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)`

- 🟠 **HIGH** — `getCount` and `getMySubmissions` have no permission restrictions at all.

### `modules/approval/approval.service.ts`
- 🟢 **LOW** — `getReworkHistory()` is deprecated but not removed — dead code.

---

## 9. MIS Module

### `modules/mis/mis.controller.ts`
- 🔴 **CRITICAL** — `getDetailed` accepts arbitrary `?userId=<any>` query param without hierarchy validation:
  ```typescript
  const targetUserId = query.userId ?? user.sub;
  return this.misService.getDetailedData(targetUserId, query, user);
  ```
  Any ADMIN/MANAGER can view ANY employee's full MIS breakdown, ignoring hierarchy scope.  
  **Fix**: Validate `targetUserId` is inside `getVisibleUserIds()` before calling service.

- 🔴 **CRITICAL** — `getHistory` has the same `userId` bypass — no hierarchy check.

---

## 10. Reports Module

### `modules/reports/reports.controller.ts`
- 🟠 **HIGH** — `getProjectReport()` passes only `user.tenantId` to the service — no hierarchy filtering. Any ADMIN sees all projects across all hierarchy branches.

### `modules/reports/reports.service.ts`
- 🟠 **HIGH** — `query.userId` overrides hierarchy scoping in all 3 report types (`getDelegationReport`, `getWorkRequestReport`, `getChecklistReport`):
  ```typescript
  const userFilter = query.userId
    ? { doer: query.userId }           // bypasses visibleIds entirely
    : { doer: { in: visibleIds } };
  ```
  **Fix**: Validate `query.userId` is inside `visibleIds` before using it, else throw `ForbiddenException`.

---

## 11. Notifications Module

### `modules/notifications/notifications.gateway.ts`
- 🔴 **CRITICAL** — WebSocket JWT verification uses `JWT_SECRET` instead of `JWT_ACCESS_SECRET`:
  ```typescript
  secret: this.config.get<string>('JWT_SECRET')
  ```
  In correctly configured deployments using separate `JWT_ACCESS_SECRET` and `JWT_SECRET`, ALL WebSocket connections will fail with invalid signature. Real-time notifications are completely broken in production.  
  **Fix**: Use same secret resolution as REST auth:
  ```typescript
  secret: this.config.get('JWT_ACCESS_SECRET') ?? this.config.get('JWT_SECRET')
  ```

---

## 12. Platform Module

### `modules/platform/platform-auth.service.ts`
- 🔴 **CRITICAL** — `PLATFORM_ADMIN` role maps to empty permissions array:
  ```typescript
  PLATFORM_ADMIN: [],   // Empty — this role is completely unusable
  ```
  A PLATFORM_ADMIN user can log in but every `@RequirePermissions()` call returns 403. The role is non-functional.  
  **Fix**: Import `ROLE_PERMISSIONS['PLATFORM_ADMIN']` from `common/constants/permissions.ts`.

- 🟡 **MEDIUM** — `changePassword()` has no password strength validation.

### `modules/platform/platform.service.ts`
- 🔴 **CRITICAL** — `getDashboard()` and `listCompanies()` load ALL records with no pagination:
  ```typescript
  this.prisma.tenant.findMany()          // All tenants
  this.prisma.user.findMany()            // All users in all tenants
  this.prisma.delegationTask.findMany()  // All tasks
  ```
  Will OOM the Node process at scale. Use `_count` aggregations and paginated `findMany({ take, skip })`.

- 🟠 **HIGH** — `resetCompanyAdminPassword()` returns temp password in the HTTP response body — visible in browser dev tools, proxy logs, CDN logs, and audit log:
  ```typescript
  return { message: 'Password reset', tempPassword };
  ```
  **Fix**: Send via email only. Return `{ message: 'Temporary password sent to user email' }`.

- 🟡 **MEDIUM** — `createCompany()` has no pre-check for slug uniqueness — raw Prisma `P2002` constraint error propagates as 500.

---

## 13. Uploads Module

### `modules/uploads/uploads.service.ts`
- 🟠 **HIGH** — MIME type validation trusts the client-supplied `Content-Type` header:
  ```typescript
  if (!allowedMimeTypes.includes(file.mimetype)) { ... }
  ```
  A `.exe` sent with `Content-Type: image/jpeg` passes this check. Use magic-bytes detection (`file-type` npm package) instead.

---

## 14. Comments Module

### `modules/comments/comments.controller.ts`
- 🟠 **HIGH** — No permission restrictions on `create` or `findByRef`. Any authenticated user can post comments on ANY task/checklist (even ones they have no access to) and read all comments for any `refId`.

---

## 15. Roles Module

### `modules/roles/roles.controller.ts`
- 🟡 **MEDIUM** — `findAll`, `findOne`, `getAllPermissions` have no permission restriction. Any authenticated user can enumerate the full role and permission map — information disclosure for attackers.

---

## 16. Audit Module

### `modules/audit/audit.controller.ts`
- 🟠 **HIGH** — `PermissionsGuard` absent from guard chain. Any ADMIN-role user (regardless of whether they have `audit.view` permission) can read all audit logs.

---

## 17. Queue Processors

### `queue/processors/escalation.processor.ts`
- 🟡 **MEDIUM** — `checkStaleApprovals` checks Delegation and Work Request but NOT Checklist. Checklist approval SLA escalation never fires.

### `queue/processors/email.processor.ts`
- 🟡 **MEDIUM** — Unknown template name renders full job data payload as JSON in email body — could leak internal IDs or token data to the recipient:
  ```typescript
  } catch (templateError) {
    return `<pre>{{{json this}}}</pre>`;  // Dangerous fallback
  }
  ```

---

## 18. Automation Module

### `modules/automation/automation.service.ts`
- 🟡 **MEDIUM** — `update()` passes `dto as any` directly, allowing a `tenantId` field in the DTO to reassign the rule to another tenant (after the ownership check passes).

---

# PART 2 — FRONTEND (Next.js)

## 1. Authentication & Session

### `lib/axios.ts`
- 🟠 **HIGH** — `window.location.href = '/login'` called inside the axios interceptor without `typeof window !== 'undefined'` guard — throws `ReferenceError` in SSR/middleware contexts. `platform-axios.ts` correctly guards this; `axios.ts` does not.
- 🟡 **MEDIUM** — Token refresh uses `data.data.accessToken` (double-unwrap) while all other API calls use the helper that unwraps once. Fragile maintenance trap.

### `store/auth.store.ts`
- 🟡 **MEDIUM** — `isAuthenticated` is persisted to `sessionStorage` but `accessToken` is not. On reload, `isAuthenticated = true` but token is null — brief window where route guard may execute before refresh completes.
- 🟡 **MEDIUM** — `isSuperAdmin` check includes `'SAAS_OWNER'` but `platform-auth.store.ts` does not — inconsistent super-admin detection.

### `store/platform-auth.store.ts`
- 🟠 **HIGH** — Impersonation tokens (including `accessToken` and `refreshToken`) are persisted to `sessionStorage`. Violates the "tokens stay in memory" security design and exposes them to XSS.

---

## 2. Delegation Module

### `app/(app)/delegation/page.tsx`
- 🟠 **HIGH** — In the "All Delegations" tab, the "Done" button is shown for ALL rows where `status === 'PENDING' || status === 'REWORK'` — including tasks assigned to other users. Any user can click Done on someone else's task.  
  **Fix**: Gate button on `row.delegatedTo.id === user?.sub`.

- 🟢 **LOW** — Rating input has no JS min/max validation (only HTML attributes). Users can type `0` or `6`.

### `hooks/useDelegation.ts`
- 🟢 **LOW** — `useReworkDelegation` does not invalidate `['dashboard']` query. Dashboard counts become stale after rework.

---

## 3. Work Requests Module

### `app/(app)/work-requests/page.tsx`
- 🟠 **HIGH** — "New Request" button is visible to all roles including EMPLOYEE. Only Admins and Managers should initiate work requests per business rules.
- 🟡 **MEDIUM** — Shared `remarks` state used for both Approve and Rework modals. Text entered in one bleeds into the other if the user switches without submitting.

### `hooks/useWorkRequest.ts`
- 🟢 **LOW** — `useReworkWorkRequest` does not invalidate `['dashboard']` query.

---

## 4. Checklist Module

### `app/(app)/checklist/page.tsx`
- 🟡 **MEDIUM** — "Done" button shown to any user for `status === 'PENDING'` tasks — including tasks not assigned to the logged-in user. Should gate on `row.assignedTo?.id === user?.sub`.
- 🟡 **MEDIUM** — Two columns both have `key: 'id'` in the columns array — ambiguous; if `DataTable` de-duplicates by key, one column will silently disappear.
- 🟢 **LOW** — No `staleTime` on checklist queries — refetches on every focus change.

---

## 5. FMS Module

### `app/(app)/fms/page.tsx`
- 🟡 **MEDIUM** — CSV parser splits on `,` without handling quoted fields. `"Facility, Maintenance"` splits into two columns, corrupting imports.
- 🟡 **MEDIUM** — "Done" button shown for all `PENDING` steps regardless of `row.assignedTo.id === user?.sub`. Admins can mark employees' steps as done from the team-pending tab.
- 🟢 **LOW** — CSV import has no protection against formula injection (cells starting with `=`, `-`, `+`, `@`).

---

## 6. Approvals Module

### `app/(app)/approvals/page.tsx`
- 🟠 **HIGH** — NO route-level role guard. Any employee who navigates to `/approvals` directly can see the approval queue and attempt actions. Sidebar hides the link, but the route is unprotected.
- 🟡 **MEDIUM** — Shared `remarks` state for Approve and Rework modals — same bleed issue as Work Requests.
- 🟡 **MEDIUM** — `Column` used without generic type — `any` throughout, bypassing type safety for row data.

---

## 7. MIS Module

### `app/(app)/mis/page.tsx`
- 🟠 **HIGH** — NO route-level role guard. An EMPLOYEE can navigate directly to `/mis` and see all employees' performance data — violates the "Employee sees only own data" business rule.
- 🟡 **MEDIUM** — Drill-down uses `targetDate` column for all task types; Checklist and FMS use `plannedDate`, not `targetDate` — data may show blank/wrong dates.

---

## 8. Reports Module

### `app/(app)/reports/page.tsx`
- 🟠 **HIGH** — NO route-level role guard. Employees can access by URL.
- 🟡 **MEDIUM** — FilterBar allows filtering by any user — no frontend restriction.

---

## 9. Admin Settings

### `app/(app)/admin/page.tsx`
- 🟠 **HIGH** — NO route-level role guard. Any authenticated user can access `/admin` directly — can enumerate, create, edit, and delete users and projects.
- 🟡 **MEDIUM** — Project modal closes immediately on click, before API success confirmed. If creation fails, the form is gone.
- 🟡 **MEDIUM** — `handleSaveUser` sends `employeeId` as a patch field on edit — may cause constraint errors if `employeeId` is immutable.

---

## 10. Users Page

### `app/(app)/users/page.tsx`
- 🟠 **HIGH** — No page-level role guard. An EMPLOYEE accessing `/users` sees the full user list including emails, phone numbers, and roles — PII exposure.

---

## 11. Hierarchy Module

### `app/(app)/hierarchy/page.tsx`
- 🟠 **HIGH** — No route-level role guard.
- 🟡 **MEDIUM** — Member selection list includes Admin/Manager roles — they could be added as hierarchy members, which the backend may reject.
- 🟡 **MEDIUM** — No form validation — group can be submitted with empty `groupName` or no `adminId`.

---

## 12. Notifications

### `hooks/useNotifications.ts` + `store/notification.store.ts`
- 🟡 **MEDIUM** — **Dual source of truth**: REST API feeds the notifications list; WebSocket events feed the Zustand store's `unreadCount`. `useMarkAllRead` invalidates the REST cache but does NOT call `useNotificationStore.markAllLiveRead()`. The header badge continues to show stale unread counts.  
  **Fix**: Add `useNotificationStore.getState().markAllLiveRead()` inside the `onSuccess` callback.

---

## 13. Security Settings

### `app/(app)/settings/security/page.tsx`
- 🟡 **MEDIUM** — 2FA setup shows a broken `<img>` while `qrData` is undefined (`show2faSetup = true` is set before `onSuccess` fires).
- 🟡 **MEDIUM** — Frontend only validates password length ≥ 8; doesn't match backend complexity rules.

---

## 14. Integrations Page

### `app/(app)/settings/integrations/page.tsx`
- 🟠 **HIGH** — No role guard — any authenticated user accessing `/settings/integrations` can see all integration credentials.
- 🟡 **MEDIUM** — `buildFormsFromAccounts` re-runs on every refetch, overwriting unsaved local edits to integration forms.
- 🟡 **MEDIUM** — Secret fields (clientSecret, refreshToken, privateKey) are blanked in the form on load. Saving any partial change sends empty strings that may overwrite existing stored secrets.
- 🟡 **MEDIUM** — Uses `window.confirm()` for disconnect action — blocked in some iframe contexts, not accessible.

---

## 15. Login Page

### `app/(auth)/login/page.tsx`
- 🟡 **MEDIUM** — No TOTP entry UI. Users with 2FA enabled receive a 401 error with no path forward — they are permanently locked out of the UI.

---

## 16. Sidebar

### `components/layout/Sidebar.tsx`
- 🟢 **LOW** — `AUDITOR` role used in `roles` array but `AUDITOR` is not defined in the `Role` type. The nav item effectively never shows.
- 🟢 **LOW** — Hierarchy and Users nav items share the same icon — confusing in the sidebar.

---

## 17. Header

### `components/layout/Header.tsx`
- 🟡 **MEDIUM** — Profile and "Change Password" dropdown buttons have no `onClick` handler — they are dead no-ops.
- 🟢 **LOW** — Theme toggle manages its own state independently of `UiStore.theme` — two sources of truth for dark/light mode.

---

## 18. DataTable Component

### `components/ui/DataTable.tsx`
- 🟡 **MEDIUM** — Sorting and search are client-side over the current page only. With server-side pagination, sorting only sorts the 25 visible rows, not all results — incorrect UX.
- 🟡 **MEDIUM** — Excel/PDF export exports only the current page's data, not all records.

---

## 19. Form Defaults

### `components/users/UserFormModal.tsx`
- 🟡 **MEDIUM** — Default password hardcoded as `'Demo@1234'`:
  ```typescript
  password: 'Demo@1234'
  ```
  If an admin creates a user without changing the password, every new account has the same predictable default. Field should be blank.

- 🟢 **LOW** — `TEAM_LEAD` role missing from the role dropdown — likely an oversight.

---

# CROSS-CUTTING RECOMMENDATIONS (Priority Order)

### 1. Guard Consistency — Backend
Create a single composed decorator:
```typescript
export const UseAppGuards = () =>
  UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard);
```
Apply to ALL controllers. Missing one guard becomes a TypeScript error instead of a silent runtime bypass.

### 2. Fail-Fast Config Validation
Add Joi/Zod validation to `ConfigModule.forRoot()` for all required secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_PASSWORD`, etc.). Remove hardcoded fallback string.

### 3. Route Guards — Frontend
Add role-based page-level guards to all admin routes:
- `/approvals` — Admin/Manager only
- `/mis` — Admin/Manager only
- `/reports` — Admin/Manager only
- `/admin` — Super Admin only
- `/hierarchy` — Super Admin only
- `/users` — Admin only
- `/settings/integrations` — Admin only

### 4. Hierarchy Scope Enforcement
Add a shared `assertInHierarchy(callerId, targetUserId, tenantId)` utility in `HierarchyService`. All `?userId=` query params in admin endpoints must go through this before use.

### 5. Password Strength Universally
Extract `validatePasswordStrength()` into a shared `PasswordService`. Call from: user creation, admin reset, platform user reset, platform `changePassword`, SSO user provisioning.

### 6. Temp Password via Email Only
Never return temp passwords in API response bodies. `resetCompanyAdminPassword` and `resetPlatformUserPassword` must send via email and return only a success message.

### 7. Platform Pagination
All `findMany()` without `take` limits in `platform.service.ts` must be paginated before production launch.

### 8. MIME Type Magic Bytes
Replace `file.mimetype` header check in `uploads.service.ts` with `file-type` magic bytes detection.

### 9. Fix WebSocket JWT Secret
`notifications.gateway.ts` must use `JWT_ACCESS_SECRET` to match the REST auth flow.

### 10. Fix PLATFORM_ADMIN Permissions
Import `ROLE_PERMISSIONS['PLATFORM_ADMIN']` from `permissions.ts` in `platform-auth.service.ts`.

---

## CRITICAL ISSUES SUMMARY (Fix Immediately)

| # | Module | Issue |
|---|--------|-------|
| 1 | Notifications Gateway | WebSocket uses `JWT_SECRET` — WS auth broken in prod |
| 2 | Platform Auth | `PLATFORM_ADMIN` has empty permissions — role unusable |
| 3 | Work Request Controller | `RolesGuard` missing — `@Roles()` silently ignored |
| 4 | Approval Controller | `PermissionsGuard` missing — `@RequirePermissions()` silently ignored |
| 5 | MIS Controller | `getDetailed` + `getHistory` — arbitrary `userId` bypasses hierarchy |
| 6 | Platform Service | `getDashboard()` + `listCompanies()` — no pagination, will OOM |
| 7 | Auth Service | Hardcoded fallback JWT secret `'change-me-in-production'` |

---

*Report generated by AI code review — 2026-06-24*

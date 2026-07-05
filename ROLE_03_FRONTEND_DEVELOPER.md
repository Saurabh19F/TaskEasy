# TaskEasy — Frontend Developer Audit (Refreshed 2026-07-02)

**Role:** Frontend Developer · **Stack:** Next.js 14 · TypeScript · Tailwind · ShadCN UI · Zustand · React-Query · socket.io-client

**Verification method:** Static audit of `apps/web/src/{app,lib,hooks,store,components}`.

---

## 1. Architecture Snapshot

- **Route groups:** `(app)` (30 routes), `(auth)` (3), `(platform)` (15 routes for super-admin console).
- **API client:** `lib/axios.ts` — refresh-token interceptor with queued retry, typed helpers `apiGet/Post/Put/Patch/Delete/Upload`, `getApiError()` extractor. ✅ Solid.
- **Hooks:** 20 React-Query hooks — `useApprovals`, `useAuditLogs`, `useAuth`, `useAutomation`, `useBulkImport`, `useChecklist`, `useDashboard`, `useDelegation`, `useFms`, `useHierarchy`, `useMis`, `useNotifications`, `usePlatform`, `usePredictive`, `useProjects`, `useReports`, `useSearch`, `useSocket`, `useUploads`, `useUsers`, `useWorkRequest`.
- **State:** Zustand — `auth.store`, `notification.store`, `platform-auth.store`, `ui.store`.
- **Realtime:** `useSocket.ts` — socket.io client at `${WS_URL}/ws`.
- **PWA:** `PwaRegistration.tsx` + `manifest.json` + `offline` route.
- **`lib/api.ts`:** 606 lines — endpoint wrappers.

---

## 2. Critical / High UI-API Issues

### 🔴 FE-01 — Error handling missing from 7 hooks and most page-level mutations
Hooks with **zero** `onError`/`toast.error`:
`useApprovals`, `useAuditLogs`, `useBulkImport`, `useDashboard`, `useNotifications`, `usePredictive`, `useSearch`, `useSocket`.

Pages with zero try/catch/toast.error handler:
- `(app)/delegation/page.tsx`
- `(app)/audit-logs/page.tsx`
- `(app)/predictive/page.tsx`
- Both `settings/profile` and `settings/security` submit paths

**Symptom:** API 4xx/5xx fails silently. User keeps clicking, believing UI is frozen.

**Fix pattern:**
```ts
useMutation({
  mutationFn: (dto) => api.approve(dto),
  onSuccess: () => { toast.success('Approved'); qc.invalidateQueries(...); },
  onError: (e) => toast.error(getApiError(e)),
});
```
Apply globally by wrapping `QueryClient` with a `MutationCache({ onError })` in `components/providers.tsx` — one line fix that covers all pages.

### 🔴 FE-02 — `any` casts across 11 pages (34 occurrences)
Highest concentrations: `delegation/page.tsx` (11), `fms/page.tsx` (6), `work-requests/page.tsx` (5), `checklist/page.tsx` (4).
**Symptom:** Runtime shape drift hides API contract changes at build time; recent BE schema changes silently pass typecheck.
**Fix:** Replace with types from `packages/shared-types`; run `npm run typecheck` in CI (already scripted in root `package.json`).

### 🟡 FE-03 — Sidebar Notification dot logic depends on `useDashboard` polling, not socket
`useSocket.ts` opens `/ws` but `useNotifications` and layout badge use `useDashboard.getNotificationCounts()` polling. Realtime opportunity missed; also creates load.
**Fix:** Bind sidebar badge to `socket.on('notification:new')` invalidating the count query.

### 🟡 FE-04 — No optimistic updates on high-frequency actions
Kanban card move, checklist tick, mark-done in FMS all `await` the round-trip before UI updates. Feels sluggish on high latency.
**Fix:** Add `useMutation({ onMutate })` with query-cache patching + rollback for kanban and checklist.

### 🟡 FE-05 — Offline handling incomplete
`/offline` page exists but no service-worker cache strategy for `/dashboard`, `/delegation`. Reload while offline shows blank.
**Fix:** Register a workbox strategy in `PwaRegistration.tsx` (`NetworkFirst` with `CacheFirst` fallback for `/api/dashboard` GET).

### 🟡 FE-06 — Two auth stores (`auth.store`, `platform-auth.store`) both hydrate at boot
No guard prevents both from being active in the same tab. If a user logs into `/platform/login` in one tab while `/login` session is live in another, cross-token pollution possible when reusing `axios` instance.
**Fix:** Different axios instance for platform (`lib/platform-axios.ts` — present, verify it doesn't share interceptor state). Add a boot check that logs a warning if both tokens set.

### 🟡 FE-07 — Reports export triggers `apiGet` which returns unwrapped `data.data`
Excel/PDF endpoints likely return binary blobs — `apiGet` unwraps `res.data.data`, breaking blob responses.
**Fix:** For binary downloads use raw `api.get(url, { responseType: 'blob' })` (bypass `apiGet` helper). Verify `useReports.export()` implementation.

### 🟢 FE-08 — Loading skeletons only on a subset of pages
`(app)/dashboard/page.tsx` has skeletons; `mis/page.tsx`, `reports/page.tsx`, `audit-logs/page.tsx` show blank on first load.
**Fix:** Extract `components/ui/PageSkeleton.tsx` and use across all list pages.

### 🟢 FE-09 — Form validation done manually in pages
No `react-hook-form` + `zod` schemas visible in most forms — server enforces validation; user sees post-submit errors instead of field-level.
**Fix:** Use `lib/schemas.ts` (already present) + `react-hook-form` on `users`, `projects`, `checklist` create forms.

### 🟢 FE-10 — Dark-mode class not guaranteed on server-rendered pages
No `class="dark"` script-injected before hydration in `layout.tsx` → dark-mode flash on reload.
**Fix:** Add a small inline `<script>` in `layout.tsx` that reads `localStorage.theme` and sets `document.documentElement.classList` before React hydrates.

---

## 3. Per-Page Wiring Check

| Page | API hook | Error state | Loading state | Empty state | Type-safe |
|---|---|---|---|---|---|
| `/dashboard` | `useDashboard` | 🟡 no onError | ✅ | 🟡 | ✅ |
| `/delegation` | `useDelegation` | 🔴 none | ✅ | ✅ | 🔴 `any` × 11 |
| `/work-requests` | `useWorkRequest` | ✅ | ✅ | 🟡 | 🔴 `any` × 5 |
| `/checklist` | `useChecklist` | ✅ | ✅ | 🟡 | 🔴 `any` × 4 |
| `/fms` | `useFms` | ✅ | ✅ | 🟡 | 🔴 `any` × 6 |
| `/approvals` | `useApprovals` | 🔴 none | ✅ | ✅ | 🟡 |
| `/mis` | `useMis` | ✅ | 🟡 | 🟡 | 🟡 |
| `/reports` | `useReports` | ✅ | 🟡 | 🟡 | 🟡 |
| `/audit-logs` | `useAuditLogs` | 🔴 none | 🔴 | 🟡 | 🟡 |
| `/notifications` | `useNotifications` | 🔴 none | 🟡 | 🟡 | 🟡 |
| `/predictive` | `usePredictive` | 🔴 none | 🟡 | 🟡 | 🟡 |
| `/kanban` | (unclear) | 🟡 | 🟡 | 🟡 | 🟡 |
| `/calendar` | (unclear) | 🟡 | 🟡 | 🟡 | 🟡 |
| `/hierarchy` | `useHierarchy` | ✅ | ✅ | 🟡 | ✅ |
| `/users` | `useUsers` | ✅ | ✅ | ✅ | 🟡 |
| `/projects` | `useProjects` | ✅ | ✅ | ✅ | ✅ |
| `/bulk-import` | `useBulkImport` | 🔴 none | ✅ | ✅ | 🟡 |
| `/automation` | `useAutomation` | ✅ | ✅ | ✅ | ✅ |
| `/settings/*` | `useUsers` | 🟡 | 🟡 | n/a | 🟡 |
| `(platform)/*` (15) | `usePlatform` | 🟡 | 🟡 | 🟡 | 🟡 |

---

## 4. FMS Header Buttons — Verified Wired

| Button | Handler | Modal | File |
|---|---|---|---|
| Import Sheet | `setShowImport(true)` | ✅ modal | [(app)/fms/page.tsx:496,606](apps/web/src/app/(app)/fms/page.tsx:496) |
| Analytics | `setShowAnalytics(true)` | ✅ modal (with `useQuery(fmsApi.getAnalytics)`) | :497, :779 |
| Monitor | `setShowMonitor(true)` | ✅ modal | :498, :695 |
| Generate with AI | `setShowAi(true)` | ✅ modal | :559, :832 |

Prior risk #8 confirmed resolved.

---

## 5. Fix Roadmap (Frontend)

Sprint 4 (before demo):
1. **Global mutation error toast** in `providers.tsx` — one line, covers 8+ pages (FE-01).
2. **Remove `any` casts** on the 4 core pages (delegation/WR/checklist/fms) — swap to `packages/shared-types` (FE-02).
3. **Blob-safe reports export** (FE-07) — verify Excel/PDF actually downloads.
4. **Dark-mode flash fix** in `layout.tsx` (FE-10).
5. **Empty-state components** on list pages (FE-08).

Post-demo:
6. Realtime notification badge via `useSocket` (FE-03).
7. Optimistic updates on kanban + checklist (FE-04).
8. PWA offline cache for dashboard (FE-05).
9. `react-hook-form` + zod on core forms (FE-09).

---

## 6. Frontend Sign-off Gates

- [ ] Global mutation error toast present.
- [ ] `npm run typecheck` green with 0 `any` casts in `(app)/{delegation,work-requests,checklist,fms}`.
- [ ] Reports Excel + PDF download opens in native app.
- [ ] Dark-mode toggle produces no flash.
- [ ] Every list page has skeleton and empty states.
- [ ] Login flow works for all three role types (`/login`, `/platform/login`).
- [ ] `useSocket` connects without console error on load.

---

*Document Owner: Frontend Developer · Last Refreshed: 2026-07-02 · Version: 2.0*

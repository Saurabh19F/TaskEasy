# TaskEasy — UI/UX Designer Audit (Refreshed 2026-07-02)

**Role:** UI/UX Designer · **Scope:** Branding · Dark mode · Accessibility · Polish

**Verification method:** Static audit of `apps/web/src` — layout, components, dark-mode classes, aria attributes, brand strings.

---

## 1. Design System Snapshot

- **Typography:** Inter (body), Plus Jakarta Sans (display), JetBrains Mono (code). Loaded via `next/font/google` in [layout.tsx:6-26](apps/web/src/app/layout.tsx:6) — self-hosted, no FOUT.
- **Metadata:** `title`, `manifest`, PWA apple-web-app config all present in `layout.tsx`. ✅
- **Brand strings:** 60 occurrences of "TaskEasy" / brand tokens across 25 source files. **Zero "TaskDone" in `apps/**`.** ✅
- **Dark-mode Tailwind classes:** 507 `dark:` variants across 35 files. Wide coverage.
- **aria/role/label attributes:** 20 hits across 8 components. Thin.
- **PWA:** `manifest.json` present, `PwaRegistration.tsx` mounted, `/offline` route implemented.

---

## 2. Critical / High UI-UX Issues

### 🔴 UX-01 — Dark-mode flash on reload
- [layout.tsx:45](apps/web/src/app/layout.tsx:45) hardcodes `<html className="light">`.
- Users who toggled to dark see a bright flash for one paint before React hydrates.
- **Fix:** Add an inline script BEFORE `<Providers>`:
  ```tsx
  <html lang="en" suppressHydrationWarning>
    <head>
      <script
        dangerouslySetInnerHTML={{
          __html: `try { const t = localStorage.getItem('theme');
            document.documentElement.className = t === 'dark' ? 'dark' : 'light';
          } catch {} `,
        }}
      />
    </head>
    ...
  ```

### 🔴 UX-02 — Accessibility floor is low
Only 20 aria attributes in the whole component tree. Key gaps:
- Modal (`ui/Modal.tsx`) has 2 aria hits — verify it uses `role="dialog"` + `aria-labelledby` + focus trap.
- Sidebar (`Sidebar.tsx`) has 2 hits — nav items need `aria-current="page"` for active state.
- Icon-only buttons (delegation actions, kanban column controls, notification bell) need `aria-label`.
- Form inputs across `settings/*` — verify `<label htmlFor>` associations.
- No skip-to-content link on `layout.tsx`.
- **Fix:** Do a component-level pass. Priority order: Modal → Header/Sidebar → Icon buttons → Forms. Target WCAG 2.1 AA.

### 🟡 UX-03 — 5 pages have zero `dark:` classes
Grep result implies at least these pages don't participate in dark mode: `admin/page.tsx` (7 hits — low), `users/page.tsx` (1 hit — mostly light), plus a few settings pages. Some UI colors are hardcoded (`text-slate-700`, `bg-white`) without dark variants.
- **Fix:** Audit each of `users/page.tsx`, `admin/page.tsx`, `settings/page.tsx` in the browser with dark toggle on. Add `dark:` variants where legibility breaks.

### 🟡 UX-04 — Empty states inconsistent across list pages
Per ROLE_03 §3, several list pages show blank on empty (mis, reports, audit-logs, notifications, predictive).
- **Fix:** Design ONE `EmptyState` component with:
  - Illustration (or icon + subdued color)
  - One-line "You have no X yet"
  - Primary CTA where relevant ("Assign a task", "Import from Sheet")
- Apply to all list pages.

### 🟡 UX-05 — Loading skeletons partial
Dashboard has skeletons; other pages show blank flicker.
- **Fix:** Extract `PageSkeleton` and `RowSkeleton` matching the actual layout shape. Apply to reports, mis, audit-logs, notifications.

### 🟡 UX-06 — Notification dot design not verified live
`Sidebar.tsx` shows brand token and dark support; verify the notification badge (`NotificationDrawer.tsx`) matches the design language:
- Consistent badge size across nav
- High-contrast red on both themes
- Animated pulse on unread arriving live (once socket wiring lands per FE-03)

### 🟡 UX-07 — Modal focus behavior
`ui/Modal.tsx` has aria hits but manual audit needed for:
- ESC closes
- Focus returns to trigger on close
- First focusable inside receives focus on open
- Tab loops within modal, doesn't escape to underlying page
- **Fix:** Adopt `@radix-ui/react-dialog` (ShadCN wraps it) if not already; audit remaining custom modals in FMS page (Import/Analytics/AI/Monitor) — those are custom modals per fms/page.tsx and may not trap focus.

### 🟡 UX-08 — Color contrast on secondary text
Tailwind `text-slate-400` on white is 3.3:1 — below AA (4.5:1) for body copy. Common on subtitles and helper text.
- **Fix:** Bump secondary text to `text-slate-500` (5.9:1) in light mode and `text-slate-300` in dark. Audit high-density pages (dashboard cards, mis table).

### 🟡 UX-09 — MIS grade / score visual not exercised in demo seed
Per DB-08, seed produces no delayed task → MIS shows all-zero → demo lands flat. UI is fine; content isn't.
- **Fix (design side):** Ensure the MIS badge for "negative score" uses a red-orange gradient distinct from a neutral zero — worth previewing in Figma before final polish.

### 🟢 UX-10 — Sidebar icon-labels break on narrow widths
Collapsed sidebar uses icons only. Verify tooltip appears on hover; if not, add via `Radix Tooltip`.

### 🟢 UX-11 — PWA install prompt not surfaced
Manifest present but no in-app "Install app" CTA. Chrome shows its own address-bar prompt, but a subtle banner on `/dashboard` (once, dismissible) drives adoption.

### 🟢 UX-12 — Reports/Excel export lacks progress feedback
Large exports could take seconds. Currently no toast/progress bar.
- **Fix:** Show `toast.loading('Preparing export…')` and resolve on completion.

### 🟢 UX-13 — Icon set consistency
Verify that `lucide-react` is used exclusively (spot-check FMS page uses `Upload`, `BarChart2`, `Activity`, `CheckCircle` — consistent). Mixing icon sets creates visual noise.

---

## 3. Branding — Verified Clean

| Where | Result |
|---|---|
| Metadata title | "TaskEasy — Workflow Management" ✅ |
| PWA `appleWebApp.title` | "TaskEasy" ✅ |
| Sidebar brand | (verify visually; grep shows "TaskEasy" hits in Sidebar) ✅ |
| Login page | Grep found brand in `login/page.tsx` ✅ |
| Legacy "TaskDone" in shipped source | **0 hits** ✅ |
| Legacy "TaskDone" in `SaaS-fixes/*.js` | Still present — non-shipped, but purge per BUG-QA-08 |

---

## 4. Dark-Mode Coverage Check

Prior audit hit-counts by page (partial):
- Dashboard, delegation, checklist, fms, kanban, mis, reports, notifications — 20+ `dark:` hits each ✅
- Approvals (3), audit-logs (13), hierarchy (11), work-requests (6), mis (20), calendar (13) ✅
- **Low-coverage flags:** `users/page.tsx` (1), `admin/page.tsx` (7), a few settings pages — audit these in-browser.

---

## 5. Fix Roadmap (UI/UX)

Sprint 4 (before demo):

1. **UX-01** Kill dark-mode flash with inline script. 5 min.
2. **UX-08** Bump low-contrast text colors. 30 min.
3. **UX-04** `EmptyState` component + apply on 5 list pages. 1 h.
4. **UX-05** `PageSkeleton` + `RowSkeleton`. 1 h.
5. **UX-03** Add missing `dark:` variants on users, admin, settings. 45 min.
6. **UX-06** Notification badge visual pass. 15 min.
7. **UX-12** Export progress toast. 15 min.

Post-demo:

8. **UX-02** Full WCAG AA pass across Modal, Sidebar, forms, icon buttons.
9. **UX-07** Custom-modal focus trap audit in FMS.
10. **UX-10** Sidebar tooltip on collapsed state.
11. **UX-11** PWA install banner.
12. Extract a Storybook (Chromatic optional) for `components/ui/*` so design system is reviewable in isolation.

---

## 6. Design Sign-off Gates

- [ ] Toggle dark mode 20 times, no flash.
- [ ] All list pages have skeleton + empty state.
- [ ] Text contrast passes AA on all headings and body copy.
- [ ] Keyboard-only navigation from login → dashboard → delegate → approve works with visible focus rings.
- [ ] Every icon-only button has an accessible name.
- [ ] Modals trap focus and restore it on close.
- [ ] No "TaskDone" or placeholder copy visible.
- [ ] Notification dot animates on live event.
- [ ] MIS demo produces at least one negative score with strongly distinct color.

---

*Document Owner: UI/UX Designer · Last Refreshed: 2026-07-02 · Version: 2.0*

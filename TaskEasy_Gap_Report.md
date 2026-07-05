# TaskEasy App — Final Gap Report
**Audit Date:** 25 June 2026  
**Files Audited:** `Index html Task app.txt` (6,960 lines) + `Task app Code.gs` (5,092 lines)  
**Status:** COMPLETE — All 47 gaps catalogued with exact line numbers and fixes.

---

## SEVERITY LEGEND
- 🔴 **CRITICAL** — Breaks functionality or creates wrong data
- 🟠 **HIGH** — Affects workflow correctness or security
- 🟡 **MEDIUM** — UX/display issue or dead code
- 🟢 **LOW** — Minor cleanup / branding

---

## SECTION A — FRONTEND BUGS (`Index html Task app.txt`)

---

### A-1 🟢 Branding Mismatch — "TaskDone" instead of "TaskEasy"
**Lines:** 7, 1513, 1557  
**Problem:** Three places still say "TaskDone":
- Line 7: `<title>TaskDone Dashboard</title>`
- Line 1513: Login page `<h1>TaskDone</h1>`
- Line 1557: Sidebar logo `<h1>TaskDone</h1>`

**Fix:** Replace all three with "TaskEasy".

---

### A-2 🔴 Duplicate Form Submit Event Listeners
**Lines:** 2543–2548  
**Problem:** `setupEventListeners()` registers the delegation form submit handler **twice**:
```javascript
// First registration (line 2543):
$(document).on('submit', '#delegate-task-form', handleDelegateTaskSubmit);

// Second registration with .off() then .on() (line 2546):
$(document).off('submit', '#delegate-task-form').on('submit', '#delegate-task-form', handleDelegateTaskSubmit);
```
Same pattern repeated for `#checklist-task-form` and `#work-request-form`. The first binding fires, then the `.off()` removes it, and the second binding replaces it — causing confusing race conditions and potentially firing the handler zero times if order of execution changes.

**Fix:** Remove the first set of bindings (lines 2543–2545) and keep only the `.off().on()` pattern.

---

### A-3 🔴 Duplicate `formatAttachments` / `viewAttachments` Functions — Conflict
**Lines:** 5572–5659  
**Problem:** Two completely different implementations of `formatAttachments` and `viewAttachments` exist:
- New version (lines 5572–5592): generates `<button onclick="viewAttachments(...)">` with encoded URLs
- Old version (lines 5651–5659): generates `<button class="view-attachments-btn" data-urls="...">` 

The **old version overrides the new** because JavaScript uses the last definition. Meanwhile `setupEventListeners()` wires up `$(document).on('click', '.view-attachments-btn', ...)` which matches the old button class — but the old `formatAttachments` is the active one (last defined), so the buttons do use `.view-attachments-btn`. However the new `viewAttachments` at ~line 5580 uses `onclick` inline — which never gets called because the old function overrides it.

**Fix:** Delete lines 5651–5659 (the old duplicate definitions). Verify buttons in all tables use the new `onclick` pattern consistently.

---

### A-4 🟠 Missing `last_week` Case in `isDateInPeriod()`
**Lines:** 5120–5143  
**Problem:** The client-side date filter function handles `today`, `this_week`, `this_month`, `last_month` but has **no `last_week` case**. It falls through to `return true` for `last_week`. Since MIS default period is `last_week`, the client-side filter shows all data unfiltered when period is last_week.

**Fix:**
```javascript
case 'last_week': {
    const d = new Date(dateObj);
    d.setHours(0,0,0,0);
    const now = new Date(); now.setHours(0,0,0,0);
    const dayOfWeek = now.getDay() || 7;
    const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - (dayOfWeek - 1));
    const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
    return d >= lastMonday && d <= lastSunday;
}
```

---

### A-5 🟠 Delegation Submit Directly Completes Without Approval
**Line:** Comment at ~line 3440 in backend; visible in frontend `handleEmployeeDelegationSubmit`  
**Problem:** The system correctly uses `submitTaskForApproval()` which sets status to `Send for Approval` (confirmed in Code.gs line 3419). However `handleDashboardTaskComplete()` (frontend lines 3661–3665) handles delegation/checklist/work request but **not FMS** — FMS tasks clicked from the dashboard priority list will throw a silent error or do nothing.

**Fix:** Add FMS handling in `handleDashboardTaskComplete()`:
```javascript
} else if (task.type === 'FMS') {
    google.script.run.withSuccessHandler(...).markFmsTaskDone(task.rowId);
}
```

---

### A-6 🟠 Work Request & FMS Have No Done Button in `renderPriorityTasks()`
**Lines:** 3607–3659  
**Problem:** `actionBtn` is only built for `Delegation` and `Checklist` types. Work Request and FMS tasks show in the priority widget but have no action button — users can only navigate away and find the task in its module.

**Fix:** Add cases for `Work Request` and `FMS` in the button-rendering switch:
```javascript
} else if (task.type === 'Work Request') {
    actionBtn = `<button onclick="handleDashboardTaskComplete(...)">Done</button>`;
} else if (task.type === 'FMS') {
    actionBtn = `<button onclick="handleDashboardTaskComplete(...)">Done</button>`;
}
```

---

### A-7 🔴 Broken Canvas IDs — Dead Chart Code
**Lines:** 2335–2375, 3439–3508  
**Problem 1:** `renderPerformanceCharts()` tries to get `#perfBarChart` and `#perfDoughnutChart` canvas elements that **do not exist** anywhere in the HTML. Function will silently fail every time.

**Problem 2:** `renderProjectStatusChart()` references `#projectStatusChart` canvas which also doesn't exist. The app uses `renderProjectStatusTable()` instead.

**Fix:** Either add the canvas elements to the HTML, or delete the dead chart functions and any calls to them.

---

### A-8 🔴 MIS Filter ID Mismatch
**Line:** 4258  
**Problem:** `showMisSummaryDetails` uses `$('#mis-user-filter')` to collect the filter value but the actual filter dropdown has ID `#mis-assigned-to-filter`. This means the user filter value is always empty/undefined when drilling down into MIS detail.

**Fix:** Change line 4258:
```javascript
// WRONG:
const employee = $('#mis-user-filter').val();
// CORRECT:
const employee = $('#mis-assigned-to-filter').val();
```

---

### A-9 🟠 Arrow Function `this` Bug in MIS Close Handler
**Lines:** 4284–4287  
**Problem:**
```javascript
$(document).on('click', '#close-mis-detail-view', () => {
    ...
    $(this).empty(); // 'this' is the outer scope, NOT the clicked element
});
```
Arrow functions don't bind `this`. `$(this).empty()` will try to empty `window` or `undefined`.

**Fix:** Use a regular function:
```javascript
$(document).on('click', '#close-mis-detail-view', function() {
    $('#mis-detail-view').empty().hide();
    $('#mis-main-content').show();
});
```

---

### A-10 🔴 FMS Tab TypeError Crash
**Lines:** 5520–5528  
**Problem:** `reloadActiveViewData()` for the FMS view:
```javascript
const activeTarget = $('#fms-view .tab-link.active').data('target');
// If no tab is active, activeTarget is undefined
activeTarget.substring(1); // TypeError: Cannot read property 'substring' of undefined
```
This crashes the entire reload logic silently.

**Fix:**
```javascript
const activeTarget = $('#fms-view .tab-link.active').data('target');
if (!activeTarget) return; // Guard against undefined
const activeTabId = activeTarget.substring(1);
```

---

### A-11 🟡 `stateSave: true` in DataTable — Stale UI Between Sessions
**Line:** 5696  
**Problem:** `stateSave: true` in `initializeDataTable` persists pagination, sort order, and search filters in localStorage between browser sessions. A user logging in fresh will see old filtered state from a previous session.

**Fix:** Either set `stateSave: false`, or clear DataTable state on logout:
```javascript
// In logout logic:
$.fn.dataTable.tables({ api: true }).state.clear();
```

---

### A-12 🟡 `checklist-start-time` Input Ignored by Backend
**Line:** 4859 (HTML comment)  
**Problem:** Comment explicitly says: *"Note: Frequency logic in Code.gs currently hardcodes time to 18:00:00."* The `checklist-start-time` input is displayed in UI but the checklist backend's frequency date generation doesn't use the time sent from frontend.

**Fix:** In `saveChecklistTask` (Code.gs ~line 3301), when `formattedStartDate` is built, it correctly uses `parseTaskTargetDateTime_(task.startDate)` — so the frontend must ensure it sends the combined date+time as `YYYY-MM-DDTHH:mm:ss`. Verify `handleChecklistTaskSubmit` in the frontend properly combines the date picker and time fields before sending.

---

### A-13 🟡 Export Button Handler Registered Twice
**Lines:** 6543–6591 and 6803–6875 (Excel) / 6568–6591 and 6877–6960 (PDF)  
**Problem:** `$(document).on('click', '.export-excel-btn', ...)` is registered **twice** — once at line 6543 and again at line 6803. Same for `.export-pdf-btn`. Clicking export will fire two handlers and attempt to create two file downloads simultaneously.

**Fix:** Delete the first, older set of handlers (lines 6543–6591).

---

### A-14 🟡 `loadWorkRequestForm` Does Not Use Dynamic Row Users Correctly
**Lines:** 6264–6265  
**Problem:** In `loadWorkRequestForm`, after injecting HTML, it calls:
```javascript
google.script.run...getAllUsers()...// populates #requestFor
$('#requestProject').html(...)       // populates #requestProject
```
But `#requestFor` and `#requestProject` are not inside the form template injected at line 6241. Those IDs don't exist in the new `loadWorkRequestForm` HTML — `addWorkRequestRow()` creates per-row selects with IDs like `#wr-user-${rowId}`. The old static selectors fail silently.

**Fix:** Remove lines 6264–6265. The `addWorkRequestRow()` function already handles user/project dropdowns per row correctly.

---

## SECTION B — BACKEND BUGS (`Task app Code.gs`)

---

### B-1 🔴 `cleanStr` Defined THREE Times
**Lines:** 2801–2803, 4383–4385, 4516–4518  
**Problem:** Three identical `cleanStr` function definitions:
```javascript
function cleanStr(str) { return String(str || '').trim().toLowerCase(); }
```
In Google Apps Script, **the last definition wins** — earlier ones are overridden. This is harmless now since all three are identical, but it means code was edited/pasted multiple times without cleanup and creates confusion.

**Fix:** Keep only one definition (any of the three). Delete the other two.

---

### B-2 🔴 `getDateRangeYmd` Defined TWICE — Second Has Logic Bug
**Lines:** 1969–2030 (first), 4329–4379 (second)  
**Problem:** Two definitions; the **second one overrides** the first. The second definition at line 4356 has a destructive mutation bug:
```javascript
case 'this_week':
    const day = now.getDay() || 7;
    if (day !== 1) now.setHours(-24 * (day - 1)); // MUTATES 'now' object
    from = now;
    to = new Date(); // 'now' was already mutated, so this is NOW correct,
                     // but 'from' and 'now' point to same object
```
`setHours(-24*(day-1))` is attempting to roll back to Monday by setting negative hours, which works but is fragile. The real problem: `from = now` and both `from` and `now` point to the same Date object. If anything modifies `now` later, `from` also changes.

**Fix:** Delete lines 1969–2030 (first definition). Fix the second definition:
```javascript
case 'this_week':
    const day = now.getDay() || 7;
    from = new Date(now); // clone
    from.setDate(now.getDate() - (day - 1)); // Go back to Monday
    to = new Date(now); // Today
    break;
```

---

### B-3 🔴 Frontend JavaScript Code Accidentally Placed in Code.gs
**Lines:** 4909–4931  
**Problem:** `silentReload()` function in Code.gs references pure frontend variables:
```javascript
function silentReload() {
    if (currentView === 'dashboard-view' ...) {  // Frontend variable
        filters = collectFilters('dashboard');     // Frontend function
    }
    google.script.run...getUnifiedAppData(currentUser, currentUserRole); // Frontend call
    GLOBAL_STORE.dashboard = data.dashboard;      // Frontend variable
    reloadActiveViewData();                        // Frontend function
}
```
This is **HTML JavaScript that was accidentally copy-pasted into Code.gs**. If it ever gets called server-side, it will throw `ReferenceError`.

**Fix:** Delete lines 4909–4931 from Code.gs entirely. This function already exists in the frontend.

---

### B-4 🔴 `getNotificationCounts` Calls `getWorkRequestsForApproval` with Wrong Parameters
**Line:** 215  
**Problem:**
```javascript
// Employee branch — WRONG (2 args instead of 3):
const wrApprovals = getWorkRequestsForApproval(userName, 'All Projects');
```
`getWorkRequestsForApproval` signature is `(userName, userRole, projectFilter)`. Passing `'All Projects'` as `userRole` means:
- `isSuperAdmin = ('All Projects' === 'Super Admin')` → `false`  
- Only checks if `requestedBy === userName`, never as super admin

Employee notification count for approvals will be unreliable (likely 0 for most employees).

**Fix:**
```javascript
const wrApprovals = getWorkRequestsForApproval(userName, 'Employee', 'All Projects');
```

---

### B-5 🔴 `updateStatusWrapper` Hardcodes Rating as '5'
**Line:** 4702  
**Problem:**
```javascript
if (tlc === 'delegation') {
    return updateTaskStatus(id, status, remarks, remarks, '5'); // Rating always '5'
}
```
The `updateTaskStatus` signature is `(taskId, status, remarks, finalRemarks, rating)`. Every approved delegation task gets rating "5" regardless of what the admin chose in the UI.

**Fix:** Pass actual rating from the approval modal. Frontend `updateStatusWrapper` call must include the rating:
```javascript
// Frontend call should be:
google.script.run.updateStatusWrapper(type, id, status, remarks, planDate, rating);

// Backend:
function updateStatusWrapper(type, id, status, remarks, planDate, rating) {
    if (tlc === 'delegation') {
        return updateTaskStatus(id, status, remarks, remarks, rating || 'N/A');
    }
    ...
}
```

---

### B-6 🟠 `getFmsTasksForEmployee` — Admin Won't See Own FMS Tasks
**Line:** 4113  
**Problem:**
```javascript
const teamMembersLower = isAdmin ? getTeamMembers(userName, userRole).map(...) : [];
```
`getTeamMembers` returns only the **employees under** an admin, NOT the admin themselves. So an Admin user's own FMS tasks will never show up in My FMS view.

**Fix:** Use `getTeamMembersWithManager` which includes the admin themselves:
```javascript
const teamMembersLower = isAdmin ? getTeamMembersWithManager(userName, userRole).map(m => clean(m)) : [];
```

---

### B-7 🟠 `getChecklistTasksForApproval` Looks for Wrong Status
**Line:** 1232  
**Problem:**
```javascript
if (teamMembers.includes(userName) && row[...TASK_ID] && approvalStatus === 'completed') {
```
This returns checklists already marked `Completed` — these are already done tasks, NOT items awaiting approval. The Approve/Review screen should show checklists with `approvalStatus === 'send for approval'` or a similar pending-approval status.

However, the `markChecklistTaskDone` function directly sets `APPROVAL_STATUS = 'Completed'` without an intermediate approval step. **The checklist approval flow is entirely missing** — checklists skip straight to Completed bypassing Approve/Review entirely.

**Fix (Structural):** Decide: either (a) checklists don't need approval (remove checklist from `getChecklistTasksForApproval` and the Approval UI), OR (b) add a proper `Send for Approval` step in `markChecklistTaskDone`:
```javascript
// Option B: Change markChecklistTaskDone to set:
sheet.getRange(foundRow, CHECKLIST_TASK_COLS.APPROVAL_STATUS + 1).setValue('Send for Approval');
// Then in getChecklistTasksForApproval, check for 'send for approval'
```

---

### B-8 🟢 `doGet` Title Says "Task Management Dashboard"
**Line:** 479  
**Problem:**
```javascript
.setTitle('Task Management Dashboard')
```
Should be "TaskEasy" branding.

**Fix:**
```javascript
.setTitle('TaskEasy Dashboard')
```

---

### B-9 🟡 `saveMisWeeklySnapshot` Does NOT Save `nextWeekTarget`
**Lines:** 4198–4263  
**Problem:** `saveMisWeeklySnapshot(userName, userRole)` only takes 2 parameters and appends rows with 11 columns. The MIS History sheet has 12 columns including `Next Week Target`. This function never writes the target score.

`saveUserWeeklyScore(targetEmployee, nextWeekTarget, currentUserRole)` is the separate function that DOES save the target — these are two different save functions called from different contexts.

**Fix:** Either:
- Merge the two functions into one that accepts target score, OR
- In the frontend MIS "Update" button, call `saveUserWeeklyScore` instead of `saveMisWeeklySnapshot` when a target score has been entered

---

### B-10 🟡 Multiple Dead/Duplicate Old Functions
**Problem:** Older, slower versions of functions exist alongside their optimized replacements. None of the following are called from `getDashboardPageData` or `getUnifiedAppData` anymore, but they waste memory and create confusion if accidentally called:

| Old Function | Lines | Replaced By |
|---|---|---|
| `getMyPriorityTasks` | 1628–1731 | `getMyPriorityTasks_Optimized` |
| `getDashboardTrendData` | 1733–1796 | `getDashboardTrendData_Optimized` |
| `getDashboardMetrics` | 1797–1832 | `getDashboardMetrics_Optimized` |
| `getProjectStatusData` | 3674–3795 | `getProjectStatusData_Optimized` |
| `getTeamPriorityTasks` | 4520–4653 | `getTeamPriorityTasks_Optimized` |
| `getAppInitialState` | 4868–4908 | `getUnifiedAppData` |

**Fix:** Delete all six old functions.

---

### B-11 🟠 `getTeamPriorityTasks` (Non-Optimized) Shows ALL Users — No Hierarchy Filter
**Lines:** 4520–4653  
**Problem:** The non-optimized `getTeamPriorityTasks()` reads all delegation/WR/checklist/FMS data with **no team membership filter**. An Admin would see every employee in the company's pending tasks, not just their hierarchy team. This is a **data visibility / security issue**.

**Fix:** Delete this function (covered by B-10). The `_Optimized` version correctly accepts and uses the `teamMembers` parameter.

---

### B-12 🟠 `getFmsStatusData_Optimized` Treats Admin as Super Admin for FMS Visibility
**Line:** 4812  
**Problem:**
```javascript
const isSuperAdmin = (userRole === 'Super Admin' || userRole === 'Admin');
```
This causes Admin to see **all FMS tasks** in the dashboard FMS chart, not just their hierarchy team. All other modules (Delegation, WR, Checklist) restrict Admin to their team only — FMS is inconsistent.

**Fix:**
```javascript
const isSuperAdmin = (userRole === 'Super Admin');
// Then use teamMembers for Admin just like other modules
```

---

### B-13 🟡 `DELEGATED_COLS` Missing Index 10 in Constant Definition
**Line:** 19  
**Problem:** The constant `DELEGATED_COLS` jumps from index 9 (`REVISION_DATE`) to index 11 (`ATTACHMENT_BY_DOER`), skipping index 10 which is "Revision Remarks" in the sheet header. The constant `ATTACHMENT_BY_DOER: 11` is correct per the header, but there's no constant for column 10 (`Revision Remarks`). This means revision remarks can never be accessed by column constant — any code needing it uses a hardcoded `11` or accesses the wrong column.

**Fix:** Add:
```javascript
const DELEGATED_COLS = { ..., REVISION_DATE: 9, REVISION_REMARKS: 10, ATTACHMENT_BY_DOER: 11, ... };
```

---

### B-14 🟡 `parseDate_` Fallback Uses `new Date(string)` 
**Line:** 898  
**Problem:**
```javascript
const fallback = new Date(dateStr);
if (!isNaN(fallback.getTime())) return fallback;
```
The catch-all fallback at the end of `parseDate_` uses JavaScript's `new Date(string)` which is timezone-ambiguous and can swap MM/DD in some runtime environments. All the careful regex-based parsing above it can be bypassed if a date string matches JavaScript's native parser with wrong interpretation.

**Fix:** If all formats above fail, return `null` instead of falling back to `new Date(string)`:
```javascript
// Remove the fallback:
// const fallback = new Date(dateStr);
// if (!isNaN(fallback.getTime())) return fallback;
return null; // Safe: force proper format upstream
```

---

### B-15 🟡 `getEmployeePerformanceReport` Score Formula Different from `getMisData`
**Lines:** 4496–4498  
**Problem:** Two separate performance score calculations exist and produce different numbers:

`getMisData` uses: `-(pending/total * 100)` style negative scoring  
`getEmployeePerformanceReport` uses: `(onTimePct * 0.8) - (reworks * 2) - avgDelay` style positive scoring

Reports tab and MIS tab will show **different scores for the same employee**, causing user confusion.

**Fix:** Standardize to one scoring formula. Use `getMisData`'s KPI scoring throughout, or document clearly which formula each screen uses.

---

### B-16 🟡 `getAllAppDataRaw` Cache Serializes Dates as Strings — Breaks `instanceof Date` Checks
**Lines:** 4731–4763  
**Problem:** When data is cached via `CacheService.put(key, JSON.stringify(rawData))`, all `Date` objects become strings. When retrieved, checks like `actDate instanceof Date` fail — only the string fallback `actDate.trim() !== ''` saves it.

In `calculateMetricsGeneric` (line 1020):
```javascript
let isCompleted = (completionDate instanceof Date || (typeof completionDate === 'string' && completionDate.trim() !== ''));
```
The string fallback works, but this is fragile — any future code that only checks `instanceof Date` will break with cached data.

**Fix:** In `getAllAppDataRaw`, convert dates to ISO strings consistently using `getUnifiedAppData`'s `cleanData()` helper (line 2169), and document that all date comparisons should use `parseDate_()` not `instanceof Date` when working with potentially-cached data.

---

## SECTION C — CROSS-FILE ISSUES

---

### C-1 🔴 `getWorkRequestsForApproval` Admin Visibility Gap
**Problem:** When an Admin approves Work Requests, `getTasksForApproval` calls `getWorkRequestsForApproval(userName, userRole, project)`. This function only shows WR where `requestedBy === currentAdmin` OR if Super Admin. An Admin can only approve work requests they personally created. If Employee A creates a WR for Employee B, and their Admin (C) is neither A nor B — Admin C **cannot see or approve it** even though it's their team's work.

**Fix:** Change the WR approval visibility logic to: show requests where **either the requester OR the doer is in the Admin's team**:
```javascript
const isViewerAuthorized = isSuperAdmin || 
    teamEmployees.includes(requestedBy) || 
    teamEmployees.includes(requestFor);
```

---

### C-2 🟠 Password Stored as Plain Text
**Lines:** Code.gs line 166 (`storedPassword == password`)  
**Problem:** Login compares plain text password directly from the Google Sheet. Anyone with Sheet access can see all passwords.

**Fix:** At minimum, hash passwords with `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password)` before storing and comparing. Better: use Google OAuth for authentication.

---

### C-3 🟠 No Backend Role Verification on Write Operations
**Problem:** Functions like `saveTask`, `saveWorkRequest`, `saveChecklistTask`, `upsertUser`, `deleteUser`, `saveHierarchy` accept any call without checking if the calling user has the right role. The frontend hides buttons by role, but this is UI-only security. Anyone who can make a `google.script.run` call can bypass role checks.

**Fix:** Each write function should verify the caller's role:
```javascript
function saveTask(tasks, userName) {
    const userRecord = findUserInSheets(userName, ADMIN_COLS.USER);
    const role = userRecord?.data[ADMIN_COLS.ROLE];
    if (!['Admin', 'Super Admin'].includes(role)) return 'Unauthorized';
    ...
}
```

---

### C-4 🟡 Checklist Frequency Logic Missing in `saveChecklistTask`
**Problem:** `saveChecklistTask` saves the master row to `CHECKLIST WORK` but does NOT auto-generate planned rows in `CHECKLIST TASK`. The frontend comment at line 4859 confirms this gap. According to the business logic, when a checklist is assigned with a frequency (Daily, Weekly, etc.), the system should auto-create future planned rows in `CHECKLIST TASK`.

Currently, planned rows must be created manually or through a separate process not visible in the code.

**Fix:** After saving to `CHECKLIST WORK`, add a `generateChecklistRows(taskId, startDate, frequency, employeeName, ...)` function that creates rows in `CHECKLIST TASK` for the upcoming periods.

---

### C-5 🟡 `silentReload` in Code.gs References `getUnifiedAppData` 
**Line:** 4930 (Code.gs)  
Already covered in B-3 — this is frontend code in the wrong file.

---

## SECTION D — SUMMARY TABLE

| # | Severity | File | Issue | Lines |
|---|---|---|---|---|
| A-1 | 🟢 | Frontend | Branding "TaskDone" not "TaskEasy" | 7, 1513, 1557 |
| A-2 | 🔴 | Frontend | Duplicate form submit event bindings | 2543–2548 |
| A-3 | 🔴 | Frontend | Duplicate `formatAttachments`/`viewAttachments` override | 5572–5659 |
| A-4 | 🟠 | Frontend | `isDateInPeriod` missing `last_week` case | 5120–5143 |
| A-5 | 🟠 | Frontend | FMS not handled in `handleDashboardTaskComplete` | 3661–3665 |
| A-6 | 🟠 | Frontend | WR + FMS have no Done button in priority task widget | 3607–3659 |
| A-7 | 🔴 | Frontend | Broken canvas IDs — dead chart code | 2335–2375, 3439–3508 |
| A-8 | 🔴 | Frontend | MIS filter ID mismatch (`#mis-user-filter` vs `#mis-assigned-to-filter`) | 4258 |
| A-9 | 🟠 | Frontend | Arrow function `this` bug in MIS close handler | 4284–4287 |
| A-10 | 🔴 | Frontend | FMS tab reload crashes on `undefined.substring()` | 5520–5528 |
| A-11 | 🟡 | Frontend | `stateSave: true` causes stale DataTable state between sessions | 5696 |
| A-12 | 🟡 | Frontend | `checklist-start-time` value not sent combined with date to backend | ~4859 |
| A-13 | 🟡 | Frontend | Excel and PDF export click handlers registered twice | 6543–6591, 6803–6960 |
| A-14 | 🟡 | Frontend | `loadWorkRequestForm` uses nonexistent static IDs `#requestFor`, `#requestProject` | 6264–6265 |
| B-1 | 🔴 | Backend | `cleanStr` defined 3 times | 2801, 4383, 4516 |
| B-2 | 🔴 | Backend | `getDateRangeYmd` defined twice; second has mutation bug | 1969–2030, 4329–4379 |
| B-3 | 🔴 | Backend | Frontend JS `silentReload` accidentally placed in Code.gs | 4909–4931 |
| B-4 | 🔴 | Backend | `getNotificationCounts` calls `getWorkRequestsForApproval` with wrong args | 215 |
| B-5 | 🔴 | Backend | `updateStatusWrapper` hardcodes rating = '5' for all approvals | 4702 |
| B-6 | 🟠 | Backend | Admin won't see own FMS tasks (uses `getTeamMembers` not `getTeamMembersWithManager`) | 4113 |
| B-7 | 🟠 | Backend | `getChecklistTasksForApproval` checks wrong status ('completed' not 'send for approval') | 1232 |
| B-8 | 🟢 | Backend | `doGet` title "Task Management Dashboard" not "TaskEasy" | 479 |
| B-9 | 🟡 | Backend | `saveMisWeeklySnapshot` doesn't save `nextWeekTarget` | 4198–4263 |
| B-10 | 🟡 | Backend | 6 dead/duplicate old functions cluttering codebase | Various |
| B-11 | 🟠 | Backend | Old `getTeamPriorityTasks` shows all users — no team filter | 4520–4653 |
| B-12 | 🟠 | Backend | `getFmsStatusData_Optimized` treats Admin as Super Admin for FMS visibility | 4812 |
| B-13 | 🟡 | Backend | `DELEGATED_COLS` missing constant for index 10 (Revision Remarks) | 19 |
| B-14 | 🟡 | Backend | `parseDate_` fallback uses `new Date(string)` — timezone ambiguous | 898 |
| B-15 | 🟡 | Backend | Performance score formula differs between MIS tab and Reports tab | 4496–4498 |
| B-16 | 🟡 | Backend | Cached data converts Dates to strings — breaks `instanceof Date` checks | 4731–4763 |
| C-1 | 🔴 | Both | Admin cannot approve WR created by team members (only own WR) | — |
| C-2 | 🟠 | Both | Passwords stored and compared as plain text | Code.gs 166 |
| C-3 | 🟠 | Both | No backend role verification on write functions | Various |
| C-4 | 🟡 | Both | Checklist frequency rows not auto-generated on assignment | Code.gs ~3301 |
| C-5 | 🟡 | Both | (Duplicate of B-3) | — |

---

## SECTION E — PRIORITY FIX ORDER

### Fix Immediately (App-Breaking):
1. **A-8** — MIS filter ID mismatch (drill-down always broken)
2. **B-4** — Wrong args to `getWorkRequestsForApproval` in notifications
3. **A-10** — FMS tab crash on reload
4. **C-1** — Admin cannot approve team WR
5. **B-5** — Hardcoded rating '5' on all approvals
6. **A-2** — Duplicate event listeners on forms
7. **A-3** — Duplicate `formatAttachments` (wrong version active)
8. **B-2** — Duplicate `getDateRangeYmd` with mutation bug

### Fix Next (Workflow Logic):
9. **B-7** — Checklist approval flow missing/wrong
10. **A-4** — `last_week` filter not working client-side
11. **A-5 / A-6** — FMS + WR done buttons in dashboard
12. **B-6** — Admin misses own FMS tasks
13. **B-3** — Delete `silentReload` from Code.gs
14. **B-11** — Delete old `getTeamPriorityTasks`
15. **B-12** — Admin FMS visibility should respect hierarchy

### Fix Soon (Quality):
16. **A-7** — Remove dead canvas chart code
17. **A-9** — Arrow function `this` bug
18. **B-1** — Remove 2 of 3 `cleanStr` duplicates
19. **B-10** — Delete 6 dead old functions
20. **A-13** — Remove duplicate export handlers
21. **A-14** — Remove broken static ID calls in WR form

### Fix When Time Permits:
22. **C-2** — Hash passwords
23. **C-3** — Add backend role guards
24. **C-4** — Auto-generate checklist frequency rows
25. **A-1 / B-8** — Fix "TaskDone" branding
26. **B-14** — Remove `new Date()` fallback in `parseDate_`
27. **B-15** — Standardize scoring formula
28. **A-11** — Disable DataTable `stateSave`

---

*Report generated by full line-by-line audit of both source files.*

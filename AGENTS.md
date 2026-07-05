## Imported Claude Cowork project instructions

Captain, I read the screenshots + `Index html Task app.txt` + `Task app Code.gs`. Your app is basically a **role-based task management + approval + MIS performance system** built on Google Apps Script + Google Sheets. Here is the clean **business logic / system logic** you should follow 👇

## TaskEasy App Logic

### 1. Main Roles

| Role            | Access                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **Super Admin** | Full access: dashboard, all users, projects, hierarchy, team tasks, MIS, reports, approvals, FMS  |
| **Admin**       | Team dashboard, assign tasks, create requests, approve/rework team submissions, MIS, reports, FMS |
| **Employee**    | Own dashboard, assigned tasks, checklists, work requests, FMS tasks, submit work for approval     |

Frontend already controls role-based navigation after login and shows/hides modules based on role. It also stores user session/cache for faster loading. 

---

## 2. Core Modules Logic

### A. Login & Session Logic

```text
User enters User ID + Password
↓
checkCredentials(userId, password)
↓
Search user in Admin Detail + Employe Detail sheets
↓
If password matches and status = Active
↓
Return userName + role
↓
Frontend initializes app
↓
Load dashboard + sidebar based on role
```

Important rule:

```text
Inactive user must not login.
Only Active users should appear in dropdowns.
```

---

### B. Dashboard Logic

Dashboard should show:

```text
Delegation
Work Request
Checklist
FMS
```

Each card has:

```text
Total
Done
Pending
Delayed
```

For **Admin/Super Admin**:

```text
Show Team View by default
Allow My View toggle
Show project-wise status
Show FMS-wise task status
Show task trend chart
Show personal priority tasks
Show critical team tasks
```

For **Employee**:

```text
Show only own task summary
Show own priority tasks
Show all pending work table
```

Dashboard routing already lazy-loads the correct module view like delegation, checklist, work request, FMS, MIS, reports, hierarchy, and user management. 

---

## 3. Delegation Logic

### Assign Task Flow

```text
Admin/Super Admin selects:
- Delegate To
- Project
- Task Detail
- Date
- Time
- Priority
- Attachment optional

Click Send All Tasks
↓
saveTask(tasks, currentUser)
↓
Generate Task ID
↓
Save in DELEGATED WORK sheet
↓
Status = Pending
↓
Email notification sent to doer
```

### Employee Completion Flow

```text
Employee opens Pending Delegation
↓
Clicks Done
↓
Adds remarks + attachments
↓
submitTaskForApproval()
↓
Status becomes Send for Approval / submitted state
↓
Task appears in Approve/Review for admin
```

### Approval Flow

```text
Admin reviews task
↓
If correct → Completed
If incorrect → Rework
```

Status cycle:

```text
Pending → Send for Approval → Completed
Pending → Send for Approval → Rework → Pending/Re-submitted → Completed
```

---

## 4. Work Request Logic

### Create Request Flow

```text
Requester selects:
- Request For / Doer
- Project
- Description
- Deadline Date
- Deadline Time
- Attachments optional

Submit
↓
saveWorkRequest()
↓
Generate Request ID
↓
Save in WORK_REQUESTS sheet
↓
Status = Pending
```

### Doer Flow

```text
Doer sees request in Pending For Me
↓
Completes work
↓
Adds remarks + attachment proof
↓
Clicks Done
↓
Status = Send for Approval
↓
Requester/Admin gets approval item
```

### Approval Flow

```text
Approver checks proof
↓
Approve → Completed
Rework → Rework + completion date cleared
```

Final status cycle:

```text
Pending → Send for Approval → Completed
Pending → Send for Approval → Rework → Send for Approval → Completed
```

---

## 5. Checklist Logic

### Assign Checklist Flow

Admin assigns checklist with:

```text
Employee
Project
Task Detail
Frequency
Start Date
Start Time
Attachment Required?
```

Frequency options:

```text
Daily
Weekly
Fortnightly
Monthly
Half Yearly
Yearly
One Time
```

Logic:

```text
Checklist Master saved in CHECKLIST WORK
↓
System creates planned checklist rows in CHECKLIST TASK
↓
Employee sees planned checklist in pending list
```

### Checklist Completion

```text
Employee selects checklist task
↓
Clicks Done
↓
Adds remarks + attachment if required
↓
Actual Date saved
↓
Status = Completed / Approved depending approval logic
```

Bulk logic:

```text
Employee can select multiple checklist tasks
↓
Mark Selected Done
↓
Same remarks applied to all selected tasks
```

---

## 6. Approve / Review Logic

This module has two tabs:

```text
New Submissions
Rework Submissions
```

It combines:

```text
Delegation submissions
Work Request submissions
Checklist submissions
```

Approval action:

```text
Approve → updateStatusWrapper(type, id, Completed, remarks)
Rework → updateStatusWrapper(type, id, Rework, remarks)
```

Backend routes status update based on type:

```text
Delegation → updateTaskStatus()
Work Request → updateWorkRequestStatus()
Checklist → updateChecklistStatus()
```

---

## 7. FMS System Logic

FMS is based on the `FMS` sheet.

Main columns:

```text
Person ID
What
When
How
Who
FMS Name
Task Name
Step No
Planned Date
Actual Date
Form Link
Delay Days
On Time Status
```

Role-based FMS tabs:

For Admin/Super Admin:

```text
My Pending Tasks
My Completed Tasks
Team Pending Tasks
Team Completed Tasks
```

For Employee:

```text
My Pending FMS
Completed History
```

The frontend already defines different FMS tabs based on role. 

FMS completion flow:

```text
User clicks Done
↓
markFmsTaskDone(rowId)
↓
Actual Date = today
↓
Compare Planned Date vs Actual Date
↓
Calculate Delay Days
↓
Set On Time Status = On Time / Late
```

---

## 8. MIS Logic

MIS calculates employee-wise performance from:

```text
Delegation
Work Request
Checklist
FMS
```

MIS KPIs:

```text
Total Tasks
Completed
Pending
On Time
Late
Delay Days
Reworks
Score
```

Score logic:

```text
Perfect score = 0
Delay / not done / rework creates negative score
More negative = worse performance
```

MIS cards show:

```text
Avg. Work Not Done
Avg. Work Delayed
Avg. Checklist Pending
Total Employees
```

Employee MIS card shows:

```text
Completed
Pending
On Time %
Issues / Reworks
Avg Score
Last Week Planned Target Score
```

Weekly score snapshot:

```text
Admin clicks Update
↓
Enter next week target score
↓
saveUserWeeklyScore()
↓
Save current KPI snapshot in MIS History
```

---

## 9. Reports Logic

Reports should include:

```text
Performance
Delegation
Work Request
Checklist
Project
```

Filters:

```text
User
Team
Project
Status
Date Range
Today
This Week
Last Week
This Month
Last Month
```

Each report table should support:

```text
Search
Pagination
Sorting
Excel Export
PDF Export
```

Your frontend already has DataTable export logic with Excel/PDF buttons and performance optimizations like `deferRender`, `processing`, and `autoWidth: false`. 

---

## 10. Admin Settings Logic

### Manage Users

Super Admin can:

```text
Add User
Edit User
Delete User
Set Role
Set Status Active / In-active
```

User data goes into:

```text
Admin Detail sheet → Admin / Super Admin
Employe Detail sheet → Employee
```

### Manage Projects

Logic:

```text
Add Project
Edit Project
Activate / Deactivate Project
Only active projects appear in task dropdowns
```

---

## 11. Set Hierarchy Logic

Hierarchy decides team visibility.

Flow:

```text
Super Admin creates group
↓
Select Admin
↓
Assign Employees under that Admin
↓
Save in Hierarchy Setup sheet
```

Access rule:

```text
Admin sees only assigned employees
Super Admin sees everyone
Employee sees only own data
```

---

## 12. Notification Logic

Sidebar red dot should appear when:

```text
Approval pending
Delegation pending
Checklist pending
Work Request pending
```

Logic:

```text
getNotificationCounts(userName, role)
↓
Count pending task types
↓
Frontend updates sidebar dots
```

---

# Final Clean Business Flow

```text
Login
↓
Role Detection
↓
Load User-Specific Dashboard
↓
User performs module action:

1. Admin assigns Delegation / Checklist / Work Request
2. Employee receives pending task
3. Employee completes task with remarks/proof
4. Task goes to Approve/Review
5. Admin approves or sends rework
6. Dashboard + MIS + Reports update automatically
7. Weekly MIS snapshot stores performance history
```

---

## Strong Implementation Logic Prompt

Use this prompt for rebuilding or refactoring the app:

```text
Build a role-based TaskEasy workflow management system using the existing Google Apps Script and HTML logic.

The system must support three roles: Super Admin, Admin, and Employee.

Super Admin has full access to users, projects, hierarchy, dashboard, reports, MIS, FMS, approvals, delegations, checklists, and work requests.

Admin can manage assigned team tasks, create delegation tasks, assign checklists, create work requests, approve/rework submissions, view team dashboard, MIS, reports, and FMS.

Employee can view only own dashboard, pending delegation tasks, checklist tasks, work requests, FMS tasks, submit completion proof, track approval status, and view own history.

Core modules:
1. Login and role-based session
2. Dashboard with Total, Done, Pending, Delayed metrics
3. Delegation task assignment and approval flow
4. Work Request creation, completion, approval, and rework flow
5. Checklist assignment with frequency logic
6. FMS task tracking with planned date, actual date, delay days, and on-time status
7. Approve/Review module with New Submission and Rework Submission tabs
8. MIS module with employee performance score, delay, pending, rework, and weekly target snapshot
9. Reports with filters, search, pagination, Excel export, and PDF export
10. Admin Settings for users and projects
11. Set Hierarchy for Admin-to-Employee mapping
12. Sidebar notification dots for pending actions

Every task must follow a clear status cycle:
Pending → Send for Approval → Completed
Pending → Send for Approval → Rework → Send for Approval → Completed

Use Google Sheets as database:
- Admin Detail
- Employe Detail
- Hierarchy Setup
- Projects
- DELEGATED WORK
- WORK_REQUESTS
- CHECKLIST WORK
- CHECKLIST TASK
- FMS
- MIS History

Use strict role-based data filtering:
- Super Admin sees all data
- Admin sees only hierarchy team data
- Employee sees only own data

Use safe date handling:
- Frontend sends YYYY-MM-DD + HH:mm
- Backend parses manually
- Never use ambiguous MM/DD or DD/MM direct parsing

Use Drive upload logic for attachments.
Use cache for fast dashboard loading.
Clear cache after create/update/delete operations.
```

This is the proper logic base for your TaskEasy app.
Captain, here’s the **deep module-by-module + button-by-button working logic** for your TaskEasy app. I checked the uploaded HTML/AppScript structure and screenshots. Your frontend uses Tailwind, jQuery, DataTables, SweetAlert2, Select2, XLSX, jsPDF, Chart.js, confetti, and DateDropper, so your app is already a full Google-Sheet-backed workflow dashboard, not just a simple task form. 

---

# 1. Full App Architecture Logic

```text
Login Page
↓
checkCredentials()
↓
Role Detection
↓
Load App Shell
↓
Sidebar + Header + Dashboard
↓
Lazy-load module on sidebar click
↓
Module action calls google.script.run backend
↓
Backend updates Google Sheet
↓
Dashboard / MIS / Reports / Notifications refresh
```

Main sheets used:

```text
Admin Detail
Employe Detail
Hierarchy Setup
Projects
DELEGATED WORK
WORK_REQUESTS
CHECKLIST WORK
CHECKLIST TASK
FMS
MIS History
```

Core app rule:

```text
Super Admin = sees all
Admin = sees hierarchy/team data
Employee = sees own data only
```

---

# 2. Global Buttons & Common Logic

## Header Buttons

| Button                   | Current Purpose         | Working Logic                                                                                                                     |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **☰ Sidebar Toggle**     | Open/close sidebar      | Desktop: collapse sidebar. Mobile: open sidebar + overlay.                                                                        |
| **🌙 Theme Toggle**      | Light/dark mode         | Toggles `html.dark`, saves theme in `localStorage`. No data reload needed.                                                        |
| **🔄 Refresh**           | Reload current data     | Clears `SUPER_APP_CACHE`, fetches fresh server data, reloads active module.                                                       |
| **Profile Icon / Name**  | Show user dropdown      | Opens small dropdown with signed-in user name.                                                                                    |
| **Logout**               | End session             | Clears `td_user`, `td_role`, `SUPER_APP_CACHE`, hides app, shows login.                                                           |
| **⬆ Back To Top**        | Scroll main content top | Appears after scrolling; scrolls `#main-content` to top.                                                                          |
| **Chat Floating Button** | Help/support UI         | Seen in screenshots. Should open help/chat/support modal. If not implemented, connect it to support ticket or WhatsApp/chat link. |

Login, session storage, logout, and sidebar notification behavior are directly handled in the uploaded frontend logic. 

---

# 3. Login Module Logic

## Login Form Buttons

| Element                  | Logic                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| **User ID input**        | Required. Sent to backend `checkCredentials(userId, password)`.                        |
| **Password input**       | Required. Currently plain password comparison from sheet.                              |
| **Remember Me checkbox** | If checked, saves user/role in `localStorage`; else saves in `sessionStorage`.         |
| **LOG IN button**        | Calls backend login function. If valid, initializes app. If invalid, SweetAlert error. |

## Login Working Flow

```text
User enters User ID + Password
↓
Frontend calls checkCredentials()
↓
Backend searches Admin Detail + Employe Detail
↓
Match User ID + Password
↓
Check Status = Active
↓
Return userName + role
↓
initializeApp(userName, role)
↓
Load dashboard + role-based sidebar
```

## Important Fix Needed

Your login currently appears to use plain text passwords in Google Sheets. Better logic:

```text
Store hashed password
Compare hash on login
Never expose password in frontend/admin tables
```

---

# 4. Sidebar Module Buttons

| Sidebar Button     | View ID                | Role Visibility                             | Working Logic                                           |
| ------------------ | ---------------------- | ------------------------------------------- | ------------------------------------------------------- |
| **Dashboard**      | `dashboard-view`       | All                                         | Shows summary metrics, filters, charts, priority tasks. |
| **Checklists**     | `checklist-view`       | All                                         | Admin assigns checklist; employee completes checklist.  |
| **Delegation**     | `delegation-view`      | All                                         | Admin delegates tasks; employee completes.              |
| **Work Request**   | `work-request-view`    | All                                         | User creates request for another user.                  |
| **FMS System**     | `fms-view`             | All                                         | Shows FMS pending/completed tasks.                      |
| **Approve/Review** | `approve-task-view`    | Admin/Super Admin; employee as Track Status | Handles approve/rework and employee submissions.        |
| **MIS**            | `mis-view`             | Admin/Super Admin                           | Performance analytics.                                  |
| **Reports**        | `reports-view`         | Admin/Super Admin                           | Detailed exportable reports.                            |
| **Admin Settings** | `user-management-view` | Super Admin                                 | Manage users/projects/settings.                         |
| **Set Hierarchy**  | `hierarchy-view`       | Super Admin                                 | Map Admin → Employees.                                  |

Your frontend uses `setView()` to lazy-load each module only when clicked, which is good for speed. 

---

# 5. Common Table Buttons

Every DataTable should follow this logic:

| Button / Control       | Logic                                                         |
| ---------------------- | ------------------------------------------------------------- |
| **Show entries**       | Controls rows per page: 10 / 25 / 50 / 100.                   |
| **Search**             | Client-side search inside loaded table data.                  |
| **Column sort arrows** | Sort table by selected column.                                |
| **Previous / Next**    | DataTable pagination.                                         |
| **Excel**              | Uses XLSX export.                                             |
| **PDF**                | Uses jsPDF + autoTable export.                                |
| **Status badge**       | Shows Active, Pending, Completed, Rework, Overdue, Late, etc. |
| **Empty state**        | Shows “No Data Available” instead of blank UI.                |

Your `initializeDataTable()` already creates Excel/PDF buttons and uses performance settings like `deferRender`, `processing`, and `autoWidth: false`. 

---

# 6. Common Filter Bar Logic

Used in Dashboard, MIS, Reports, Team views.

| Filter Button         | Logic                                                        |
| --------------------- | ------------------------------------------------------------ |
| **X Clear**           | Reset dropdowns, dates, and period to `All`.                 |
| **All**               | No date filter.                                              |
| **Today**             | Filter only today’s records.                                 |
| **This Week**         | Monday/Sunday or current week range depending backend logic. |
| **Last Week**         | Previous week range. MIS screenshot uses this heavily.       |
| **This Month**        | Current month records.                                       |
| **Last Month**        | Previous month records.                                      |
| **Date From / To**    | Custom range.                                                |
| **Employee dropdown** | Filter by selected employee.                                 |
| **Project dropdown**  | Filter by project.                                           |
| **Status dropdown**   | Pending / Completed / Rework / Late.                         |
| **From / To filters** | Used in approval/team views.                                 |

Frontend `collectFilters()` builds a filter object containing period, dateFrom, dateTo, project, status, employee, and delegatedBy. 

---

# 7. Dashboard Module Logic

## Dashboard Buttons

| Button / Card                      | Working Logic                                               |
| ---------------------------------- | ----------------------------------------------------------- |
| **Team View**                      | Shows entire team metrics. Default for Admin/Super Admin.   |
| **My View**                        | Shows only logged-in user metrics.                          |
| **Metric card: Total**             | Opens drill-down table for all tasks in that module.        |
| **Metric card: Done**              | Opens completed task list.                                  |
| **Metric card: Pending**           | Opens pending task list.                                    |
| **Metric card: Delayed**           | Opens delayed/late task list.                               |
| **Critical Team Task filter: All** | Shows all overdue/pending team tasks.                       |
| **Work Req filter**                | Shows only work request critical tasks.                     |
| **Checklist filter**               | Shows checklist critical tasks.                             |
| **FMS filter**                     | Shows FMS critical tasks.                                   |
| **Delegation filter**              | Shows delegation critical tasks.                            |
| **Close drill-down X**             | Hides detail table and shows dashboard lower section again. |

## Dashboard Metrics

For each module:

```text
Total = Done + Pending
Done = Completed tasks
Pending = Not completed tasks
Delayed = Completed late OR pending after due date
```

Dashboard modules:

```text
Delegation
Work Request
Checklist
FMS
```

## Dashboard Flow

```text
Dashboard loads
↓
Fetch metrics from getDashboardPageData()
↓
Render 4 cards
↓
Render project-wise status
↓
Render FMS-wise task status
↓
Render trend chart
↓
Render personal priority tasks
↓
Render critical team tasks
```

---

# 8. Delegation Module Logic

## Admin Delegation Screen

Buttons:

| Button                      | Working Logic                                                            |
| --------------------------- | ------------------------------------------------------------------------ |
| **Add Task**                | Adds another task card dynamically.                                      |
| **Remove X**                | Removes one task card. At least one row must remain.                     |
| **Send All Tasks**          | Validates users/project/task/date/time/priority/files, then saves tasks. |
| **Attachment Choose Files** | Converts files to base64 and sends to backend.                           |
| **My Pending Tasks tab**    | Shows tasks assigned to current user.                                    |
| **Team Delegations tab**    | Shows tasks assigned to team members.                                    |
| **Done button**             | Employee/Admin marks assigned task done.                                 |
| **Excel/PDF**               | Export delegation table.                                                 |

## Delegation Save Logic

```text
Admin selects doer(s)
↓
Select project
↓
Enter task detail
↓
Set date/time
↓
Set priority
↓
Attach files optional
↓
Click Send All Tasks
↓
saveTask(tasks, currentUser)
↓
Generate new task ID
↓
Save row in DELEGATED WORK
↓
Status = Pending
↓
Send email notification
```

## Delegation Sheet Columns Logic

```text
Timestamp
Task ID
Delegated By
Delegated To
Description
Project
Target Date
Attachment
Task Status
Revision Date
Doer Attachment
Doer Remarks
Action Date
Rework Remark
Rating
Final Remarks
Approval Date
Delay
On Time Status
Priority
Email
```

## Delegation Status Flow — Ideal

```text
Pending
↓
Send for Approval
↓
Completed
```

Rework flow:

```text
Pending
↓
Send for Approval
↓
Rework
↓
Pending / Re-submitted
↓
Completed
```

## Important Logic Conflict Found

In your current backend, the delegation employee submit function appears to directly mark the delegation as **Completed**, set action date, set approval date, and update delay status. That means it can bypass the Approve/Review screen.

Correct it like this:

```text
Employee clicks Done
↓
Backend should set status = Send for Approval
↓
Save doer remarks + proof
↓
Admin sees task in Approve/Review
↓
Admin approves → Completed
Admin reworks → Rework
```

This is one of the biggest workflow fixes.

---

# 9. Work Request Module Logic

## Create Request Buttons

| Button                      | Working Logic                             |
| --------------------------- | ----------------------------------------- |
| **Add Request**             | Adds another work request form card.      |
| **Remove X**                | Removes one request card.                 |
| **Submit All**              | Sends all work requests to backend.       |
| **Choose Files**            | Uploads request attachments.              |
| **My Pending Requests tab** | Shows requests created by current user.   |
| **Team Requests tab**       | Admin/Super Admin sees team requests.     |
| **Done button**             | Doer completes request and submits proof. |
| **Approve button**          | Requester/Admin accepts work.             |
| **Rework button**           | Sends request back to doer.               |

## Work Request Create Flow

```text
Requester selects doer
↓
Select project
↓
Enter description
↓
Set deadline date/time
↓
Attach files optional
↓
Submit All
↓
saveWorkRequest()
↓
Generate Request ID
↓
Save in WORK_REQUESTS
↓
Status = Pending
↓
Send notification/email
```

## Work Request Completion Flow

```text
Doer opens Pending For Me
↓
Clicks Done
↓
Adds remarks + attachment proof
↓
Backend status = Send for Approval
↓
Requester/Admin sees in Approve/Review
```

## Work Request Approval Flow

```text
Approve → Status = Completed
Rework → Status = Rework, completion date cleared
```

## Work Request Status Cycle

```text
Pending → Send for Approval → Completed
Pending → Send for Approval → Rework → Send for Approval → Completed
```

This module’s approve/rework buttons are already represented in the frontend approval logic. 

---

# 10. Checklist Module Logic

## Assign Checklist Buttons

| Button                   | Working Logic                                    |
| ------------------------ | ------------------------------------------------ |
| **Add Task**             | Adds checklist item card.                        |
| **Remove X**             | Removes one checklist item.                      |
| **Assign All**           | Saves checklist master task(s).                  |
| **Attachment Required?** | Marks task as requiring proof during completion. |
| **Frequency dropdown**   | Controls checklist recurrence.                   |
| **Start Date**           | First planned checklist date.                    |
| **Start Time**           | Should be used in planned checklist rows.        |
| **Project dropdown**     | Links checklist to project.                      |
| **Employee select**      | Assign checklist to one or multiple users.       |

## Checklist Frequency Options

```text
Daily
Weekly
Fortnightly
Monthly
Quarterly
Half Yearly
Yearly
One Time
```

## Checklist Save Flow

```text
Admin selects employee(s)
↓
Select project
↓
Add checklist task detail
↓
Choose frequency
↓
Choose start date/time
↓
Mark attachment required if needed
↓
Assign All
↓
saveChecklistTask()
↓
Save master row in CHECKLIST WORK
↓
Generate planned rows in CHECKLIST TASK
```

## Checklist Employee Buttons

| Button                  | Logic                                        |
| ----------------------- | -------------------------------------------- |
| **Done**                | Completes one checklist task.                |
| **Select checkbox**     | Select task for bulk completion.             |
| **Select All**          | Select all visible pending checklist tasks.  |
| **Mark Selected Done**  | Bulk-completes selected checklist tasks.     |
| **Completed Tasks tab** | Shows submitted/completed checklist history. |
| **My KRA Master**       | Shows recurring checklist master/KRA list.   |

## Checklist Completion Flow

```text
Employee clicks Done
↓
Add remarks
↓
Upload proof if required
↓
Actual Date = now
↓
Approval Status = Completed
↓
Calculate on-time / late
```

## Important Fix Needed

The frontend includes **Start Time**, but the code comment says checklist backend/frequency logic may still hardcode a time. Your final logic should be:

```text
Start Date + Start Time
↓
Generate planned datetime exactly
↓
Do not hardcode 18:00 or 09:00
```

The checklist UI shows frequency, start date, start time, and attachment-required logic in the uploaded HTML. 

---

# 11. Approve / Review Module Logic

## Tabs

```text
New Submissions
Rework Submissions
```

Employee version:

```text
My Approvals
Delegations Sent
Checklists Sent
WR Sent
```

## Approval Buttons

| Button                    | Working Logic                            |
| ------------------------- | ---------------------------------------- |
| **Approve / Green Check** | Status becomes Completed.                |
| **Rework / Red Rotate**   | Status becomes Rework and remarks saved. |
| **Excel**                 | Export approval table.                   |
| **PDF**                   | Export approval table.                   |

## Approval Data Source

Approval view combines:

```text
Delegations where status = Send for Approval
Work Requests where status = Send for Approval
Checklist approvals if enabled
```

## Correct Approval Logic

```text
Admin opens Approve/Review
↓
System fetches pending submissions
↓
Admin checks remarks + proof
↓
Approve:
    status = Completed
    approval date = now
    final remarks saved
    delay/on-time updated

Rework:
    status = Rework
    rework remark saved
    completion/approval date cleared if needed
```

## Type Routing Logic

```text
Delegation → updateTaskStatus()
Work Request → updateWorkRequestStatus()
Checklist → updateChecklistStatus()
```

---

# 12. FMS System Logic

## FMS Screen Buttons

From screenshots, FMS has:

| Button               | Expected Working Logic                              |
| -------------------- | --------------------------------------------------- |
| **Import Sheet**     | Import/refresh FMS rows from Google Sheet/template. |
| **Analytics**        | Open FMS analytics dashboard.                       |
| **Generate with AI** | Generate FMS flow draft from prompt/sheet data.     |
| **Flow Map**         | Open visual flow map for a FMS task.                |
| **Mark / Edit icon** | Open/edit FMS form or row.                          |
| **Done**             | Mark FMS row completed.                             |
| **Open Form**        | Opens form link inside iframe modal.                |
| **Open in New Tab**  | Opens FMS form link in browser tab.                 |
| **Close Modal X**    | Closes iframe modal.                                |

## Important Note

I found FMS pending/completed logic in the current code, but I did **not** see complete implementation for screenshot buttons like **Import Sheet**, **Analytics**, and **Generate with AI** in the searched HTML. Treat these as UI buttons that need backend functions.

## FMS Tabs

Admin/Super Admin:

```text
My Pending Tasks
My Completed Tasks
Team Pending Tasks
Team Completed Tasks
```

Employee:

```text
My Pending FMS
Completed History
```

The frontend switches FMS tabs based on role and calls `loadFmsData()` for My/Team + Pending/Completed. 

## FMS Row Logic

```text
FMS row exists in FMS sheet
↓
Assigned To = WHO column
↓
If Actual Date empty → Pending
If Actual Date exists → Completed
```

## FMS Done Flow

```text
User clicks Done
↓
markFmsTaskDone(rowId)
↓
Check row exists
↓
Check Actual Date is empty
↓
Set Actual Date = now
↓
Compare Planned Date vs Actual Date
↓
Set Delay Days
↓
Set On Time Status = On Time / Late
```

## FMS Sheet Columns

```text
Person ID
What
When
How
Who
FMS Name
Task Name
Step No
Planned Date
Actual Date
Form Link
Delay Days
On Time Status
```

---

# 13. MIS Module Logic

## MIS Buttons

| Button                                                            | Working Logic                                    |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| **All Employees dropdown**                                        | Filter MIS by employee.                          |
| **All Projects dropdown**                                         | Filter MIS by project.                           |
| **Date range**                                                    | Filter MIS calculations by period.               |
| **All / Today / This Week / Last Week / This Month / Last Month** | Recalculate MIS for selected period.             |
| **Card View tab**                                                 | Shows employee-wise cards.                       |
| **Detailed Analysis tab**                                         | Shows MIS table.                                 |
| **Update button on employee card**                                | Save weekly target/score snapshot.               |
| **KPI row click**                                                 | Opens drill-down details causing negative score. |
| **Excel / PDF**                                                   | Export MIS table.                                |

## MIS KPI Cards

From screenshot and code logic:

```text
Avg. Work Not Done
Avg. Work Delayed
Avg. Checklist Pending
Total Employees
```

## Employee MIS Card

Shows:

```text
Employee name
Avg Score
Last Week Planned Target Score
Total
Pending
Done
Late
Category-wise table:
  Delegation
  Work Request
  Checklist
  FMS
KPI-wise score rows
```

## Score Logic

Your current MIS score is negative-style:

```text
0% = no issue / neutral
Negative % = performance issue
More negative = worse
```

Score penalties come from:

```text
Not completed as per plan
Completed late
Delay days
Rework count
Checklist pending
FMS pending/late
```

## MIS Drill-Down Logic

```text
Click KPI row
↓
getDetailedDataForUser(employee, category, filters)
↓
Show matching rows:
    Pending
    Overdue
    Late
↓
Display task ID, description, plan date, actual date, delay, status
```

## Weekly MIS Snapshot

```text
Admin clicks Update
↓
Enter target score / next week target
↓
saveUserWeeklyScore()
↓
Backend calculates current MIS
↓
Append snapshot rows to MIS History
```

---

# 14. Reports Module Logic

## Report Tabs

```text
Performance
Delegation
Work Request
Checklist
Project
```

## Report Buttons

| Button               | Working Logic                                      |
| -------------------- | -------------------------------------------------- |
| **Performance tab**  | Shows employee performance cards + detailed table. |
| **Delegation tab**   | Shows delegation report.                           |
| **Work Request tab** | Shows work request report.                         |
| **Checklist tab**    | Shows checklist report.                            |
| **Project tab**      | Shows project summary.                             |
| **Excel**            | Export current report.                             |
| **PDF**              | Export current report.                             |
| **Filters**          | Re-fetch or re-render data by selected criteria.   |

## Performance Report Logic

Columns:

```text
Employee
Total Tasks
Completed
Pending
On Time %
Avg Delay
Reworks
Score
```

## Project Report Logic

```text
Project Name
Total Tasks
Completed
Pending
Delayed
Completion Rate
Delay Rate
```

## Delegation Report Logic

```text
Task ID
Delegated By
Delegated To
Project
Description
Target Date
Status
Completed Date
Attachments
```

## Work Request Report Logic

```text
Request ID
Requested By
Request For
Project
Description
Deadline
Attachment
Status
Final Remarks
Completed Date
```

## Checklist Report Logic

```text
Task ID
User Name
Project
Plan Date
Description
Frequency
Actual Date
Remarks
Attachment
```

The report loader maps report types to projects, work requests, delegations, checklists, and performance data. 

---

# 15. Admin Settings Module Logic

## Manage Users Buttons

| Button                 | Working Logic                        |
| ---------------------- | ------------------------------------ |
| **All Roles dropdown** | Filters user table by role.          |
| **Add User**           | Opens user modal.                    |
| **Edit icon**          | Opens modal with existing user data. |
| **Delete icon**        | Confirms and deletes user.           |
| **Excel**              | Export users.                        |
| **PDF**                | Export users.                        |

## Add/Edit User Modal Fields

```text
Full Name
User ID
Email
Phone
Password
Role
Status
```

## User Save Logic

```text
Super Admin clicks Add/Edit
↓
Validate required fields
↓
If role = Admin / Super Admin
    save in Admin Detail
Else
    save in Employe Detail
↓
Clear user cache
↓
Reload user table
```

## Delete User Logic

```text
Click delete
↓
Confirm SweetAlert
↓
deleteUser(userId)
↓
Remove row from Admin Detail or Employe Detail
↓
Clear cache
↓
Reload table
```

## Manage Projects Buttons

| Button          | Logic                        |
| --------------- | ---------------------------- |
| **Add Project** | Add new project row.         |
| **Power icon**  | Toggle Active/Paused status. |
| **Delete icon** | Delete project.              |
| **Excel/PDF**   | Export project list.         |

Project rule:

```text
Only Active projects should appear in dropdowns.
Paused/deleted projects should not appear in new task creation.
```

---

# 16. Set Hierarchy Module Logic

## Hierarchy Buttons

| Button                     | Working Logic                        |
| -------------------------- | ------------------------------------ |
| **Add Group**              | Opens group modal.                   |
| **Edit**                   | Edit admin/member mapping.           |
| **Delete**                 | Delete hierarchy group.              |
| **Admin dropdown**         | Select manager/admin.                |
| **Employees multi-select** | Select employees under admin.        |
| **Save**                   | Save group to Hierarchy Setup sheet. |

## Hierarchy Flow

```text
Super Admin creates group
↓
Select Admin
↓
Select employee members
↓
Save hierarchy
↓
Admin can now see only assigned employees
```

## Access Logic

```text
Super Admin → all users
Admin → employees mapped under them
Employee → own records only
```

---

# 17. Notification Dot Logic

Sidebar red dots should appear for:

```text
Pending approvals
Pending delegation tasks
Pending checklist tasks
Pending work requests
```

Flow:

```text
Login / refresh
↓
getNotificationCounts(userName, role)
↓
Return counts
↓
Frontend hides all dots
↓
Shows dots only for modules with pending count > 0
```

This logic is already present in the frontend notification updater. 

---

# 18. Backend Status Logic — Final Correct Version

Use this as your final status standard.

## Delegation

```text
Pending
Send for Approval
Completed
Rework
```

Correct flow:

```text
Admin assigns → Pending
Employee submits → Send for Approval
Admin approves → Completed
Admin reworks → Rework
Employee resubmits → Send for Approval
```

## Work Request

```text
Pending
Send for Approval
Completed
Rework
```

Correct flow:

```text
Requester creates → Pending
Doer submits → Send for Approval
Requester/Admin approves → Completed
Requester/Admin reworks → Rework
```

## Checklist

Simple version:

```text
Pending
Completed
Late
```

Approval version:

```text
Pending
Send for Approval
Approved
Rework
```

Your current app mostly treats checklist as direct completed, so either keep it direct or add full approval. Don’t mix both.

## FMS

```text
Pending
Completed
Late / On Time
```

FMS does not need approval unless you want stricter manager verification.

---

# 19. Key Gaps I Found

These are important, Captain — fix these before scaling/demo 🚨

| Issue                                         | Impact                                  | Fix                                                                 |
| --------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| **TaskDone vs TaskEasy naming mismatch**      | App branding inconsistency              | Rename title/login/sidebar/footer consistently to TaskEasy.         |
| **Delegation submit may bypass approval**     | Approve/Review becomes unreliable       | Employee submit should set `Send for Approval`, not `Completed`.    |
| **Checklist start time may not be respected** | Wrong planned times                     | Backend must use frontend start time.                               |
| **Duplicate functions in Code.gs**            | Later function overrides earlier one    | Remove duplicate `getMisData`, `getChecklistTasksForApproval`, etc. |
| **Role checks not strict enough on backend**  | Hidden UI is not security               | Every write function should verify role.                            |
| **Plain password storage**                    | Security risk                           | Hash passwords or use Google account auth.                          |
| **Cache can become stale**                    | Wrong dashboard/MIS data                | Clear cache after every create/update/delete/done/rework.           |
| **FMS screenshot buttons not fully wired**    | Buttons may look working but do nothing | Add backend for Import Sheet, Analytics, Generate with AI.          |
| **Admin FMS may show too much**               | Admin may see all FMS instead of team   | Apply hierarchy filter to Admin.                                    |
| **Date formats mixed**                        | Wrong date/delay calculations           | Use ISO `YYYY-MM-DDTHH:mm:ss` everywhere internally.                |

---

# 20. Final Complete Working Flow

```text
1. User logs in
2. Backend validates active user
3. Frontend loads role-based sidebar
4. Dashboard loads summary metrics
5. Admin/Super Admin creates tasks:
   - Delegation
   - Checklist
   - Work Request
   - FMS from sheet
6. Employee sees pending work
7. Employee completes work with remarks/proof
8. Task goes to approval where required
9. Admin approves or reworks
10. Dashboard updates
11. MIS recalculates performance
12. Reports export to Excel/PDF
13. Hierarchy controls who sees whose data
14. Notifications show pending action dots
```

---

# 21. Best Final App Logic Standard

Use this as your master rule:

```text
Every module must have:
- Create
- Assign
- Pending
- Done/Submit
- Approval/Rework where needed
- Completed history
- Delay calculation
- Attachment proof
- Role-based visibility
- Dashboard count
- MIS impact
- Report export
```

This will make TaskEasy behave like a proper professional workflow system instead of just separate task pages.

Absolutely Captain 🚀
To make **TaskEasy super advanced**, don’t just add more pages — add **enterprise-level intelligence, automation, control, analytics, and scalability**.

Your current stack is perfect for it:

```txt
Frontend      → Next.js + React + TypeScript + Tailwind
Backend       → NestJS + TypeScript
Database      → MongoDB Atlas + Prisma
Cache/Queue   → Redis + BullMQ
Auth          → JWT + RBAC
Upload        → Cloudinary
```

Now upgrade TaskEasy from a task app into a **complete workflow operating system**.

---

# TaskEasy Super Advanced Modules

## 1. Multi-Tenant SaaS System

This makes TaskEasy usable by multiple companies.

### Add Modules

```txt
Super Admin SaaS Panel
Company / Tenant Management
Subscription Plans
Feature Control
Usage Limits
Billing History
Company Admin
Tenant-wise Data Isolation
```

### Logic

```txt
SaaS Super Admin creates company
↓
Company gets unique workspace
↓
Company Admin creates users
↓
All data saved with tenantId
↓
No company can see another company’s data
```

### Database Addition

```txt
tenants
subscriptions
plans
tenantSettings
featureFlags
usageLogs
```

### Example

```txt
Kriscel Company
  Users
  Projects
  Tasks
  MIS
  Reports

ABC Company
  Separate users
  Separate projects
  Separate reports
```

---

# 2. Advanced Role + Permission System

Current roles are:

```txt
Super Admin
Admin
Employee
```

Make it advanced:

```txt
SaaS Owner
Company Owner
Super Admin
Admin
Manager
Team Lead
Employee
Auditor
Viewer
Client / External User
```

## Permission Logic

Instead of only role-based access, use **permission-based access**.

```txt
Role = Admin
Permissions:
- create_task
- approve_task
- view_team_dashboard
- export_report
- manage_users
```

### Permission Matrix

| Module     | Super Admin | Admin   | Manager | Employee     | Viewer |
| ---------- | ----------- | ------- | ------- | ------------ | ------ |
| Dashboard  | Full        | Team    | Team    | Own          | Read   |
| Delegation | Full        | Team    | Team    | Own          | No     |
| Approvals  | Full        | Team    | Team    | Own Requests | No     |
| MIS        | Full        | Team    | Team    | Own          | Read   |
| Reports    | Full        | Team    | Team    | Own          | Read   |
| Users      | Full        | Limited | No      | No           | No     |

### Logic

```txt
JWT contains role
↓
Backend loads permissions
↓
Every API checks permission
↓
Frontend hides buttons
↓
Backend still protects action
```

---

# 3. Dynamic Workflow Builder

This will make your FMS system very powerful.

## Add Module

```txt
Workflow Builder
```

Admin can create workflows without coding.

### Example Workflow

```txt
Payment Follow-up Workflow

Step 1: Create PI
Assigned To: Sales
SLA: 1 day

Step 2: Payment Follow-up
Assigned To: Accounts
SLA: 2 days

Step 3: Confirmation
Assigned To: Admin
SLA: 1 day
```

### Buttons

| Button               | Logic                               |
| -------------------- | ----------------------------------- |
| **Create Workflow**  | Opens workflow builder.             |
| **Add Step**         | Adds new step in flow.              |
| **Assign Role/User** | Decides who will do step.           |
| **Set SLA**          | Sets deadline per step.             |
| **Add Condition**    | Adds if/else logic.                 |
| **Publish Workflow** | Makes workflow active.              |
| **Clone Workflow**   | Duplicate existing workflow.        |
| **Pause Workflow**   | Stops new tasks from this workflow. |
| **Archive Workflow** | Hide old workflow.                  |

### Logic

```txt
Admin creates workflow template
↓
Adds steps
↓
Assigns user/role per step
↓
Sets SLA and conditions
↓
Publishes workflow
↓
System creates tasks automatically step-by-step
```

---

# 4. Visual Flow Map

For FMS, add a proper flow diagram.

## UI

```txt
Start → Step 1 → Step 2 → Approval → Step 3 → Completed
```

### Step Colors

```txt
Green  = Completed
Yellow = Pending
Red    = Delayed
Blue   = Current Step
Grey   = Not Started
```

### Button Logic

| Button                | Logic                                |
| --------------------- | ------------------------------------ |
| **Flow Map**          | Opens workflow visual map.           |
| **View Step Details** | Shows assignee, SLA, remarks, proof. |
| **Reassign Step**     | Admin changes assignee.              |
| **Skip Step**         | Allowed only with permission.        |
| **Restart Step**      | Sends step back to pending.          |

---

# 5. AI Workflow Generator

This will make the app look seriously premium.

## Feature

Admin writes:

```txt
Create a payment follow-up workflow from PI creation to payment confirmation.
```

AI generates:

```txt
Steps
Assignees
SLA
Approval points
Risk points
Notifications
```

### Button

```txt
Generate with AI
```

### Logic

```txt
Admin enters workflow description
↓
AI generates flow draft
↓
Admin reviews
↓
Admin edits steps
↓
Admin publishes workflow
```

### AI Output Example

```txt
Step 1: Create Proforma Invoice
Role: Sales
SLA: 1 day

Step 2: Share PI with client
Role: Sales
SLA: 4 hours

Step 3: Payment Follow-up
Role: Accounts
SLA: 2 days

Step 4: Payment Confirmation
Role: Accounts Manager
SLA: 1 day
```

---

# 6. Smart Task Assignment Engine

Make TaskEasy assign tasks intelligently.

## Logic

```txt
New task created
↓
System checks:
- User workload
- Skill
- Availability
- Past performance
- Current pending count
- Leave status
↓
Suggests best assignee
```

### Add Button

```txt
Suggest Best Assignee
```

### Scoring Formula

```txt
Assignee Score =
Availability Score
+ Skill Match
+ Low Workload
+ Past On-Time %
- Pending Overload
- Rework Rate
```

### Example

```txt
Sunny has 25 pending tasks → score low
Nand Lal has 3 pending tasks and good score → recommended
```

---

# 7. SLA + Escalation Engine

This is a must for professional workflow systems.

## SLA Logic

```txt
Task created with deadline
↓
System checks pending tasks every 30 minutes
↓
If due soon → reminder
If overdue → mark delayed
If very overdue → escalate
```

### Escalation Levels

```txt
Level 1: Reminder to Doer
Level 2: Notify Manager
Level 3: Notify Admin
Level 4: Mark Critical
Level 5: Show in Red Escalation Dashboard
```

### BullMQ Jobs

```txt
task-reminder-job
sla-check-job
overdue-escalation-job
daily-summary-job
```

### Dashboard Card

```txt
SLA Breaches
Due Today
Overdue
Escalated
Critical
```

---

# 8. Advanced Notification System

Current red dot is basic. Make it full notification center.

## Add

```txt
In-app Notifications
Email Notifications
WhatsApp Notifications
Push Notifications
Daily Digest
Escalation Alerts
Approval Alerts
Rework Alerts
Mention Alerts
```

### Notification Types

```txt
TASK_ASSIGNED
TASK_DUE_SOON
TASK_OVERDUE
TASK_COMPLETED
APPROVAL_PENDING
REWORK_REQUESTED
COMMENT_MENTION
FMS_STEP_ASSIGNED
MIS_SCORE_UPDATED
```

### Notification Logic

```txt
Event happens
↓
Create notification record
↓
Push real-time alert
↓
Send email/WhatsApp if enabled
↓
Mark as read/unread
```

### Buttons

| Button                    | Logic                          |
| ------------------------- | ------------------------------ |
| **Bell Icon**             | Opens notification drawer.     |
| **Mark All Read**         | Marks all notifications read.  |
| **View Task**             | Opens linked task.             |
| **Mute Module**           | User can mute module alerts.   |
| **Notification Settings** | Configure email/push/WhatsApp. |

---

# 9. Real-Time Updates

Add real-time dashboard changes.

## Use

```txt
WebSockets / Socket.IO
```

### Logic

```txt
Task completed
↓
Backend emits event
↓
Dashboard card updates live
↓
Approver gets instant notification
```

### Real-time Events

```txt
task.created
task.completed
task.approved
task.reworked
fms.step.completed
notification.created
dashboard.updated
```

---

# 10. Advanced Approval Engine

Instead of simple approve/rework, add multi-level approval.

## Approval Types

```txt
Single Approval
Multi-Level Approval
Parallel Approval
Conditional Approval
Auto Approval
```

### Example

```txt
Employee completes task
↓
Team Lead approval
↓
Admin approval
↓
Final status = Completed
```

### Conditional Logic

```txt
If task priority = High
Then require Admin approval

If attachment missing
Then block submission

If delay > 3 days
Then require reason
```

### Buttons

| Button                | Logic                                      |
| --------------------- | ------------------------------------------ |
| **Approve**           | Moves to next approval level or Completed. |
| **Reject**            | Marks rejected.                            |
| **Send Rework**       | Sends back to doer.                        |
| **Add Approval Note** | Adds comment.                              |
| **Delegate Approval** | Assign approval to another admin.          |
| **Force Complete**    | Super Admin only.                          |

---

# 11. Comments + Activity Timeline

Every task should have a full history.

## Add to every task

```txt
Comments
Mentions
Activity Timeline
Status History
Attachment History
Approval History
```

### Timeline Example

```txt
10:00 AM — Akash created task
10:05 AM — Task assigned to Sunny
02:30 PM — Sunny uploaded proof
03:00 PM — Mitushi sent rework
04:15 PM — Sunny resubmitted
05:00 PM — Task approved
```

### Buttons

| Button           | Logic                                 |
| ---------------- | ------------------------------------- |
| **Comment**      | Adds comment to task.                 |
| **@Mention**     | Sends notification to mentioned user. |
| **View History** | Opens timeline.                       |
| **Pin Comment**  | Important comment stays top.          |

---

# 12. Advanced Attachment System

Cloudinary upload can become very powerful.

## Add

```txt
File Preview
Versioning
Proof Required Rule
File Type Validation
File Size Limit
Attachment Category
Virus Scan Integration
```

### Attachment Types

```txt
Task Brief
Proof
Invoice
Screenshot
Excel
PDF
Image
Form Response
Approval Proof
```

### Logic

```txt
User uploads file
↓
Backend checks file type/size
↓
Uploads to Cloudinary
↓
Stores metadata
↓
Links file to task
↓
Timeline records upload event
```

---

# 13. Task Dependency System

Some tasks should start only after another task completes.

## Example

```txt
Task B starts only after Task A is completed.
```

### Dependency Logic

```txt
Task created with dependency
↓
Task stays Blocked
↓
Parent task completes
↓
System unlocks child task
```

### Statuses

```txt
Pending
Blocked
In Progress
Send for Approval
Completed
Rework
Cancelled
```

### Buttons

| Button               | Logic                      |
| -------------------- | -------------------------- |
| **Add Dependency**   | Link task to another task. |
| **View Blockers**    | Show blocking tasks.       |
| **Unblock Manually** | Admin override.            |

---

# 14. Task Priority + Risk Engine

Make task priority smarter.

## Priority Levels

```txt
Low
Medium
High
Urgent
Critical
```

## Risk Score

```txt
Risk Score =
Days Overdue
+ Priority Weight
+ Rework Count
+ Assignee Workload
+ Client Importance
```

### Dashboard

```txt
High Risk Tasks
Critical Overdue Tasks
Repeated Rework Tasks
Blocked Tasks
```

---

# 15. Workload Management

Add team workload view.

## Metrics

```txt
Assigned Tasks
Pending Tasks
Due Today
Overdue
Avg Delay
Capacity %
Burnout Risk
```

### Workload Logic

```txt
Each user has daily capacity
↓
Task estimate consumes capacity
↓
Dashboard shows overloaded users
```

### Buttons

| Button                 | Logic                                |
| ---------------------- | ------------------------------------ |
| **Rebalance Workload** | Suggest task reassignment.           |
| **View Capacity**      | Shows user capacity chart.           |
| **Bulk Reassign**      | Move multiple tasks to another user. |

---

# 16. Calendar View

Add calendar for due dates.

## Views

```txt
Day View
Week View
Month View
User Calendar
Team Calendar
Project Calendar
```

### Logic

```txt
Task target date becomes calendar event
↓
User can drag task to new date
↓
Backend updates target date
↓
Timeline logs reschedule
```

### Buttons

```txt
Create Task
Reschedule
Filter by User
Filter by Project
Export Calendar
```

---

# 17. Kanban Board

Add board view for tasks.

## Columns

```txt
Pending
In Progress
Send for Approval
Rework
Completed
Blocked
```

### Logic

```txt
Drag task from Pending to In Progress
↓
Backend updates status
↓
Timeline logs movement
```

### Buttons

```txt
Board View
Table View
Card View
Bulk Move
Filter
```

---

# 18. Project Management Layer

Currently project is mostly a dropdown. Make it a full module.

## Add

```txt
Project Dashboard
Project Members
Project Timeline
Project Budget
Project Risk
Project Documents
Project Task Summary
Project SLA
Project Health Score
```

### Project Health Score

```txt
Health =
Completion %
- Delay %
- Rework %
- Overdue %
```

### Project Status

```txt
Not Started
Active
On Hold
Completed
Archived
```

---

# 19. KRA / KPI / OKR System

Your checklist + MIS can become a full performance system.

## Add

```txt
KRA Master
KPI Rules
OKR Goals
Target Score
Weekly Review
Monthly Review
Performance Grade
Manager Feedback
```

### Logic

```txt
Admin creates KRA
↓
Assigns KPI weightage
↓
System calculates score weekly/monthly
↓
Manager reviews
↓
Final grade generated
```

### Grade Logic

```txt
A+ = 90+
A  = 80-89
B  = 65-79
C  = 50-64
D  = below 50
```

---

# 20. Advanced MIS 2.0

Add deeper analytics.

## MIS Pages

```txt
Employee Performance
Team Performance
Project Performance
Department Performance
SLA Performance
Rework Analysis
Delay Analysis
Workload Analysis
Trend Analysis
```

### Charts

```txt
Task Created vs Completed
Pending Aging
Rework Trend
Delay Heatmap
Employee Ranking
Project Health
SLA Breach Trend
```

### AI Insights

```txt
"Mitushi has 63 pending tasks, mostly checklist-related."
"Sunny has no delay but low completed volume."
"Nand Lal has repeated pending work requests."
```

---

# 21. Predictive Analytics

Make it futuristic.

## AI Predictions

```txt
Task delay prediction
Employee overload prediction
Project risk prediction
Rework probability
SLA breach prediction
```

### Logic

```txt
System checks past task data
↓
Compares workload, priority, delay history
↓
Predicts risk level
↓
Shows warning before delay happens
```

### Example

```txt
This task has 82% chance of delay because:
- Assignee has 21 pending tasks
- Similar tasks took 3 days before
- Deadline is tomorrow
```

---

# 22. AI Assistant Inside App

Add internal TaskEasy AI.

## Features

```txt
Ask AI about tasks
Generate workflow
Summarize pending work
Write follow-up message
Explain MIS score
Suggest priority
Suggest assignee
Detect bottlenecks
```

### Example Prompts

```txt
"Show me delayed tasks of this week."
"Why is Mitushi score low?"
"Create checklist for client onboarding."
"Which employee is overloaded?"
"Summarize today’s pending approvals."
```

---

# 23. Smart Search

Add global search.

## Search Across

```txt
Tasks
Users
Projects
FMS
Reports
Approvals
Attachments
Comments
```

### Search Query Examples

```txt
payment pending Sunny
delayed checklist last week
FMS payment followup
Akash rework tasks
```

### Tech

```txt
MongoDB Atlas Search
```

---

# 24. Audit Logs

This is must-have for enterprise apps.

## Track Every Action

```txt
User login
Task created
Task edited
Task deleted
Task completed
Task approved
Rework sent
File uploaded
Report exported
User role changed
Project archived
```

### Audit Record

```txt
who did it
what changed
old value
new value
module
ip address
device
timestamp
```

---

# 25. Data Import / Export Center

## Import

```txt
Users from Excel
Projects from Excel
Tasks from Excel
FMS from Google Sheet / Excel
Checklist master from Excel
```

## Export

```txt
PDF
Excel
CSV
JSON
Audit export
MIS export
```

### Buttons

```txt
Import Excel
Download Template
Validate Data
Preview Import
Confirm Import
Export All
```

---

# 26. Template Library

Make reusable templates.

## Templates

```txt
Checklist Templates
Delegation Templates
Work Request Templates
FMS Workflow Templates
Report Templates
Notification Templates
Email Templates
```

### Logic

```txt
Admin creates template
↓
User selects template
↓
Fields auto-fill
↓
User edits and submits
```

---

# 27. Form Builder

For FMS and Work Requests, add custom forms.

## Field Types

```txt
Text
Number
Date
Time
Dropdown
Multi-select
File Upload
Checkbox
Radio
Table/Grid
Signature
URL
Currency
```

### Logic

```txt
Admin builds custom form
↓
Links it to workflow step
↓
Doer fills form
↓
Response saved against task
```

---

# 28. Client Portal

For external clients/vendors.

## Client Can

```txt
Submit request
Upload document
View request status
Approve proof
Comment
Download report
```

### Use Case

```txt
Client creates payment/query request
↓
Internal team works
↓
Client can see status without internal data
```

---

# 29. Vendor Portal

Useful for ERP/FMS style systems.

## Vendor Can

```txt
View assigned quote request
Submit quote
Upload document
Update status
Comment
```

---

# 30. Mobile / PWA App

Make it work like an app.

## Add

```txt
Installable PWA
Push notifications
Offline mode
Camera upload
Voice note
Quick action buttons
```

### Mobile Quick Actions

```txt
Mark Done
Upload Proof
Add Comment
Approve
Send Rework
```

---

# 31. Voice Notes + Speech-to-Task

Very modern feature.

## Logic

```txt
User records voice
↓
AI converts to text
↓
System creates task draft
↓
User confirms
```

Example:

```txt
"Assign Sunny to follow up payment with ABC client by tomorrow 5 PM."
```

System creates:

```txt
Task: Follow up payment with ABC client
Assigned To: Sunny
Deadline: Tomorrow 5 PM
Priority: Medium
```

---

# 32. Email-to-Task

Create task from email.

## Logic

```txt
Email sent to task@taskeasy.app
↓
System parses subject/body
↓
Creates work request/delegation
↓
Attachments stored in Cloudinary
```

---

# 33. WhatsApp-to-Task

Very useful in Indian business workflows.

## Logic

```txt
Admin sends WhatsApp message
↓
Bot asks confirmation
↓
Creates task
↓
Sends status updates
```

Example:

```txt
"Assign Nand Lal to prepare quotation by Friday"
```

---

# 34. Reminder Rules Engine

User can set custom reminders.

## Examples

```txt
Remind doer 1 day before due date
Remind manager when task is overdue
Send daily 9 AM pending summary
Send Friday weekly MIS report
```

---

# 35. Smart Dashboard 2.0

Add dashboard widgets.

## Widgets

```txt
Today’s Focus
Due Today
Overdue Tasks
Approval Pending
Rework Pending
SLA Breaches
Team Workload
Project Health
Employee Ranking
FMS Bottlenecks
Recent Activity
AI Insights
```

### User can customize dashboard:

```txt
Add Widget
Remove Widget
Drag Layout
Save Dashboard Preference
```

---

# 36. Advanced Reports 2.0

## Report Builder

Admin can build custom reports.

### Logic

```txt
Select module
↓
Select columns
↓
Apply filters
↓
Save report template
↓
Schedule report email
```

### Buttons

```txt
Create Report
Save Template
Schedule Email
Export Excel
Export PDF
Share Report
```

---

# 37. Scheduled Reports

Use BullMQ.

## Examples

```txt
Daily pending report at 9 AM
Weekly MIS report every Saturday
Monthly performance report on 1st
Project health report every Monday
```

---

# 38. Data Backup + Restore

Enterprise-level must-have.

## Add

```txt
Daily MongoDB backup
Export tenant data
Restore deleted task
Restore project
Audit backup
Cloudinary backup mapping
```

### Buttons

```txt
Backup Now
Download Backup
Restore Data
View Backup History
```

---

# 39. Security Advanced Features

## Add

```txt
Two-Factor Authentication
Device Management
Login History
IP Restriction
Session Timeout
Password Policy
Account Lock after failed attempts
Rate Limiting
API Key Management
```

### Security Logic

```txt
Wrong password 5 times
↓
Account locked for 15 minutes
↓
Admin notified
```

---

# 40. Audit + Compliance Dashboard

## Show

```txt
Who changed what
Who exported reports
Who approved delayed task
Who deleted user
Who changed hierarchy
```

### Risk Alerts

```txt
Multiple failed logins
Suspicious export
Role changed
Bulk delete attempt
```

---

# 41. Automation Rule Builder

This is super powerful.

## Examples

```txt
When task is overdue by 1 day → notify manager
When priority is Critical → require approval
When checklist is missed → create rework
When user has 20+ pending tasks → notify admin
When project health below 50% → mark project risk
```

### Logic

```txt
Trigger
↓
Condition
↓
Action
```

Example:

```txt
Trigger: Task Overdue
Condition: Priority = High
Action: Escalate to Admin
```

---

# 42. Bulk Actions

Add this everywhere.

## Examples

```txt
Bulk approve
Bulk rework
Bulk assign
Bulk reassign
Bulk export
Bulk delete/archive
Bulk status update
Bulk reminder send
```

---

# 43. Task Aging Report

Very useful for management.

## Aging Buckets

```txt
0-1 days
2-3 days
4-7 days
8-15 days
15+ days
```

### Dashboard

```txt
Pending Aging
Overdue Aging
Approval Aging
Rework Aging
```

---

# 44. Rework Analysis

Track quality issues.

## Metrics

```txt
Total reworks
Rework by employee
Rework by project
Rework reason
Repeated rework
Avg rework cycle time
```

### Rework Reasons

```txt
Incomplete work
Wrong attachment
Late response
Quality issue
Wrong data
Missing approval
```

---

# 45. Bottleneck Detection

Find where work gets stuck.

## Logic

```txt
System checks each workflow step
↓
Finds step with highest delay
↓
Marks bottleneck
```

Example:

```txt
Payment Follow-up FMS bottleneck:
Step 2 — Accounts confirmation
Avg delay: 3.4 days
```

---

# 46. Employee Productivity Score

Beyond MIS score.

## Score Factors

```txt
Completion rate
On-time rate
Rework rate
Average delay
Work volume
Critical task handling
Approval response time
```

### Final Score

```txt
Productivity Score = 100 - penalties + bonus
```

---

# 47. Project Health Score

## Score Factors

```txt
Task completion %
Overdue %
Rework %
SLA breaches
Pending aging
Blocked tasks
```

### Status

```txt
Healthy
At Risk
Critical
Delayed
```

---

# 48. Company Settings

Each company can configure:

```txt
Working days
Working hours
Holiday calendar
Default SLA
Approval rules
Notification rules
Branding
Logo
Theme
Date format
Time zone
```

---

# 49. Holiday + Working Hours Logic

Delay should not count holidays.

## Logic

```txt
Task due Friday 6 PM
Weekend off
Completed Monday 10 AM
↓
Delay should calculate based on working hours, not raw calendar time
```

Add:

```txt
holidayCalendars
workingHours
timezone
```

---

# 50. Final Super Advanced Module List

```txt
1. Multi-Tenant SaaS
2. Company Management
3. Subscription & Plan Management
4. Advanced RBAC + Permissions
5. Dashboard 2.0
6. Delegation
7. Work Request
8. Checklist + KRA
9. FMS Workflow Builder
10. Visual Flow Map
11. AI Workflow Generator
12. AI Assistant
13. Smart Task Assignment
14. SLA + Escalation Engine
15. Advanced Notification Center
16. Real-Time Updates
17. Multi-Level Approval
18. Comments + Timeline
19. Cloudinary Attachment Center
20. Task Dependencies
21. Risk Engine
22. Workload Management
23. Calendar View
24. Kanban Board
25. Project Management
26. MIS 2.0
27. Predictive Analytics
28. Global Search
29. Audit Logs
30. Import / Export Center
31. Template Library
32. Dynamic Form Builder
33. Client Portal
34. Vendor Portal
35. Mobile PWA
36. Voice-to-Task
37. Email-to-Task
38. WhatsApp-to-Task
39. Reminder Rule Builder
40. Report Builder
41. Scheduled Reports
42. Backup & Restore
43. Advanced Security
44. Compliance Dashboard
45. Automation Rule Builder
46. Bulk Actions
47. Task Aging Report
48. Rework Analysis
49. Bottleneck Detection
50. Company Settings
```

---

# Best Final Development Roadmap

## Phase 1 — Core Production System

```txt
Auth
Users
Projects
Hierarchy
Delegation
Work Request
Checklist
FMS
Approval
Dashboard
MIS
Reports
Cloudinary Upload
```

## Phase 2 — Advanced Workflow

```txt
Workflow Builder
Visual Flow Map
SLA Engine
Notification Center
Audit Logs
Kanban
Calendar
Bulk Actions
```

## Phase 3 — AI + Automation

```txt
AI Workflow Generator
AI Assistant
Smart Assignment
Predictive Delay
Automation Rule Builder
Email-to-Task
WhatsApp-to-Task
Voice-to-Task
```

## Phase 4 — SaaS Enterprise

```txt
Multi-Tenant SaaS
Subscriptions
Feature Flags
Client Portal
Vendor Portal
Advanced Security
Backup & Restore
Compliance Dashboard
```

---

# Final Vision

TaskEasy should become:

```txt
A super advanced SaaS workflow automation platform where companies can manage tasks, approvals, checklists, FMS workflows, employee MIS, project health, AI automation, reports, notifications, and performance from one place.
```

That means your product is no longer only a task dashboard.

It becomes:

```txt
TaskEasy = Workflow OS + MIS Engine + AI Task Manager + Company Productivity Platform
```

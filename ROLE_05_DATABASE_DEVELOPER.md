# TaskEasy — Database Developer Audit (Refreshed 2026-07-02)

**Role:** Database Developer · **Stack:** MongoDB Atlas · Prisma ORM

**Verification method:** Static audit of `prisma/schema.prisma` (1508 lines, 46 models, 22 enums) and the demo seed script.

---

## 1. Schema Snapshot

- **46 models**, **22 enums**.
- **156 total** `@@index` / `@@unique` / `onDelete` / `tenantId` directives.
- **15 `onDelete`** relations — mostly `Cascade` for owned children; needs verification on Mongo (Prisma emulates cascades in application layer for MongoDB).
- Multi-tenant partitioning via `tenantId String @db.ObjectId` on 34 models; composite indexes `[tenantId, ...]` present on all high-traffic queries.
- Platform-level models (`PlatformUser`, `PlatformRole`, `Invoice`, etc.) intentionally omit `tenantId` — correct (they cross tenants).

---

## 2. Index Coverage — Verified

| Model | Indexes present | Assessment |
|---|---|---|
| User | `[tenantId,email]U`, `[tenantId,employeeId]U`, `[tenantId,status]`, `[tenantId,role]`, `[managerId]`, `[buddyId]` | ✅ |
| DelegationTask | 5 composite incl. `[tenantId,status]`, `[tenantId,delegatedToId,status]`, `[tenantId,targetDate]` | ✅ |
| WorkRequest | 5 composite incl. `[tenantId,requestedForId,status]`, `[tenantId,deadlineDate]` | ✅ |
| ChecklistTask | 4 incl. `[tenantId,assignedToId,status]`, `[tenantId,plannedDate]`, `[masterId,plannedDate]U` | ✅ |
| FmsTask | 3 incl. `[tenantId,personId,status]`, `[tenantId,plannedDate]` | ✅ |
| Approval | 3 incl. `[tenantId,refType,refId]`, `[tenantId,submittedBy]` | ✅ |
| ActivityLog | `[tenantId,refType,refId]`, `[tenantId,createdAt]` | ✅ |
| AuditLog | 4 incl. `[tenantId,createdAt]`, `[tenantId,actorId]`, `[tenantId,action]`, `[tenantId,module]` | ✅ |
| MisSnapshot | `[tenantId,userId,periodType,periodStart]U`, `[tenantId,periodStart]` | ✅ |
| Notification | `[tenantId,userId,isRead]`, `[tenantId,createdAt]` | ✅ |
| BulkImportBatch | `[tenantId,moduleName,createdAt]`, `[tenantId,uploadedById]` | ✅ |

**Coverage: strong** on all core query paths.

---

## 3. Issues & Gaps

### 🔴 DB-01 — MongoDB does not enforce `onDelete: Cascade`
Prisma with MongoDB emulates cascade in the application layer only when using Prisma's typed API. Raw operations, external tools, and manual Mongo ops leave orphans. Also, non-cascade deletes today (Users, Projects, Tenants) will not clean up dependent DelegationTasks, WorkRequests, Comments, Attachments, ActivityLogs, MisSnapshots, Notifications, AuditLogs.

**Fix:**
- Document the emulation clearly at top of `schema.prisma`.
- Implement an application-layer soft-delete pattern: add `deletedAt DateTime?` on User, Project, Tenant. Filter `where: { deletedAt: null }` on all reads.
- Alternatively, on hard-delete of a User, cascade in a transaction inside `users.service.remove()`.

### 🔴 DB-02 — No indexes on high-cardinality "created by user X in last N days" queries
Reports and MIS commonly filter by `(delegatedToId | requestedForId | assignedToId | personId, createdAt)`. Current indexes cover `(userId, status)` but not `(userId, createdAt DESC)`. Result: reports over 90 days scan large collections.

**Fix:** Add:
```prisma
@@index([tenantId, delegatedToId, createdAt])   // DelegationTask
@@index([tenantId, requestedForId, createdAt])  // WorkRequest
@@index([tenantId, assignedToId, createdAt])    // ChecklistTask
@@index([tenantId, personId, createdAt])        // FmsTask
```

### 🔴 DB-03 — `NotificationSetting.@@unique([userId,type])` has no `tenantId`
User IDs are globally unique ObjectIds, so functionally fine — but if a user is ever migrated across tenants the constraint won't help. Cosmetic; low priority.

### 🟡 DB-04 — Missing partial/sparse indexes for status='PENDING' hot path
Dashboard count queries filter overwhelmingly by `status IN ('PENDING','IN_PROGRESS','REWORK','SEND_FOR_APPROVAL')`. A partial index on those statuses would shrink index size dramatically (MongoDB supports partial indexes).

**Fix:** Prisma doesn't expose partial-index syntax for Mongo; add them via a migration `db.command({ createIndexes: 'DelegationTask', indexes: [{key:{tenantId:1,status:1}, partialFilterExpression:{status:{$in:['PENDING','IN_PROGRESS','REWORK','SEND_FOR_APPROVAL']}}, name:'idx_open'}] })` in a startup script.

### 🟡 DB-05 — `AuditLog` has no TTL
Grows unbounded. On Mongo Atlas free tier this is a 30-day disk risk.

**Fix:** Enable TTL on `AuditLog.createdAt` (e.g. 365 days) via Atlas index config; document retention policy in `ARCHITECTURE.md`.

### 🟡 DB-06 — `LoginHistory` has no TTL
Same as DB-05.

### 🟡 DB-07 — `RefreshToken` doesn't index `expiresAt`
Cleanup jobs will scan the whole collection.

**Fix:** `@@index([expiresAt])` on `RefreshToken` and `PlatformRefreshToken`.

### 🟡 DB-08 — Seed script covers happy path only
The demo seed script creates 1 tenant, 7 users, 2 projects, 1 task per module. Missing:
- No delayed / overdue task (needed for MIS negative-score demo).
- No approval-pending task in `SEND_FOR_APPROVAL` state.
- No rework loop example.
- No FMS workflow with >1 step.
- No audit-log history.

**Fix:** Extend seed with a `seedDemoData()` block that produces one task per status per module + one MIS snapshot per employee.

### 🟢 DB-09 — Duplicate generated Prisma client tree
`apps/api/src/generated/apps/api/src/generated/prisma/*` shouldn't exist. See BE-07.

### 🟢 DB-10 — `Sequence` model likely used for tenant-scoped counters — but not indexed by tenantId
Check `sequence.service.ts` usage; likely fine as it uses the `_id` as key.

### 🟢 DB-11 — No `updatedAt` on some short-lived models (`LoginHistory`, `PlatformLoginHistory`)
Immutable append-only logs, so acceptable.

---

## 4. Data-Flow Verification

| Flow | Model chain | Consistency risk |
|---|---|---|
| Delegation assign → complete | DelegationTask → Approval → ApprovalLevel → ActivityLog → Notification → MisSnapshot | 🟡 If any step fails mid-way, no transaction (Mongo replica set required for transactions). Verify. |
| Work Request submit | WorkRequest → Approval → Notification | 🟡 Same |
| Checklist recurrence | ChecklistMaster → ChecklistTask (nightly job) | 🟡 If job fails, gap day undetected. Add a health metric: `expected vs actual daily task count`. |
| FMS delay calc | FmsTask.plannedDate vs actualCompletion → derived delay | ✅ Computed at query time (verify in `fms.service.ts`). |
| MIS weekly snapshot | Aggregate DelegationTask/WorkRequest/ChecklistTask → MisSnapshot | 🟡 If a task is retroactively completed, snapshot is stale. Document that snapshots are "as of week N" and not re-computed. |

---

## 5. Fix Roadmap (Database)

Sprint 4 (before demo):

1. **DB-02** Add composite `(userId, createdAt)` indexes on 4 task tables (5 min via schema + `db push`).
2. **DB-07** Add `@@index([expiresAt])` on `RefreshToken` and `PlatformRefreshToken`.
3. **DB-08** Extend the demo seed script with delayed + pending-approval + rework examples.
4. **DB-01 mitigation** Document the cascade caveat and add a `soft-delete` policy note.

Post-demo:

5. **DB-04** Partial indexes for open-status tasks via startup migration script.
6. **DB-05/06** TTL on AuditLog + LoginHistory.
7. Add integration test verifying cascade behavior (delete User → check dependent rows).
8. Add a monthly script that reports orphaned records per tenant.

---

## 6. Database Sign-off Gates

- [ ] `npx prisma db push` runs clean (no schema drift warnings).
- [ ] Seed produces demo data covering all statuses and at least one negative MIS score.
- [ ] Reports queries under 500ms for 90-day range on 10k rows.
- [ ] Cross-tenant query cannot return foreign-tenant rows (test in QA).
- [ ] Cascade behavior on user deletion documented and tested.
- [ ] Refresh-token cleanup job runs successfully.

---

*Document Owner: Database Developer · Last Refreshed: 2026-07-02 · Version: 2.0*

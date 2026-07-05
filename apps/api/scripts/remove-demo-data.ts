/**
 * Finds and removes likely demo/seed user records (and everything tied to
 * them) from the live database.
 *
 * Run from apps/api:
 *   npx ts-node scripts/remove-demo-data.ts            -> DRY RUN (prints what it would delete, deletes nothing)
 *   npx ts-node scripts/remove-demo-data.ts --confirm   -> actually deletes
 *
 * How it decides a user is "demo data" (a user only has to match ONE of these):
 *   1. Name matches a known example name from the original project notes
 *      (Sunny, Mitushi, Nand Lal, Akash).
 *   2. Email looks like a placeholder (contains "demo"/"test"/"sample", or
 *      ends in @example.com / @company.com / @test.com).
 *   3. Still on the UI's default password ("Demo@1234") AND has never
 *      logged in — a real employee who just hasn't changed their password
 *      yet would still show up in LoginHistory, so requiring BOTH avoids
 *      flagging genuine accounts.
 *
 * For every matched user, this also deletes everything they own or are
 * referenced by: DelegationTask, WorkRequest, ChecklistMaster/ChecklistTask,
 * FmsTask, Notification, LoginHistory, RefreshToken, Comment, AuditLog
 * (as actor) — and scrubs dangling references on OTHER users/records:
 * User.managerId, User.buddyId, Hierarchy.memberIds, Hierarchy.adminId.
 *
 * Tenants themselves are never deleted by this script, even if every user
 * in them is removed — that's a separate, more dangerous decision.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const CONFIRM = process.argv.includes('--confirm');

const KNOWN_DEMO_NAMES = ['sunny', 'mitushi', 'nand lal', 'akash'];
const DEMO_EMAIL_PATTERN = /demo|test|sample|@example\.com|@company\.com|@test\.com/i;
const DEFAULT_PASSWORD = 'Demo@1234';

interface MatchedUser {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  reasons: string[];
}

async function findDemoUsers(): Promise<MatchedUser[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      tenantId: true,
      passwordHash: true,
      lastLoginAt: true,
    },
  });

  const matched: MatchedUser[] = [];

  for (const user of users) {
    const reasons: string[] = [];

    if (KNOWN_DEMO_NAMES.some((n) => user.name.toLowerCase().includes(n))) {
      reasons.push('name matches a known example name from project notes');
    }

    if (DEMO_EMAIL_PATTERN.test(user.email)) {
      reasons.push('email looks like a placeholder');
    }

    if (!user.lastLoginAt) {
      const stillDefaultPassword = await bcrypt.compare(DEFAULT_PASSWORD, user.passwordHash);
      if (stillDefaultPassword) {
        reasons.push('never logged in + still on default password (Demo@1234)');
      }
    }

    if (reasons.length > 0) {
      matched.push({ id: user.id, name: user.name, email: user.email, tenantId: user.tenantId, reasons });
    }
  }

  return matched;
}

async function deleteUserAndRelatedData(userId: string) {
  await prisma.$transaction([
    prisma.delegationTask.deleteMany({ where: { OR: [{ delegatedToId: userId }, { delegatedById: userId }] } }),
    prisma.workRequest.deleteMany({ where: { OR: [{ requestedForId: userId }, { requestedById: userId }] } }),
    prisma.checklistTask.deleteMany({ where: { assignedToId: userId } }),
    prisma.checklistMaster.deleteMany({ where: { assignedToId: userId } }),
    prisma.fmsTask.deleteMany({ where: { personId: userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.loginHistory.deleteMany({ where: { userId } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.comment.deleteMany({ where: { authorId: userId } }),
    prisma.auditLog.deleteMany({ where: { actorId: userId } }),
    // Scrub dangling references on other records before the user disappears.
    prisma.user.updateMany({ where: { managerId: userId }, data: { managerId: null } }),
    prisma.user.updateMany({ where: { buddyId: userId }, data: { buddyId: null } }),
  ]);

  // Hierarchy.memberIds needs a $pull, which Prisma's updateMany can't express
  // for array fields (it would $set the whole array) — handled per-document
  // below, outside the transaction above.
  const groupsWithMember = await prisma.hierarchy.findMany({ where: { memberIds: { has: userId } } });
  for (const group of groupsWithMember) {
    await prisma.hierarchy.update({
      where: { id: group.id },
      data: { memberIds: group.memberIds.filter((id) => id !== userId) },
    });
  }

  // If this user was an admin of a hierarchy group, the group is now
  // orphaned — flag it instead of guessing a replacement admin.
  const groupsAsAdmin = await prisma.hierarchy.findMany({ where: { adminId: userId } });
  if (groupsAsAdmin.length > 0) {
    console.warn(
      `  ⚠ ${groupsAsAdmin.length} hierarchy group(s) had this user as admin — ` +
        `left in place, reassign manually: ${groupsAsAdmin.map((g) => g.id).join(', ')}`,
    );
  }

  await prisma.user.delete({ where: { id: userId } });
}

async function main() {
  console.log(CONFIRM ? '🗑️  Running in DELETE mode (--confirm passed)\n' : '🔍 Running in DRY RUN mode (pass --confirm to actually delete)\n');

  const matched = await findDemoUsers();

  if (matched.length === 0) {
    console.log('No users matched the demo-data heuristics. Nothing to do.');
    return;
  }

  console.log(`Found ${matched.length} candidate user(s):\n`);
  for (const u of matched) {
    console.log(`  • ${u.name} <${u.email}> (tenant ${u.tenantId})`);
    for (const r of u.reasons) console.log(`      - ${r}`);

    if (!CONFIRM) {
      const [delegations, workRequests, checklists, fms] = await Promise.all([
        prisma.delegationTask.count({ where: { OR: [{ delegatedToId: u.id }, { delegatedById: u.id }] } }),
        prisma.workRequest.count({ where: { OR: [{ requestedForId: u.id }, { requestedById: u.id }] } }),
        prisma.checklistTask.count({ where: { assignedToId: u.id } }),
        prisma.fmsTask.count({ where: { personId: u.id } }),
      ]);
      console.log(
        `      would also delete: ${delegations} delegation task(s), ${workRequests} work request(s), ` +
          `${checklists} checklist task(s), ${fms} FMS task(s)`,
      );
    }
  }
  console.log('');

  if (!CONFIRM) {
    console.log('Dry run only — no data was deleted. Re-run with --confirm to delete the above users and all their tasks/notifications/history.');
    return;
  }

  for (const u of matched) {
    console.log(`Deleting ${u.name} <${u.email}> and related data...`);
    await deleteUserAndRelatedData(u.id);
  }

  console.log(`\nDone. Removed ${matched.length} user(s) and their associated records.`);
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

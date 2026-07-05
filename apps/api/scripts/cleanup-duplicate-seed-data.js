require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const RULES = [
  { collection: 'tenants', groupFields: { slug: '$slug' } },
  { collection: 'delegationTasks', groupFields: { tenantId: '$tenantId', taskId: '$taskId' } },
  { collection: 'workRequests', groupFields: { tenantId: '$tenantId', requestId: '$requestId' } },
  { collection: 'checklistMasters', groupFields: { tenantId: '$tenantId', masterId: '$masterId' } },
  { collection: 'checklistTasks', groupFields: { tenantId: '$tenantId', taskId: '$taskId' } },
  { collection: 'fmsWorkflows', groupFields: { tenantId: '$tenantId', workflowId: '$workflowId' } },
  { collection: 'fmsTasks', groupFields: { tenantId: '$tenantId', fmsTaskId: '$fmsTaskId' } },
];

function toTimestamp(value) {
  if (value && typeof value === 'object' && '$date' in value) {
    return new Date(value.$date).getTime();
  }
  return new Date(value ?? 0).getTime();
}

async function getDuplicateGroups(collection, groupFields) {
  const result = await prisma.$runCommandRaw({
    aggregate: collection,
    pipeline: [
      { $group: { _id: groupFields, count: { $sum: 1 }, docs: { $push: { _id: '$_id', createdAt: '$createdAt' } } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ],
    cursor: {},
  });

  return result?.cursor?.firstBatch ?? [];
}

async function deleteDoc(collection, id) {
  await prisma.$runCommandRaw({
    delete: collection,
    deletes: [{ q: { _id: id }, limit: 1 }],
  });
}

async function cleanupRule(rule) {
  const groups = await getDuplicateGroups(rule.collection, rule.groupFields);
  let deleted = 0;

  for (const group of groups) {
    const docs = [...(group.docs ?? [])].sort((a, b) => {
      const aTime = toTimestamp(a.createdAt);
      const bTime = toTimestamp(b.createdAt);
      if (aTime !== bTime) return aTime - bTime;

      const aId = JSON.stringify(a._id);
      const bId = JSON.stringify(b._id);
      return aId.localeCompare(bId);
    });

    const keep = docs[0];
    const toDelete = docs.slice(1);

    for (const doc of toDelete) {
      await deleteDoc(rule.collection, doc._id);
      deleted += 1;
    }

    if (toDelete.length > 0) {
      console.log(
        `${rule.collection} ${JSON.stringify(group._id)} kept ${JSON.stringify(keep._id)} deleted ${toDelete.length}`,
      );
    }
  }

  return { collection: rule.collection, duplicateGroups: groups.length, deleted };
}

async function main() {
  const summary = [];
  for (const rule of RULES) {
    summary.push(await cleanupRule(rule));
  }
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

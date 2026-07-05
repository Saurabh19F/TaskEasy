require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findDocs(collection, filter) {
  const result = await prisma.$runCommandRaw({ find: collection, filter });
  return result?.cursor?.firstBatch ?? [];
}

async function updateManyRaw(collection, filter, update) {
  return prisma.$runCommandRaw({
    update: collection,
    updates: [{ q: filter, u: { $set: update }, multi: true }],
  });
}

async function deleteOneRaw(collection, filter) {
  return prisma.$runCommandRaw({
    delete: collection,
    deletes: [{ q: filter, limit: 1 }],
  });
}

async function migrateCollectionRoleDocs(collection, legacyName, targetName, buildScopeFilter) {
  const legacyDocs = await findDocs(collection, { name: legacyName });
  for (const doc of legacyDocs) {
    const scopeFilter = buildScopeFilter(doc);
    const existingTarget = await findDocs(collection, { ...scopeFilter, name: targetName });

    if (existingTarget.length > 0) {
      await deleteOneRaw(collection, { ...scopeFilter, name: legacyName });
    } else {
      await prisma.$runCommandRaw({
        update: collection,
        updates: [{ q: { _id: doc._id }, u: { $set: { name: targetName } }, multi: false }],
      });
    }
  }
}

async function main() {
  const [legacyUsers, legacyPlatformUsers, legacyRoles, legacyPlatformRoles] = await Promise.all([
    findDocs('users', { role: 'SUPER_ADMIN' }),
    findDocs('platformUsers', { role: 'SUPER_ADMIN' }),
    findDocs('roles', { name: 'SUPER_ADMIN' }),
    findDocs('platformRoles', { name: 'SUPER_ADMIN' }),
  ]);

  console.log(JSON.stringify({
    users: legacyUsers.length,
    platformUsers: legacyPlatformUsers.length,
    roles: legacyRoles.length,
    platformRoles: legacyPlatformRoles.length,
  }, null, 2));

  if (legacyUsers.length > 0) {
    await updateManyRaw('users', { role: 'SUPER_ADMIN' }, { role: 'ADMIN' });
  }

  if (legacyPlatformUsers.length > 0) {
    await updateManyRaw('platformUsers', { role: 'SUPER_ADMIN' }, { role: 'PLATFORM_ADMIN' });
  }

  await migrateCollectionRoleDocs('roles', 'SUPER_ADMIN', 'ADMIN', (doc) => ({ tenantId: doc.tenantId }));
  await migrateCollectionRoleDocs('platformRoles', 'SUPER_ADMIN', 'PLATFORM_ADMIN', () => ({}));

  const [usersAfter, platformUsersAfter, rolesAfter, platformRolesAfter] = await Promise.all([
    findDocs('users', { role: 'SUPER_ADMIN' }),
    findDocs('platformUsers', { role: 'SUPER_ADMIN' }),
    findDocs('roles', { name: 'SUPER_ADMIN' }),
    findDocs('platformRoles', { name: 'SUPER_ADMIN' }),
  ]);

  console.log(JSON.stringify({
    usersAfter: usersAfter.length,
    platformUsersAfter: platformUsersAfter.length,
    rolesAfter: rolesAfter.length,
    platformRolesAfter: platformRolesAfter.length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

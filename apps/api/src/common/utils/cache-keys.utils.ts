import * as crypto from 'crypto';

/**
 * Deterministic cache key builder.
 * Filters object is hashed so keys stay short and consistent.
 */
function hashFilters(filters: Record<string, unknown>): string {
  const sorted = JSON.stringify(
    Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== null)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
  return crypto.createHash('md5').update(sorted).digest('hex').slice(0, 8);
}

export const CacheKeys = {
  dashboard: (tenantId: string, userId: string, role: string, filters = {}) =>
    `dashboard:${tenantId}:${userId}:${role}:${hashFilters(filters)}`,

  mis: (tenantId: string, userId: string, filters = {}) =>
    `mis:${tenantId}:${userId}:${hashFilters(filters)}`,

  reports: (tenantId: string, type: string, filters = {}) =>
    `reports:${tenantId}:${type}:${hashFilters(filters)}`,

  notifications: (tenantId: string, userId: string) =>
    `notifications:${tenantId}:${userId}`,

  notificationCount: (tenantId: string, userId: string) =>
    `notifications:count:${tenantId}:${userId}`,

  activeProjects: (tenantId: string) =>
    `projects:active:${tenantId}`,

  activeUsers: (tenantId: string, userId?: string, role?: string) =>
    userId ? `users:active:${tenantId}:${userId}:${role ?? ''}` : `users:active:${tenantId}`,

  hierarchy: (tenantId: string, adminId: string) =>
    `hierarchy:${tenantId}:${adminId}`,

  userProfile: (userId: string) =>
    `user:profile:${userId}`,
};

export const CachePatterns = {
  dashboard: (tenantId: string) => `dashboard:${tenantId}:*`,
  mis: (tenantId: string) => `mis:${tenantId}:*`,
  reports: (tenantId: string) => `reports:${tenantId}:*`,
  notifications: (tenantId: string) => `notifications:${tenantId}:*`,
  activeUsers: (tenantId: string) => `users:active:${tenantId}:*`,
  allForTenant: (tenantId: string) => `*:${tenantId}:*`,
};

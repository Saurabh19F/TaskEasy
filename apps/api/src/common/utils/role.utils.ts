export const COMPANY_LEGACY_ADMIN_ROLE = 'SUPER_ADMIN';
export const COMPANY_OWNER_ROLE = 'COMPANY_OWNER';
export const COMPANY_ADMIN_ROLE = 'ADMIN';
export const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN';

export function normalizeCompanyRole(role?: string | null): string {
  const value = String(role ?? '').toUpperCase();
  if (!value) return '';
  if (value === COMPANY_LEGACY_ADMIN_ROLE) return COMPANY_OWNER_ROLE;
  return value;
}

export function normalizePlatformRole(role?: string | null): string {
  const value = String(role ?? '').toUpperCase();
  if (!value) return '';
  if (value === COMPANY_LEGACY_ADMIN_ROLE) return PLATFORM_ADMIN_ROLE;
  return value;
}

export function isCompanyAdminRole(role?: string | null): boolean {
  return normalizeCompanyRole(role) === COMPANY_ADMIN_ROLE;
}

export function isCompanyOwnerRole(role?: string | null): boolean {
  return normalizeCompanyRole(role) === COMPANY_OWNER_ROLE;
}

export function isTenantWideRole(role?: string | null): boolean {
  const normalized = normalizeCompanyRole(role);
  return normalized === 'SAAS_OWNER' || normalized === COMPANY_OWNER_ROLE;
}

export function isTeamManagerRole(role?: string | null): boolean {
  const normalized = normalizeCompanyRole(role);
  return normalized === COMPANY_ADMIN_ROLE || normalized === 'MANAGER';
}

export function isApproverRole(role?: string | null): boolean {
  return isTenantWideRole(role) || isTeamManagerRole(role);
}

export function isPlatformAdminRole(role?: string | null): boolean {
  return normalizePlatformRole(role) === PLATFORM_ADMIN_ROLE;
}

import { platformApiClient, platformDelete, platformGet, platformPatch, platformPost } from './platform-axios';
import type {
  PlatformAuthUser,
  PlatformBackupJob,
  PlatformCompany,
  PlatformDashboardData,
  PlatformInvoice,
  PlatformNotification,
  PlatformPayment,
  PlatformPlan,
  PlatformPlatformUser,
  PlatformRole,
  PlatformSecurityEvent,
  PlatformSettings,
  PlatformSubscription,
  PlatformSupportTicket,
  PlatformAuditLog,
} from '@/types';

export const platformAuthApi = {
  login: async (email: string, password: string, totpCode?: string): Promise<{ accessToken: string; user: PlatformAuthUser }> =>
    platformApiClient.post<{ success: true; data: { accessToken: string; user: PlatformAuthUser } }>('/platform/auth/login', { email, password, totpCode }, {
      skipAuthRefresh: true,
      headers: { 'x-skip-auth-refresh': '1' },
    } as any).then((res) => res.data.data),
  refresh: () => platformPost<{ accessToken: string }>('/platform/auth/refresh'),
  logout: () => platformPost<void>('/platform/auth/logout'),
  logoutAll: () => platformPost<void>('/platform/auth/logout-all'),
  me: () => platformGet<PlatformAuthUser>('/platform/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    platformPost<{ message: string }>('/platform/auth/change-password', { currentPassword, newPassword }),
};

export const platformDashboardApi = {
  get: () => platformGet<PlatformDashboardData>('/platform/dashboard'),
};

export const platformCompaniesApi = {
  findAll: (params?: Record<string, any>) => platformGet<PlatformCompany[]>('/platform/companies', params),
  findOne: (id: string) => platformGet<any>(`/platform/companies/${id}`),
  create: (data: any) => platformPost<PlatformCompany & { adminUser?: { id: string; email: string; name: string }; generatedPassword?: string }>('/platform/companies', data),
  update: (id: string, data: any) => platformPatch<PlatformCompany>(`/platform/companies/${id}`, data),
  remove: (id: string) => platformDelete<{ message: string }>(`/platform/companies/${id}`),
  updateStatus: (id: string, status: string) => platformPatch<PlatformCompany>(`/platform/companies/${id}/status`, { status }),
  updateModules: (id: string, modules: Record<string, boolean>) => platformPatch<any>(`/platform/companies/${id}/modules`, { modules }),
  resetAdminPassword: (id: string) => platformPost<{ message: string; tempPassword: string }>(`/platform/companies/${id}/reset-admin-password`),
  impersonate: (id: string, reason: string) => platformPost<any>(`/platform/companies/${id}/impersonate`, { reason }),
  exitImpersonation: (sessionId: string) => platformPost<{ message: string }>(`/platform/impersonation/${sessionId}/exit`),
};

export const platformPlansApi = {
  findAll: () => platformGet<PlatformPlan[]>('/platform/plans'),
  create: (data: any) => platformPost<PlatformPlan>('/platform/plans', data),
  update: (id: string, data: any) => platformPatch<PlatformPlan>(`/platform/plans/${id}`, data),
  remove: (id: string) => platformDelete<{ message: string }>(`/platform/plans/${id}`),
};

export const platformSubscriptionsApi = {
  findAll: () => platformGet<PlatformSubscription[]>('/platform/subscriptions'),
  create: (data: any) => platformPost<PlatformSubscription>('/platform/subscriptions', data),
  update: (id: string, data: any) => platformPatch<PlatformSubscription>(`/platform/subscriptions/${id}`, data),
  renew: (id: string, data: any) => platformPost<PlatformSubscription>(`/platform/subscriptions/${id}/renew`, data),
};

export const platformBillingApi = {
  invoices: {
    findAll: () => platformGet<PlatformInvoice[]>('/platform/billing/invoices'),
    create: (data: any) => platformPost<PlatformInvoice>('/platform/billing/invoices', data),
    updateStatus: (id: string, data: any) => platformPatch<PlatformInvoice>(`/platform/billing/invoices/${id}/status`, data),
  },
  revenueSummary: () => platformGet<any>('/platform/billing/revenue-summary'),
  payments: () => platformGet<PlatformPayment[]>('/platform/payments'),
};

export const platformSupportApi = {
  tickets: {
    findAll: () => platformGet<PlatformSupportTicket[]>('/platform/support/tickets'),
    create: (data: any) => platformPost<PlatformSupportTicket>('/platform/support/tickets', data),
    update: (id: string, data: any) => platformPatch<PlatformSupportTicket>(`/platform/support/tickets/${id}`, data),
    reply: (id: string, data: any) => platformPost<PlatformSupportTicket>(`/platform/support/tickets/${id}/reply`, data),
  },
  stats: () => platformGet<any>('/platform/support/stats'),
};

export const platformAuditApi = {
  findAll: (params?: Record<string, any>) => platformGet<PlatformAuditLog[]>('/platform/audit-logs', params),
};

export const platformUsersApi = {
  findAll: () => platformGet<PlatformPlatformUser[]>('/platform/platform-users'),
  create: (data: any) => platformPost<PlatformPlatformUser>('/platform/platform-users', data),
  update: (id: string, data: any) => platformPatch<PlatformPlatformUser>(`/platform/platform-users/${id}`, data),
  remove: (id: string) => platformDelete<{ message: string }>(`/platform/platform-users/${id}`),
  resetPassword: (id: string, data?: { newPassword?: string }) =>
    platformPost<{ message: string; tempPassword: string; user: PlatformPlatformUser }>(`/platform/platform-users/${id}/reset-password`, data ?? {}),
};

export const platformRolesApi = {
  findAll: () => platformGet<any[]>('/platform/roles'),
  create: (data: any) => platformPost<any>('/platform/roles', data),
  update: (id: string, data: any) => platformPatch<any>(`/platform/roles/${id}`, data),
  remove: (id: string) => platformDelete<{ message: string }>(`/platform/roles/${id}`),
};

export const platformNotificationsApi = {
  findAll: () => platformGet<PlatformNotification[]>('/platform/notifications'),
  send: (data: any) => platformPost<PlatformNotification>('/platform/notifications', data),
};

export const platformReportsApi = {
  revenue: (params?: Record<string, any>) => platformGet<any>('/platform/reports/revenue', params),
  companies: (params?: Record<string, any>) => platformGet<PlatformCompany[]>('/platform/reports/companies', params),
  subscriptions: (params?: Record<string, any>) => platformGet<PlatformSubscription[]>('/platform/reports/subscriptions', params),
  users: (params?: Record<string, any>) => platformGet<PlatformPlatformUser[]>('/platform/reports/users', params),
};

export const platformSecurityApi = {
  get: () => platformGet<{ events: PlatformSecurityEvent[]; settings: PlatformSettings }>('/platform/security-center'),
  resolveEvent: (id: string) => platformPatch<PlatformSecurityEvent>(`/platform/security-center/events/${id}/resolve`),
};

export const platformBackupsApi = {
  findAll: () => platformGet<PlatformBackupJob[]>('/platform/backups'),
  create: (data: any) => platformPost<PlatformBackupJob>('/platform/backups', data),
};

export const platformSettingsApi = {
  get: () => platformGet<PlatformSettings>('/platform/settings'),
  update: (data: any) => platformPatch<PlatformSettings>('/platform/settings', data),
};

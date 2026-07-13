import { api, apiGet, apiPost, apiPut, apiPatch, apiDelete, apiUpload } from './axios';
import { getApiBaseUrl } from './runtime-config';
import type {
  AuthUser, User, Project, DelegationTask,
  WorkRequest, ChecklistTask, FmsStep, DashboardData,
  Notification, NotificationCounts, UserMisCard, HierarchyGroup,
  UploadResult, PaginatedResponse, ApprovalQueueItem, ApprovalMySubmissions,
} from '@/types';

export interface DrilldownRow {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
  assignedTo: string;
  assignedBy?: string;
  project: string;
  module: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS';
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string, totpCode?: string): Promise<{ accessToken: string; user: AuthUser }> =>
    api.post<{ success: true; data: { accessToken: string; user: AuthUser } }>('/auth/login', { email, password, totpCode }, {
      skipAuthRefresh: true,
      headers: { 'x-skip-auth-refresh': '1' },
    } as any).then((res) => res.data.data),

  logout: () => apiPost<void>('/auth/logout'),

  logoutAll: () => apiPost<void>('/auth/logout-all'),

  refresh: () => apiPost<{ accessToken: string }>('/auth/refresh'),

  me: () => apiGet<AuthUser>('/auth/me'),

  forgotPassword: (email: string) =>
    apiPost<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    apiPost<void>('/auth/reset-password', { token, newPassword }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiPatch<void>('/auth/change-password', { currentPassword, newPassword }),

  setup2fa: () => apiPost<{ qrCode: string; secret: string }>('/auth/2fa/setup'),

  verify2fa: (totpCode: string) => apiPost<void>('/auth/2fa/verify', { totpCode }),

  disable2fa: (totpCode: string) => apiDelete<void>('/auth/2fa', { totpCode }),
};

// ─── Users ─────────────────────────────────────────────────────────────────────

export const usersApi = {
  findAll: (params?: Record<string, any>) =>
    apiGet<PaginatedResponse<User>>('/users', params),

  findActive: () => apiGet<User[]>('/users/active'),

  findOne: (id: string) => apiGet<User>(`/users/${id}`),

  create: (data: Partial<User> & { password: string }) =>
    apiPost<User>('/users', data),

  update: (id: string, data: Partial<User>) =>
    apiPatch<User>(`/users/${id}`, data),

  updateStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    apiPatch<User>(`/users/${id}/status`, { status }),

  remove: (id: string) => apiDelete<void>(`/users/${id}`),

  resetPassword: (id: string, newPassword: string) =>
    apiPatch<void>(`/users/${id}/password`, { newPassword }),
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projectsApi = {
  findAll: (params?: Record<string, any>) =>
    apiGet<PaginatedResponse<Project>>('/projects', params),

  findActive: () => apiGet<Pick<Project, 'id' | 'name' | 'color'>[]>('/projects/active'),

  findOne: (id: string) => apiGet<Project>(`/projects/${id}`),

  create: (data: { name: string; description?: string; color?: string }) =>
    apiPost<Project>('/projects', data),

  update: (id: string, data: Partial<Project>) =>
    apiPatch<Project>(`/projects/${id}`, data),

  toggleStatus: (id: string) => apiPatch<Project>(`/projects/${id}/toggle-status`),

  remove: (id: string) => apiDelete<{ message: string }>(`/projects/${id}`),
};

// ─── Hierarchy ────────────────────────────────────────────────────────────────

export const hierarchyApi = {
  findAll: () => apiGet<HierarchyGroup[]>('/hierarchy'),

  create: (data: { groupName: string; adminId: string; memberIds: string[] }) =>
    apiPost<HierarchyGroup>('/hierarchy', data),

  update: (id: string, data: Partial<HierarchyGroup>) =>
    apiPatch<HierarchyGroup>(`/hierarchy/${id}`, data),

  remove: (id: string) => apiDelete<{ message: string }>(`/hierarchy/${id}`),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  get: (view: 'team' | 'my' = 'team', filters?: Record<string, any>) =>
    apiGet<DashboardData>('/dashboard', { view, ...filters }),

  notificationCounts: () =>
    apiGet<NotificationCounts>('/dashboard/notifications/count'),

  drilldown: (
    module: 'delegation' | 'workRequest' | 'checklist' | 'fms',
    status: 'total' | 'done' | 'pending' | 'delayed',
    view: 'team' | 'my' = 'team',
  ) =>
    apiGet<DrilldownRow[]>('/dashboard/drilldown', { module, status, view }),
};

// ─── Security Settings ───────────────────────────────────────────────────────

export interface SecuritySettings {
  id: string;
  tenantId: string;
  sessionTimeoutEnabled: boolean;
  sessionTimeoutMinutes: number;
  auditLogsEnabled: boolean;
  ipWhitelistEnabled: boolean;
  whitelistedIps: string[];
  enforce2fa: boolean;
}

export const securitySettingsApi = {
  get: () => apiGet<SecuritySettings>('/security-settings'),
  update: (data: Partial<SecuritySettings>) =>
    apiPatch<SecuritySettings>('/security-settings', data),
};

// ─── Subscriptions ──────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  tier: string;
  price: number;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  currency: string;
  description: string | null;
  maxUsers: number;
  maxProjects: number;
  maxFmsWorkflows: number;
  features: string[];
  isActive: boolean;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: Plan;
}

export interface PlanChangeRequest {
  id: string;
  tenantId: string;
  currentPlanId: string;
  requestedPlanId: string;
  reason: string | null;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  currentPlan: Plan;
  requestedPlan: Plan;
}

export interface MySubscription {
  subscription: Subscription | null;
  usage: { users: number; fmsWorkflows: number };
  pendingRequest: PlanChangeRequest | null;
}

export const subscriptionsApi = {
  listPlans: () => apiGet<Plan[]>('/subscriptions/plans'),
  getMy: () => apiGet<MySubscription>('/subscriptions/my'),
  requestChange: (planId: string, reason?: string) =>
    apiPost<PlanChangeRequest>('/subscriptions/request-change', { planId, reason }),
  cancelRequest: (requestId: string) =>
    apiPatch<PlanChangeRequest>(`/subscriptions/requests/${requestId}/cancel`, {}),
  listRequests: () => apiGet<PlanChangeRequest[]>('/subscriptions/requests'),
};

// ─── Integrations ────────────────────────────────────────────────────────────

export type IntegrationProvider =
  | 'GOOGLE_CALENDAR'
  | 'GOOGLE_SHEETS'
  | 'GOOGLE_SSO'
  | 'MICROSOFT_SSO'
  | 'SENDGRID'
  | 'AWS_SES'
  | 'WHATSAPP';

export interface IntegrationAccount {
  id: string;
  tenantId: string;
  provider: IntegrationProvider;
  isEnabled: boolean;
  config: Record<string, any>;
  lastTestedAt?: string | null;
  lastSyncedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const integrationsApi = {
  listAccounts: () => apiGet<IntegrationAccount[]>('/integrations/accounts'),

  upsertAccount: (
    provider: IntegrationProvider,
    config: Record<string, any>,
    isEnabled = true,
  ) => apiPut<IntegrationAccount>(`/integrations/accounts/${provider}`, { config, isEnabled }),

  removeAccount: (provider: IntegrationProvider) =>
    apiDelete<{ message: string }>(`/integrations/accounts/${provider}`),

  rotateAccount: (provider: IntegrationProvider) =>
    apiPost<IntegrationAccount>(`/integrations/accounts/${provider}/rotate`, {}),

  testProvider: (
    provider: 'SENDGRID' | 'AWS_SES' | 'WHATSAPP' | 'GOOGLE_CALENDAR' | 'GOOGLE_SHEETS',
    body?: { to?: string; subject?: string; message?: string; entityType?: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS' },
  ) =>
    apiPost<any>(`/integrations/test/${provider}`, body ?? {}),

  syncGoogleCalendar: (entityType: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS', entityId: string) =>
    apiPost<{ externalId?: string; externalUrl?: string | null; summary?: string; status: string }>(
      '/integrations/google-calendar/sync',
      { entityType, entityId },
    ),

  watchGoogleCalendar: (webhookUrl: string) =>
    apiPost<{ account: IntegrationAccount; watch: { channelId?: string | null; resourceId?: string | null; resourceUri?: string | null; expiresAt?: string | null } }>(
      '/integrations/google-calendar/watch',
      { webhookUrl },
    ),

  exportToGoogleSheets: (entityType: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS') =>
    apiPost<{ spreadsheetId: string; url: string; rowCount: number }>(
      '/integrations/google-sheets/export',
      { entityType },
    ),
};

// ─── Delegation ───────────────────────────────────────────────────────────────

export const delegationApi = {
  findAll: (params?: Record<string, any>) =>
    apiGet<PaginatedResponse<DelegationTask>>('/delegation', params),

  myPending: () => apiGet<DelegationTask[]>('/delegation/my-pending'),

  findOne: (id: string) => apiGet<DelegationTask>(`/delegation/${id}`),

  create: (data: {
    delegatedToIds: string[];
    projectId: string;
    title: string;
    description?: string;
    targetDate: string;
    targetTime?: string;
    priority?: string;
    attachmentIds?: string[];
  }) => apiPost<DelegationTask | DelegationTask[]>('/delegation', data),

  bulkCreate: (data: {
    delegatedToIds: string[];
    projectId: string;
    tasks: {
      title: string;
      description?: string;
      targetDate: string;
      targetTime?: string;
      priority?: string;
      attachmentIds?: string[];
    }[];
  }) => apiPost<DelegationTask[]>('/delegation/bulk', data),

  submit: (id: string, data: { doerRemarks: string; attachmentIds?: string[] }) =>
    apiPatch<DelegationTask>(`/delegation/${id}/submit`, data),

  approve: (id: string, data: { remarks?: string; rating?: number }) =>
    apiPatch<DelegationTask>(`/delegation/${id}/approve`, data),

  rework: (id: string, data: { reworkRemark: string }) =>
    apiPatch<DelegationTask>(`/delegation/${id}/rework`, data),
};

// ─── Work Requests ────────────────────────────────────────────────────────────

export const workRequestApi = {
  findAll: (params?: Record<string, any>) =>
    apiGet<PaginatedResponse<WorkRequest>>('/work-requests', params),

  findOne: (id: string) => apiGet<WorkRequest>(`/work-requests/${id}`),

  create: (data: {
    requestForId: string;
    projectId: string;
    title: string;
    deadlineDate: string;
    deadlineTime?: string;
    description?: string;
  }) => apiPost<WorkRequest>('/work-requests', data),

  submit: (id: string, data: { doerRemarks: string; attachmentIds?: string[] }) =>
    apiPatch<WorkRequest>(`/work-requests/${id}/submit`, data),

  approve: (id: string, data: { remarks?: string }) =>
    apiPatch<WorkRequest>(`/work-requests/${id}/approve`, data),

  rework: (id: string, data: { reworkRemark: string }) =>
    apiPatch<WorkRequest>(`/work-requests/${id}/rework`, data),
};

// ─── Checklist ────────────────────────────────────────────────────────────────

export const checklistApi = {
  findMasters: () => apiGet<any[]>('/checklist/masters'),

  createMaster: (data: any) => apiPost<any>('/checklist/masters', data),

  toggleMaster: (id: string) => apiPatch<any>(`/checklist/masters/${id}/toggle`),

  findTasks: (params?: Record<string, any>) =>
    apiGet<PaginatedResponse<ChecklistTask>>('/checklist/tasks', params),

  myPending: () => apiGet<ChecklistTask[]>('/checklist/tasks/my-pending'),

  complete: (id: string, data: { remarks: string; attachmentIds?: string[] }) =>
    apiPatch<ChecklistTask>(`/checklist/tasks/${id}/complete`, data),

  approve: (id: string, data: { remarks?: string }) =>
    apiPatch<ChecklistTask>(`/checklist/tasks/${id}/approve`, data),

  rework: (id: string, data: { reworkRemark: string }) =>
    apiPatch<ChecklistTask>(`/checklist/tasks/${id}/rework`, data),

  bulkComplete: (data: { taskIds: string[]; remarks: string; attachmentIds?: string[] }) =>
    apiPost<{ completed: number }>('/checklist/tasks/bulk-complete', data),
};

// ─── FMS ──────────────────────────────────────────────────────────────────────

export const fmsApi = {
  findWorkflows: () => apiGet<any[]>('/fms/workflows'),

  createWorkflow: (data: { name: string; description?: string; projectId?: string }) =>
    apiPost<any>('/fms/workflows', data),

  addStep: (data: any) => apiPost<any>('/fms/steps', data),

  createAndStart: (data: {
    name: string;
    description?: string;
    projectId?: string;
    steps: { title: string; description?: string; assignedToId?: string; tatHours?: number; role?: string; actionType?: string }[];
  }) => apiPost<any>('/fms/workflows/create-and-start', data),

  findSteps: (params?: Record<string, any>) =>
    apiGet<PaginatedResponse<FmsStep>>('/fms/steps', params),

  completeStep: (id: string, data: { remarks?: string }) =>
    apiPatch<FmsStep>(`/fms/steps/${id}/complete`, data),

  importData: (rows: Record<string, string>[]) =>
    apiPost<{ created: number; errors: string[] }>('/fms/import', { rows }),

  getAnalytics: () =>
    apiGet<{
      total: number;
      completed: number;
      pending: number;
      late: number;
      onTime: number;
      completionRate: number;
      onTimeRate: number;
      workflows: { id: string; name: string; workflowId: string; status: string }[];
    }>('/fms/analytics'),
};

// ─── Approvals ────────────────────────────────────────────────────────────────

export const approvalApi = {
  getQueue: (tab: 'new' | 'rework' = 'new') =>
    apiGet<{ data: ApprovalQueueItem[]; total: number }>('/approvals/queue', { tab }),

  getReworkHistory: () => apiGet<any>('/approvals/rework-history'),

  getCount: () => apiGet<number>('/approvals/count'),

  mySubmissions: () => apiGet<ApprovalMySubmissions>('/approvals/my-submissions'),
};

// ─── MIS ──────────────────────────────────────────────────────────────────────

// /mis uses a DTO with forbidNonWhitelisted — only send the fields it declares
function pickMisParams(params?: Record<string, any>): Record<string, any> | undefined {
  if (!params) return undefined;
  const allowed = ['period', 'dateFrom', 'dateTo', 'userId', 'projectId'];
  const clean = Object.fromEntries(
    allowed
      .filter((k) => params[k] !== '' && params[k] !== undefined && params[k] !== null)
      .map((k) => [k, params[k]]),
  );
  return Object.keys(clean).length ? clean : undefined;
}

// /mis/detailed uses individual @Query() decorators — no DTO, so extra fields are ignored safely
function stripEmpty(params?: Record<string, any>): Record<string, any> | undefined {
  if (!params) return undefined;
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );
  return Object.keys(clean).length ? clean : undefined;
}

export const misApi = {
  get: (params?: Record<string, any>) =>
    apiGet<{ summary: any; cards: UserMisCard[]; period: any }>('/mis', pickMisParams(params)),

  getDetailed: (params: Record<string, any>) =>
    apiGet<any[]>('/mis/detailed', stripEmpty(params)),

  getHistory: (userId?: string) =>
    apiGet<any[]>('/mis/history', userId ? { userId } : undefined),

  saveWeeklyTarget: (data: { userId: string; targetScore: number; notes?: string }) =>
    apiPost<{ message: string }>('/mis/weekly-target', data),

  getKraMaster: (params?: { projectId?: string }) =>
    apiGet<any[]>('/mis/kra-master', params),

  saveSnapshot: () =>
    apiPost<{ message: string }>('/mis/snapshot', {}),
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reportsApi = {
  delegation: (params?: Record<string, any>) =>
    apiGet<PaginatedResponse<DelegationTask>>('/reports/delegation', params),

  workRequests: (params?: Record<string, any>) =>
    apiGet<PaginatedResponse<WorkRequest>>('/reports/work-requests', params),

  checklist: (params?: Record<string, any>) =>
    apiGet<PaginatedResponse<ChecklistTask>>('/reports/checklist', params),

  projects: (params?: Record<string, any>) =>
    apiGet<{ data: any[]; total: number }>('/reports/projects', params),

  performance: (params?: Record<string, any>) =>
    apiGet<{ data: any[]; total: number }>('/reports/performance', params),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  findAll: (params?: { page?: number; limit?: number }) =>
    apiGet<PaginatedResponse<Notification>>('/notifications', params),

  getUnreadCount: () => apiGet<number>('/notifications/unread-count'),

  markRead: (id: string) => apiPatch<void>(`/notifications/${id}/read`),

  markAllRead: () => apiPatch<{ message: string }>('/notifications/mark-all-read'),
};

// ─── Uploads ──────────────────────────────────────────────────────────────────

export const uploadsApi = {
  uploadSingle: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiUpload<UploadResult>('/uploads/single', fd);
  },

  uploadMultiple: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    return apiUpload<UploadResult[]>('/uploads/multiple', fd);
  },

  delete: (publicId: string) =>
    apiDelete<{ message: string }>(`/uploads/${encodeURIComponent(publicId)}`),
};

// ─── Comments ────────────────────────────────────────────────────────────────

export const commentsApi = {
  findByRef: (refId: string) => apiGet<any[]>('/comments', { refId }),
  create: (data: { body: string; refId: string; refType: string; parentId?: string }) =>
    apiPost<any>('/comments', data),
  delete: (id: string) => apiDelete<void>(`/comments/${id}`),
};

// ─── Workflows ────────────────────────────────────────────────────────────────

export const workflowsApi = {
  findAll: () => apiGet<any[]>('/workflows'),
  findOne: (id: string) => apiGet<any>(`/workflows/${id}`),
  create: (data: {
    name: string;
    description?: string;
    projectId?: string;
    steps: { stepNo: number; title: string; assigneeId: string; description?: string; formLink?: string }[];
  }) => apiPost<any>('/workflows', data),
  toggleStatus: (id: string) => apiPatch<any>(`/workflows/${id}/toggle-status`, {}),
  remove: (id: string) => apiDelete<{ message: string }>(`/workflows/${id}`),
};

// ─── Automation ───────────────────────────────────────────────────────────────

export const automationApi = {
  findAll: () => apiGet<any[]>('/automation'),
  create: (data: { name: string; description?: string; trigger: string; action: string }) =>
    apiPost<any>('/automation', data),
  toggle: (id: string) => apiPatch<any>(`/automation/${id}/toggle`, {}),
  remove: (id: string) => apiDelete<{ message: string }>(`/automation/${id}`),
};

// ─── Calendar ─────────────────────────────────────────────────────────────────

export const calendarApi = {
  getEvents: (from: string, to: string) =>
    apiGet<any>('/calendar/events', { from, to }),
};

// ─── Kanban ───────────────────────────────────────────────────────────────────

export const kanbanApi = {
  getBoard: (projectId?: string) =>
    apiGet<any>('/kanban/board', projectId ? { projectId } : undefined),
  moveCard: (taskId: string, status: string) =>
    apiPatch<any>(`/kanban/tasks/${taskId}/move`, { status }),
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchApi = {
  global: (q: string) => apiGet<any>('/search', { q }),
};

// ─── Audit ────────────────────────────────────────────────────────────────────

export const auditApi = {
  findAll: (params?: Record<string, any>) => apiGet<any>('/audit', params),
};

// ─── AI ───────────────────────────────────────────────────────────────────────

export const aiApi = {
  generateWorkflow: (data: { name: string; intent: string; fields?: string[] }) =>
    apiPost<{ jobId: string }>('/ai/generate-workflow', data),
  autofillFields: (name: string, intent?: string) =>
    apiPost<{ fields: string[] }>('/ai/autofill-fields', { name, intent }),
  suggestDescription: (title: string, context?: string) =>
    apiPost<{ suggestion: string }>('/ai/suggest-description', { title, context }),
  getJobStatus: (jobId: string) =>
    apiGet<{ status: string; result?: any }>(`/ai/jobs/${jobId}`),
};

// ─── Bulk Import ───────────────────────────────────────────────────────────────

export type ImportModuleName = 'delegation' | 'workRequest' | 'checklist' | 'fms';
export type ImportMode = 'valid_only' | 'stop_on_error';

export interface ImportColumnDef {
  key: string;
  header: string;
  required: boolean;
  type: string;
  enumValues?: string[];
  description?: string;
  example?: string;
}

export interface ImportModuleInfo {
  moduleName: ImportModuleName;
  label: string;
  maxRows: number;
  requiredPermission: string;
  columns: ImportColumnDef[];
}

export interface ParsedImportRow {
  rowNumber: number;
  rawData: Record<string, unknown>;
  normalizedData?: Record<string, unknown>;
  errors: string[];
  isValid: boolean;
}

export interface ValidationResult {
  batchId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ParsedImportRow[];
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  skippedRows: number;
  status: string;
}

export interface ImportBatchSummary {
  id: string;
  moduleName: ImportModuleName;
  fileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  failedRows: number;
  skippedRows: number;
  importMode: string;
  createdAt: string;
  completedAt?: string;
  uploadedBy: { id: string; fullName: string; email: string };
}

const API_BASE = getApiBaseUrl();

export const bulkImportApi = {
  listModules: () => apiGet<ImportModuleInfo[]>('/bulk-import/modules'),

  getTemplateUrl: (moduleName: ImportModuleName) =>
    `${API_BASE}/bulk-import/templates/${moduleName}`,

  validate: (moduleName: ImportModuleName, file: File, mode: ImportMode = 'valid_only') => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<ValidationResult>(`/bulk-import/validate/${moduleName}?mode=${mode}`, form);
  },

  importBatch: (batchId: string) =>
    apiPost<ImportResult>(`/bulk-import/import/${batchId}`, {}),

  getHistory: (params?: { module?: ImportModuleName; page?: number; limit?: number }) =>
    apiGet<PaginatedResponse<ImportBatchSummary>>('/bulk-import/history', params),

  getBatch: (batchId: string) =>
    apiGet<ImportBatchSummary & { rows: ParsedImportRow[] }>(`/bulk-import/batch/${batchId}`),

  getErrorReportUrl: (batchId: string) =>
    `${API_BASE}/bulk-import/errors/${batchId}`,
};

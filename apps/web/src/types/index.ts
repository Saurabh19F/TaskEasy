// ─── Auth ─────────────────────────────────────────────────────────────────────

export type Role =
  // TS-06 fix: keep in sync with Prisma UserRole enum.
  // Previous union was missing COMPANY_OWNER, AUDITOR, CLIENT, VENDOR.
  | 'SAAS_OWNER'
  | 'COMPANY_OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'TEAM_LEAD'
  | 'EMPLOYEE'
  | 'VIEWER'
  | 'AUDITOR'
  | 'CLIENT'
  | 'VENDOR';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'INTERN'
  | 'CONTRACT'
  | 'FREELANCER'
  | 'PROBATION';

export type WorkMode = 'ONSITE' | 'REMOTE' | 'HYBRID' | 'FIELD';

export type EmployeeStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ON_LEAVE'
  | 'TERMINATED'
  | 'RESIGNED';

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  employeeId?: string;
  phone?: string;
  avatarUrl?: string;
  gender?: Gender;
  dateOfBirth?: string;
  anniversaryDate?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  department?: string;
  designation?: string;
  managerId?: string;
  joiningDate?: string;
  employmentType?: EmploymentType;
  workMode?: WorkMode;
  workLocation?: string;
  employeeStatus?: EmployeeStatus;
  /** Expected daily punch-in/login time, "HH:mm". Required for Manager/Employee/Viewer. */
  punchInTime?: string;
  /** Backup user who covers this person's work if they miss their punch-in window. */
  buddyId?: string;
  buddy?: { id: string; name: string; email: string };
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthUser {
  sub: string;
  id?: string;
  tenantId: string;
  email: string;
  role: Role;
  name: string;
  permissions: string[];
  avatarUrl?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  color?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  createdAt: string;
}

// ─── Delegation ───────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SEND_FOR_APPROVAL'
  | 'REWORK'
  | 'COMPLETED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
export type OnTimeStatus = 'ON_TIME' | 'LATE';

export interface DelegationTask {
  id: string;
  taskId: string;
  tenantId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  targetDate: string;
  actualDate?: string;
  delayDays: number;
  onTimeStatus?: OnTimeStatus;
  reworkCount: number;
  doerRemarks?: string;
  reworkRemark?: string;
  finalRemarks?: string;
  rating?: number;
  delegatedBy: { id: string; name: string };
  delegatedTo: { id: string; name: string; email: string };
  project?: { id: string; name: string; color?: string };
  createdAt: string;
}

// ─── Work Request ─────────────────────────────────────────────────────────────

export interface WorkRequest {
  id: string;
  requestId: string;
  tenantId: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'SEND_FOR_APPROVAL' | 'REWORK' | 'COMPLETED';
  deadlineDate: string;
  delayDays: number;
  onTimeStatus?: OnTimeStatus;
  reworkCount: number;
  doerRemarks?: string;
  requestedBy: { id: string; name: string };
  requestFor: { id: string; name: string; email: string };
  project?: { id: string; name: string };
  createdAt: string;
}

// ─── Checklist ────────────────────────────────────────────────────────────────

export type ChecklistFrequency =
  | 'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'
  | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'ONE_TIME';

export interface ChecklistTask {
  id: string;
  taskId: string;
  tenantId: string;
  title: string;
  frequency: ChecklistFrequency;
  status: 'PENDING' | 'SEND_FOR_APPROVAL' | 'REWORK' | 'COMPLETED' | 'LATE';
  plannedDate: string;
  actualDate?: string;
  delayDays: number;
  onTimeStatus?: OnTimeStatus;
  attachmentRequired: boolean;
  remarks?: string;
  assignedTo: { id: string; name: string };
  project?: { id: string; name: string };
  master?: { frequency: ChecklistFrequency; attachmentRequired: boolean };
}

// ─── Approvals ────────────────────────────────────────────────────────────────

export type ApprovalItemType = 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST';

export interface ApprovalQueueItem {
  id: string;
  type: ApprovalItemType;
  taskId?: string;
  title: string;
  status: string;
  submittedBy?: { id: string; name: string };
  submittedAt?: string | null;
  doerRemarks?: string | null;
  doerAttachmentIds?: string[];
  targetDate?: string;
  reworkCount?: number;
  priority?: string;
  projectName?: string;
}

export interface ApprovalMySubmissions {
  delegations: DelegationTask[];
  workRequests: WorkRequest[];
  checklists: ChecklistTask[];
}

// ─── FMS ──────────────────────────────────────────────────────────────────────

export interface FmsStep {
  id: string;
  tenantId: string;
  title: string;
  stepNo: number;
  status: 'PENDING' | 'SEND_FOR_APPROVAL' | 'REWORK' | 'COMPLETED' | 'LATE';
  plannedDate: string;
  actualDate?: string;
  delayDays: number;
  onTimeStatus?: OnTimeStatus;
  formLink?: string;
  remarks?: string;
  workflow: { id: string; name: string };
  assignedTo: { id: string; name: string };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface ModuleMetrics {
  total: number;
  done: number;
  pending: number;
  delayed: number;
}

export interface TrendPoint {
  label: string;
  completed: number;
  pending: number;
  delayed: number;
}

export interface ProjectWiseStatus {
  projectId: string;
  projectName: string;
  completion: number;
  delegation: { pending: number; done: number; total: number };
  workRequest: { pending: number; done: number; total: number };
  checklist?: { pending: number; done: number; total: number };
  fms?: { pending: number; done: number; total: number };
}

export interface FmsWiseStatus {
  fmsId: string;
  fmsName: string;
  pending: number;
  done: number;
  total: number;
}

export interface PersonalPriorityTask {
  id: string;
  title: string;
  type: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS';
  dueDate: string;
  isCompleted: boolean;
  fromSystem?: boolean;
  assignedBy?: string;
}

export interface DashboardData {
  delegation: ModuleMetrics;
  workRequest: ModuleMetrics;
  checklist: ModuleMetrics;
  fms: ModuleMetrics;
  criticalTasks: DelegationTask[];
  criticalWorkRequests?: WorkRequest[];
  criticalChecklists?: ChecklistTask[];
  criticalFms?: FmsStep[];
  approvalPending: number;
  trend: TrendPoint[];
  lastUpdated: string;
  projectWiseStatus?: ProjectWiseStatus[];
  fmsWiseStatus?: FmsWiseStatus[];
  personalPriority?: PersonalPriorityTask[];
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  refType?: string;
  refId?: string;
  createdAt: string;
}

export interface NotificationCounts {
  delegation: number;
  workRequest: number;
  checklist: number;
  fms: number;
  approval: number;
  total: number;
}

// ─── MIS ──────────────────────────────────────────────────────────────────────

export type MisGrade = 'A_PLUS' | 'A' | 'B' | 'C' | 'D' | 'N_A';

export interface CategoryKPIs {
  completedAsPerPlan: number;
  completedOnTime: number;
  noDelay: number;
}

export interface MisCategoryRaw {
  total: number;
  completed: number;
  pending: number;
  onTime: number;
  late: number;
  delayDays: number;
}

export interface MisSummaryRow {
  total: number;
  pending: number;
  score: number;
  grade: string;
  hrs: number;
}

export interface UserMisCard {
  userId: string;
  name: string;
  email: string;
  role: string;
  metrics: {
    total: number;
    completed: number;
    pending: number;
    late: number;
    onTime: number;
    reworkCount: number;
    onTimePercent: number;
    delayDays: number;
  };
  score: number;
  grade: MisGrade;
  lastWeekTarget?: number;
  /** Count of currently active/in-progress tasks shown as a badge on the card */
  activeTasksCount?: number;
  /** Row-level breakdown for the mini summary table inside the card */
  cardSummary?: {
    total: MisSummaryRow;
    checklist: MisSummaryRow;
    task: MisSummaryRow;
  };
  /** Per-category KPI percentages (can be negative for underperformance) */
  categoryMetrics?: {
    del: CategoryKPIs;
    wor: CategoryKPIs;
    che: CategoryKPIs;
    fms: CategoryKPIs;
  };
  /** Raw per-category task counts for the breakdown table */
  categoryRaw?: {
    del: MisCategoryRaw;
    wor: MisCategoryRaw;
    che: MisCategoryRaw;
    fms: MisCategoryRaw;
  };
}

// ─── Hierarchy ────────────────────────────────────────────────────────────────

export interface HierarchyGroup {
  id: string;
  groupName: string;
  adminId: string;
  memberIds: string[];
  description?: string;
  admin: { id: string; name: string; email: string; role: string };
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  originalName: string;
  mimeType: string;
  size: number;
  format: string;
}

// ─── Platform Admin Console ──────────────────────────────────────────────────

export type PlatformRole =
  | 'PLATFORM_ADMIN'
  | 'SUPPORT_AGENT'
  | 'BILLING_MANAGER'
  | 'SALES_MANAGER'
  | 'PLATFORM_AUDITOR';

export interface PlatformAuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: PlatformRole | string;
  permissions: string[];
  status?: string;
}

export interface PlatformCompany {
  id: string;
  companyName: string;
  ownerName?: string | null;
  email?: string | null;
  phone?: string | null;
  industry?: string | null;
  plan: string;
  status: string;
  totalUsers: number;
  totalEmployees: number;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  createdDate: string;
  lastLoginAt?: string | null;
  modulesEnabled?: number;
  lastActivityAt?: string | null;
  storageUsedBytes?: number;
  apiUsageCount?: number;
  openTickets?: number;
  paymentStatus?: string;
  auditCount?: number;
}

export interface PlatformPlan {
  id: string;
  name: string;
  tier: string;
  price: number;
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  currency?: string;
  description?: string | null;
  maxUsers: number;
  maxProjects: number;
  maxFmsWorkflows: number;
  maxEmployees?: number | null;
  maxTasks?: number | null;
  storageLimitGb?: number | null;
  attendanceAccess?: boolean;
  leaveAccess?: boolean;
  payrollAccess?: boolean;
  reportsAccess?: boolean;
  aiAccess?: boolean;
  supportLevel?: string | null;
  status?: string;
  features?: string[];
  isActive?: boolean;
}

export interface PlatformSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: string;
  trialEndsAt?: string | null;
  graceEndsAt?: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  billingCycle?: string | null;
  autoRenew?: boolean;
  plan?: PlatformPlan;
}

export interface PlatformInvoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  planName: string;
  amount: number;
  tax: number;
  discount: number;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  paymentDate?: string | null;
  dueDate?: string | null;
  nextBillingDate?: string | null;
  pdfUrl?: string | null;
  notes?: string | null;
}

export interface PlatformPayment {
  id: string;
  invoiceId: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  method: string;
  status: string;
  gatewayRef?: string | null;
  paymentDate?: string | null;
  failureReason?: string | null;
}

export interface PlatformSupportTicket {
  id: string;
  ticketId: string;
  tenantId: string;
  tenantName: string;
  createdByName: string;
  createdByEmail: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assignedTo?: string | null;
  internalNotes?: string | null;
  responseCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAuditLog {
  id: string;
  action: string;
  actorId: string;
  actorRole: string;
  targetTenantId?: string | null;
  targetUserId?: string | null;
  ipAddress?: string | null;
  device?: string | null;
  browser?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  createdAt: string;
}

export interface PlatformNotification {
  id: string;
  title: string;
  body: string;
  audience: string;
  type: string;
  channel: string;
  targetTenantIds: string[];
  status: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export interface PlatformSecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  tenantId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  device?: string | null;
  browser?: string | null;
  description: string;
  resolved: boolean;
  createdAt: string;
}

export interface PlatformBackupJob {
  id: string;
  scope: string;
  frequency: string;
  status: string;
  targetTenantId?: string | null;
  requestedById?: string | null;
  storageUrl?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPlatformUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: PlatformRole | string;
  status: string;
  permissions: string[];
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformDashboardData {
  stats: {
    totalCompanies: number;
    activeCompanies: number;
    trialCompanies: number;
    suspendedCompanies: number;
    expiredCompanies: number;
    paymentPendingCompanies: number;
    totalPlatformUsers: number;
    totalEmployees: number;
    monthlyRecurringRevenue: number;
    pendingPayments: number;
    failedPayments: number;
    openSupportTickets: number;
    systemHealth: { score: number; maintenanceMode: boolean; recentFailures: number; recentBackups: number };
  };
  charts: {
    revenueGrowth: { label: string; value: number }[];
    companyGrowth: { label: string; value: number }[];
    activeVsSuspended: { label: string; value: number }[];
    trialToPaid: { label: string; value: number }[];
    planWiseCompanies: { label: string; value: number }[];
    moduleUsage: { label: string; value: number }[];
    loginActivity: { label: string; value: number }[];
    churnRiskCompanies: PlatformCompany[];
  };
  tables: {
    recentlyOnboardedCompanies: PlatformCompany[];
    recentlyExpiredSubscriptions: Array<{
      id: string;
      tenantId: string;
      tenantName: string | null;
      planName: string;
      status: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      trialEndsAt?: string | null;
      graceEndsAt?: string | null;
      autoRenew?: boolean;
    } | null>;
    recentPayments: PlatformPayment[];
    recentPlatformActivity: PlatformAuditLog[];
  };
}

export interface PlatformSettings {
  [key: string]: unknown;
}

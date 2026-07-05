// ─── Roles ────────────────────────────────────────────────────────────────────

export type Role =
  | 'SAAS_OWNER'
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'TEAM_LEAD'
  | 'EMPLOYEE'
  | 'VIEWER'
  | 'AUDITOR';

// ─── Task ─────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SEND_FOR_APPROVAL'
  | 'REWORK'
  | 'COMPLETED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
export type OnTimeStatus = 'ON_TIME' | 'LATE';

// ─── Checklist ────────────────────────────────────────────────────────────────

export type ChecklistFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'FORTNIGHTLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY'
  | 'ONE_TIME';

// ─── MIS ──────────────────────────────────────────────────────────────────────

export type MisGrade = 'A_PLUS' | 'A' | 'B' | 'C' | 'D';

// ─── Projects ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_APPROVED'
  | 'REWORK_REQUESTED'
  | 'APPROVAL_PENDING'
  | 'CHECKLIST_DUE'
  | 'FMS_STEP_DUE'
  | 'ESCALATION'
  | 'GENERAL';

// ─── Automation ───────────────────────────────────────────────────────────────

export type AutomationTrigger =
  | 'TASK_OVERDUE'
  | 'TASK_COMPLETED'
  | 'TASK_ASSIGNED'
  | 'REWORK_REQUESTED'
  | 'CHECKLIST_DUE'
  | 'MIS_SCORE_BELOW';

export type AutomationAction =
  | 'SEND_EMAIL'
  | 'SEND_NOTIFICATION'
  | 'ESCALATE_TO_MANAGER'
  | 'AUTO_REASSIGN'
  | 'SLACK_NOTIFY'
  | 'WEBHOOK';

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

// ─── Period ───────────────────────────────────────────────────────────────────

export type Period =
  | 'TODAY'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_QUARTER'
  | 'THIS_YEAR';

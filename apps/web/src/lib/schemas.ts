import { z } from 'zod';

/**
 * Shared Zod schemas for the create/assign forms. Centralised here so the
 * validation rules (and their messages) live in one place instead of being
 * re-derived as ad-hoc `if (!field) return` checks on every page.
 */

// ─── Delegation ────────────────────────────────────────────────────────────────

export const delegationSchema = z.object({
  delegatedToIds: z.array(z.string()).min(1, 'Select at least one person to delegate to'),
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().trim().min(5, 'Task title must be at least 5 characters'),
  description: z.string().optional(),
  targetDate: z.string().min(1, 'Target date is required'),
  targetTime: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']),
});
export type DelegationFormValues = z.infer<typeof delegationSchema>;

const delegationTaskDraftSchema = z.object({
  title: z.string().trim().min(5, 'Task title must be at least 5 characters'),
  description: z.string().optional(),
  targetDate: z.string().min(1, 'Target date is required'),
  targetTime: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']),
  attachmentIds: z.array(z.string()).default([]),
});

export const delegationBulkSchema = z.object({
  delegatedToIds: z.array(z.string()).min(1, 'Select at least one person to delegate to'),
  projectId: z.string().min(1, 'Project is required'),
  tasks: z.array(delegationTaskDraftSchema).min(1, 'Add at least one task'),
});
export type DelegationBulkFormValues = z.infer<typeof delegationBulkSchema>;

export const delegationSubmitSchema = z.object({
  doerRemarks: z.string().trim().min(1, 'Remarks are required to mark this done'),
});
export type DelegationSubmitFormValues = z.infer<typeof delegationSubmitSchema>;

// ─── Work Request ──────────────────────────────────────────────────────────────

export const workRequestSchema = z.object({
  requestForId: z.string().min(1, 'Please select who this request is for'),
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().optional(),
  deadlineDate: z.string().min(1, 'Deadline date is required'),
  deadlineTime: z.string().optional(),
});
export type WorkRequestFormValues = z.infer<typeof workRequestSchema>;

// ─── Checklist ──────────────────────────────────────────────────────────────────

export const checklistSchema = z.object({
  assignedToIds: z.array(z.string()).min(1, 'Select at least one employee'),
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().trim().min(1, 'Task title is required'),
  frequency: z.enum(['DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME']),
  startDate: z.string().min(1, 'Start date is required'),
  startTime: z.string().optional(),
  attachmentRequired: z.boolean(),
});
export type ChecklistFormValues = z.infer<typeof checklistSchema>;

// ─── Generic "remarks" form (checklist complete / bulk-complete) ───────────────

export const remarksSchema = z.object({
  remarks: z.string().trim().min(1, 'Remarks are required'),
});
export type RemarksFormValues = z.infer<typeof remarksSchema>;

// ─── Projects ───────────────────────────────────────────────────────────────────

export const projectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required'),
  description: z.string().optional(),
  color: z.string().optional(),
});
export type ProjectFormValues = z.infer<typeof projectSchema>;

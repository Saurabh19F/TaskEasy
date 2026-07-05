import { ImportModuleConfig } from '../interfaces/import.interfaces';

export const DELEGATION_CONFIG: ImportModuleConfig = {
  moduleName: 'delegation',
  label: 'Delegation Tasks',
  requiredPermission: 'delegation.import',
  maxRows: 500,
  columns: [
    { key: 'title',        header: 'Task Title',       required: true,  type: 'string', description: 'Short task name', example: 'Review Q1 report' },
    { key: 'delegateTo',   header: 'Delegate To Email', required: true,  type: 'email',  description: 'Email of assignee', example: 'john@company.com' },
    { key: 'priority',     header: 'Priority',         required: true,  type: 'enum',   enumValues: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'MEDIUM' },
    { key: 'targetDate',   header: 'Target Date',      required: true,  type: 'date',   description: 'YYYY-MM-DD', example: '2026-07-15' },
    { key: 'description',  header: 'Description',      required: false, type: 'string', example: 'Optional details' },
    { key: 'projectName',  header: 'Project Name',     required: false, type: 'string', description: 'Must match an existing project name', example: 'Alpha Project' },
    { key: 'tags',         header: 'Tags',             required: false, type: 'string', description: 'Comma-separated', example: 'finance,urgent' },
  ],
  lookupSheets: [
    { title: 'Priority Values',  headers: ['Priority'],     dynamicRows: false },
    { title: 'Users',            headers: ['Name', 'Email'], dynamicRows: true  },
    { title: 'Projects',         headers: ['Project Name'],  dynamicRows: true  },
  ],
  sampleRows: [
    { title: 'Review Q1 report', delegateTo: 'john@company.com', priority: 'HIGH', targetDate: '2026-07-15', description: 'Check numbers', projectName: '', tags: 'finance' },
    { title: 'Submit audit docs', delegateTo: 'jane@company.com', priority: 'MEDIUM', targetDate: '2026-07-20', description: '', projectName: 'Alpha Project', tags: '' },
  ],
};

export const WORK_REQUEST_CONFIG: ImportModuleConfig = {
  moduleName: 'workRequest',
  label: 'Work Requests',
  requiredPermission: 'workRequest.import',
  maxRows: 500,
  columns: [
    { key: 'title',           header: 'Request Title',     required: true,  type: 'string', example: 'Fix HVAC unit 3' },
    { key: 'requestedFor',    header: 'Requested For Email', required: true, type: 'email',  example: 'ops@company.com' },
    { key: 'priority',        header: 'Priority',          required: true,  type: 'enum',   enumValues: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'HIGH' },
    { key: 'deadlineDate',    header: 'Deadline Date',     required: false, type: 'date',   description: 'YYYY-MM-DD', example: '2026-07-30' },
    { key: 'description',     header: 'Description',       required: false, type: 'string', example: 'Unit not cooling' },
    { key: 'approvalRequired', header: 'Approval Required', required: false, type: 'enum',  enumValues: ['YES', 'NO'], example: 'NO' },
  ],
  lookupSheets: [
    { title: 'Priority Values',  headers: ['Priority'],       dynamicRows: false },
    { title: 'Users',            headers: ['Name', 'Email'],   dynamicRows: true  },
  ],
  sampleRows: [
    { title: 'Fix HVAC unit 3', requestedFor: 'ops@company.com', priority: 'HIGH', deadlineDate: '2026-07-30', description: 'Unit not cooling', approvalRequired: 'NO' },
    { title: 'Replace filter',  requestedFor: 'ops@company.com', priority: 'MEDIUM', deadlineDate: '', description: '', approvalRequired: 'YES' },
  ],
};

export const CHECKLIST_CONFIG: ImportModuleConfig = {
  moduleName: 'checklist',
  label: 'Checklist Masters',
  requiredPermission: 'checklist.import',
  maxRows: 200,
  columns: [
    { key: 'masterTitle',   header: 'Checklist Title',  required: true,  type: 'string', description: 'Groups rows under one master', example: 'Daily Safety Round' },
    { key: 'taskTitle',     header: 'Task Title',       required: true,  type: 'string', example: 'Check fire extinguisher' },
    { key: 'assignedTo',    header: 'Assigned To Email', required: true, type: 'email',  example: 'safety@company.com' },
    { key: 'frequency',     header: 'Frequency',        required: true,  type: 'enum',   enumValues: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'], example: 'DAILY' },
    { key: 'startDate',     header: 'Start Date',       required: true,  type: 'date',   description: 'YYYY-MM-DD', example: '2026-07-01' },
    { key: 'taskDescription', header: 'Task Description', required: false, type: 'string', example: 'Verify seal and gauge' },
  ],
  lookupSheets: [
    { title: 'Frequency Values', headers: ['Frequency'],      dynamicRows: false },
    { title: 'Users',            headers: ['Name', 'Email'],   dynamicRows: true  },
  ],
  sampleRows: [
    { masterTitle: 'Daily Safety Round', taskTitle: 'Check fire extinguisher', assignedTo: 'safety@company.com', frequency: 'DAILY', startDate: '2026-07-01', taskDescription: 'Verify seal and gauge' },
    { masterTitle: 'Daily Safety Round', taskTitle: 'Inspect emergency exits', assignedTo: 'safety@company.com', frequency: 'DAILY', startDate: '2026-07-01', taskDescription: '' },
  ],
};

export const FMS_CONFIG: ImportModuleConfig = {
  moduleName: 'fms',
  label: 'FMS Workflows',
  requiredPermission: 'fms.import',
  maxRows: 300,
  columns: [
    { key: 'workflowName',   header: 'Workflow Name',    required: true,  type: 'string', description: 'Groups rows under one workflow', example: 'Onboarding Flow' },
    { key: 'category',       header: 'Category',         required: false, type: 'string', example: 'HR' },
    { key: 'description',    header: 'Workflow Description', required: false, type: 'string', example: 'New hire setup steps' },
    { key: 'stepNo',         header: 'Step No',          required: true,  type: 'number', example: '1' },
    { key: 'stepName',       header: 'Step Name',        required: true,  type: 'string', example: 'Create credentials' },
    { key: 'what',           header: 'What',             required: true,  type: 'string', example: 'Set up email & system access' },
    { key: 'how',            header: 'How',              required: false, type: 'string', example: 'Use admin portal' },
    { key: 'when',           header: 'When',             required: false, type: 'string', example: 'Day 1 morning' },
    { key: 'assignedTo',     header: 'Assigned To Email', required: false, type: 'email', example: 'it@company.com' },
    { key: 'slaHours',       header: 'SLA Hours',        required: false, type: 'number', example: '4' },
    { key: 'approvalRequired', header: 'Approval Required', required: false, type: 'enum', enumValues: ['YES', 'NO'], example: 'NO' },
    { key: 'dependsOnSteps', header: 'Depends On Steps', required: false, type: 'string', description: 'Comma-separated step numbers', example: '1,2' },
  ],
  lookupSheets: [
    { title: 'Users', headers: ['Name', 'Email'], dynamicRows: true },
  ],
  sampleRows: [
    { workflowName: 'Onboarding Flow', category: 'HR', description: 'New hire setup', stepNo: 1, stepName: 'Create credentials', what: 'Set up email & system access', how: 'Use admin portal', when: 'Day 1', assignedTo: 'it@company.com', slaHours: 4, approvalRequired: 'NO', dependsOnSteps: '' },
    { workflowName: 'Onboarding Flow', category: 'HR', description: 'New hire setup', stepNo: 2, stepName: 'Issue equipment', what: 'Assign laptop & badge', how: 'IT room', when: 'Day 1', assignedTo: 'it@company.com', slaHours: 2, approvalRequired: 'YES', dependsOnSteps: '1' },
  ],
};

export const MODULE_CONFIGS: Record<string, ImportModuleConfig> = {
  delegation: DELEGATION_CONFIG,
  workRequest: WORK_REQUEST_CONFIG,
  checklist: CHECKLIST_CONFIG,
  fms: FMS_CONFIG,
};

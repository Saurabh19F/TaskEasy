import { DelegationTask } from '../models/DelegationTask.js';
import { WorkRequest } from '../models/WorkRequest.js';
import { ChecklistTask } from '../models/ChecklistTask.js';
import { ChecklistWorkMaster } from '../models/ChecklistWorkMaster.js';
import { HierarchyGroup } from '../models/HierarchyGroup.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { MisHistory } from '../models/MisHistory.js';
import { AppSetting } from '../models/AppSetting.js';
import { FmsFlow } from '../models/FmsFlow.js';
import { calculateDelay, getDateRangeYmd, isDateInRange } from '../utils/dateFilters.js';
import { withLock } from '../utils/mutex.js';
import { fetchFmsRows, markFmsDoneByRow } from './fmsSheetsService.js';
import { composeProfessionalEmailTemplate, sendEmail } from './notificationService.js';

function clean(value) {
  return String(value || '').trim().toLowerCase();
}

const IST_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const istFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

function getIstParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = Object.fromEntries(istFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour || 0),
    minute: Number(parts.minute || 0),
    second: Number(parts.second || 0)
  };
}

function makeIstDate(year, month, day, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - IST_OFFSET_MS);
}

function parseDateInIst(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const isLocalDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(raw);
  const normalized =
    !hasExplicitZone && (isDateOnly || isLocalDateTime)
      ? `${isDateOnly ? `${raw}T00:00:00` : raw}+05:30`
      : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfIstDay(value = new Date()) {
  const parts = getIstParts(value);
  return makeIstDate(parts.year, parts.month, parts.day);
}

function getIstDayKey(value = new Date()) {
  const parts = getIstParts(value);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function applyIstTimeToDay(dayValue, timeSourceValue) {
  const day = getIstParts(dayValue);
  const time = getIstParts(timeSourceValue);
  return makeIstDate(day.year, day.month, day.day, time.hour, time.minute, time.second);
}

function getContextUser(context = {}) {
  return context?.user || null;
}

function getCompanyScope(context = {}) {
  const user = getContextUser(context);
  if (!user || user.isAppAdmin || user.role === 'App Admin' || !user.companyId) {
    return {};
  }
  return { companyId: user.companyId };
}

async function getUserByName(name, context = {}) {
  if (!name) return null;
  return User.findOne({ ...getCompanyScope(context), name }).lean();
}

async function getTeamMembersWithManager(userName, userRole, context = {}) {
  const companyScope = getCompanyScope(context);

  if (userRole === 'Super Admin') {
    const users = await User.find({ ...companyScope, status: 'Active' }).select('name').lean();
    return users.map((u) => u.name);
  }

  if (userRole === 'Employee') return [userName];

  const admin = await User.findOne({ ...companyScope, name: userName }).select('_id').lean();
  if (!admin) return [userName];

  const group = await HierarchyGroup.findOne({ ...companyScope, adminUser: admin._id }).populate('employeeUsers', 'name').lean();
  if (!group) return [userName];

  return [userName, ...group.employeeUsers.map((x) => x.name)];
}

function isObjectIdLike(value) {
  return /^[a-f\d]{24}$/i.test(String(value || '').trim());
}

function buildRecordIdQuery(id, legacyField) {
  const text = String(id ?? '').trim();
  if (!text) return null;
  if (isObjectIdLike(text)) return { _id: text };

  const numeric = Number(text);
  if (Number.isInteger(numeric) && numeric >= 0) {
    return { [legacyField]: numeric };
  }

  return null;
}

function normalizeFilesAndContext(filesData, context) {
  if (filesData && typeof filesData === 'object' && !Array.isArray(filesData) && filesData.user && !context?.user) {
    return { filesData: [], context: filesData };
  }

  return {
    filesData: Array.isArray(filesData) ? filesData : [],
    context
  };
}

function normalizePlanDateAndContext(planDate, context) {
  if (planDate && typeof planDate === 'object' && planDate.user && !context?.user) {
    return { planDate: null, context: planDate };
  }
  return { planDate, context };
}

function normalizeAttachmentUrls(filesData = []) {
  return (Array.isArray(filesData) ? filesData : [])
    .map((file) => file?.url || file?.fileUrl || file?.fileName)
    .filter(Boolean);
}

function buildSubmitScopeQuery(fieldName, context = {}) {
  const user = getContextUser(context);
  if (!user?._id || user.isAppAdmin || user.role === 'App Admin') {
    return null;
  }
  return { [fieldName]: user._id };
}

async function buildApprovalScopeQuery(fieldName, context = {}) {
  const user = getContextUser(context);
  if (!user?._id || user.isAppAdmin || user.role === 'App Admin' || !['Admin', 'Super Admin'].includes(user.role)) {
    return null;
  }

  const companyScope = getCompanyScope(context);
  const members = await getTeamMembersWithManager(user.name, user.role, context);
  const users = await User.find({ ...companyScope, name: { $in: members } }).select('_id').lean();
  const visibleUserIds = users.map((item) => item._id);
  if (!visibleUserIds.length) return null;

  return { [fieldName]: { $in: visibleUserIds } };
}

function isUserVisible(recordName, visibleNamesSet, userRole, currentUserName) {
  if (userRole === 'Super Admin') return true;
  const current = clean(currentUserName);
  const record = clean(recordName);
  return record === current || visibleNamesSet.has(record);
}

function matchesEmployeeFilter(recordName, filters = {}) {
  const employee = String(filters.employee || '').trim();
  if (!employee || employee === 'All Team' || employee === 'All Employees') {
    return true;
  }
  return clean(recordName) === clean(employee);
}

function matchesCommonFilters(entity, filters, dateField) {
  const { from, to } = getDateRangeYmd(filters);

  if (filters.project && filters.project !== 'All Projects') {
    if (!entity.project || entity.project.name !== filters.project) {
      return false;
    }
  }

  if (filters.status && filters.status !== 'All Statuses') {
    if (clean(entity.status) !== clean(filters.status)) {
      return false;
    }
  }

  if (dateField && !isDateInRange(entity[dateField], from, to)) {
    return false;
  }

  return true;
}

function toMetricBucket() {
  return { total: 0, done: 0, pending: 0, tasksDelayed: 0, totalDelayDays: 0, doneOnTime: 0 };
}

async function sendWorkflowMailSafe({
  toUser,
  companyId = null,
  category = 'Notification',
  action = 'Status Update',
  title = '',
  body = '',
  details = {}
} = {}) {
  const recipient = toUser && typeof toUser === 'object' ? toUser : null;
  if (!recipient?.email) return;

  try {
    const tpl = await composeProfessionalEmailTemplate({
      category,
      action,
      recipientName: recipient.name || 'Team Member',
      title,
      body,
      details
    });

    await sendEmail({
      to: recipient.email,
      companyId: companyId || recipient.companyId || null,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text
    });
  } catch (error) {
    console.error('[mail] workflow notification failed:', error?.message || error);
  }
}

async function getDashboardPageData(userName, userRole, filters = {}, context = {}) {
  const companyScope = getCompanyScope(context);
  const teamMembers = await getTeamMembersWithManager(userName, userRole, context);
  const visible = new Set(teamMembers.map(clean));
  const visibleUsers = await User.find({ ...companyScope, name: { $in: teamMembers } }).select('_id').lean();
  const visibleUserIds = new Set(visibleUsers.map((u) => String(u._id)));
  const visibleUserIdList = [...visibleUserIds];

  const [delegations, workRequests, checklists, fmsRows] = await Promise.all([
    DelegationTask.find({ delegatedToUser: { $in: visibleUserIdList } })
      .select('description project targetDate status onTimeStatus totalDelays delay priority delegatedToUser createdAt completedDate approvalDate')
      .populate('project', 'name')
      .populate('delegatedToUser', 'name')
      .lean(),
    WorkRequest.find({ requestForUser: { $in: visibleUserIdList } })
      .select('description project deadline status onTimeStatus delayDays requestForUser')
      .populate('project', 'name')
      .populate('requestForUser', 'name')
      .lean(),
    ChecklistTask.find({ user: { $in: visibleUserIdList } })
      .select('description project planDate actualDate approvalStatus onTimeStatus totalDelay user')
      .populate('project', 'name')
      .populate('user', 'name')
      .lean(),
    getFmsTasksForEmployee(userName, userRole, { ...filters, status: 'All Statuses' }, context)
  ]);

  const metrics = {
    delegation: toMetricBucket(),
    workRequest: toMetricBucket(),
    checklist: toMetricBucket(),
    fms: toMetricBucket()
  };

  const feed = [];
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  for (const d of delegations) {
    if (!visibleUserIds.has(String(d.delegatedToUser?._id || ''))) continue;
    const targetName = d.delegatedToUser?.name;
    if (!isUserVisible(targetName, visible, userRole, userName)) continue;
    if (!matchesEmployeeFilter(targetName, filters)) continue;
    if (!matchesCommonFilters({ ...d, status: d.status }, filters, 'targetDate')) continue;

    metrics.delegation.total += 1;
    const status = clean(d.status);
    const done = status === 'completed';
    if (done) metrics.delegation.done += 1;
    else metrics.delegation.pending += 1;

    if (done && clean(d.onTimeStatus) === 'late') {
      metrics.delegation.tasksDelayed += 1;
      metrics.delegation.totalDelayDays += Number(d.totalDelays || d.delay || 0);
    } else if (done) {
      metrics.delegation.doneOnTime += 1;
    } else if (!done && d.targetDate && new Date(d.targetDate) < todayStart) {
      // Pending task past its due date counts as delayed
      metrics.delegation.tasksDelayed += 1;
    }

    if (!done || status === 'rework') {
      feed.push({
        type: 'Delegation',
        id: d._id.toString(),
        description: d.description,
        project: d.project?.name || '',
        targetDate: d.targetDate,
        priority: d.priority || 'Medium',
        status: d.status
      });
    }
  }

  for (const w of workRequests) {
    if (!visibleUserIds.has(String(w.requestForUser?._id || ''))) continue;
    const targetName = w.requestForUser?.name;
    if (!isUserVisible(targetName, visible, userRole, userName)) continue;
    if (!matchesEmployeeFilter(targetName, filters)) continue;
    if (!matchesCommonFilters({ ...w, status: w.status }, filters, 'deadline')) continue;

    metrics.workRequest.total += 1;
    const status = clean(w.status);
    const done = status === 'completed';
    if (done) metrics.workRequest.done += 1;
    else metrics.workRequest.pending += 1;

    if (done && clean(w.onTimeStatus) === 'late') {
      metrics.workRequest.tasksDelayed += 1;
      metrics.workRequest.totalDelayDays += Number(w.delayDays || 0);
    } else if (done) {
      metrics.workRequest.doneOnTime += 1;
    } else if (!done && w.deadline && new Date(w.deadline) < todayStart) {
      // Pending work request past its deadline counts as delayed
      metrics.workRequest.tasksDelayed += 1;
    }

    if (!done || status === 'rework') {
      feed.push({
        type: 'Work Request',
        id: w._id.toString(),
        description: w.description,
        project: w.project?.name || '',
        targetDate: w.deadline,
        priority: 'Medium',
        status: w.status
      });
    }
  }

  for (const c of checklists) {
    if (!visibleUserIds.has(String(c.user?._id || ''))) continue;
    const targetName = c.user?.name;
    if (!isUserVisible(targetName, visible, userRole, userName)) continue;
    if (!matchesEmployeeFilter(targetName, filters)) continue;
    if (!matchesCommonFilters({ ...c, status: c.approvalStatus }, filters, 'planDate')) continue;

    metrics.checklist.total += 1;
    const done = Boolean(c.actualDate);
    if (done) metrics.checklist.done += 1;
    else metrics.checklist.pending += 1;

    if (done && clean(c.onTimeStatus) === 'late') {
      metrics.checklist.tasksDelayed += 1;
      metrics.checklist.totalDelayDays += Number(c.totalDelay || 0);
    } else if (done) {
      metrics.checklist.doneOnTime += 1;
    } else if (!done && c.planDate && new Date(c.planDate) < todayStart) {
      // Pending checklist task past its plan date counts as delayed
      metrics.checklist.tasksDelayed += 1;
    }

    if (!done) {
      feed.push({
        type: 'Checklist',
        id: c._id.toString(),
        description: c.description,
        project: c.project?.name || '',
        targetDate: c.planDate,
        priority: 'Medium',
        status: c.approvalStatus
      });
    }
  }

  const fmsSummaryMap = {};
  for (const f of fmsRows || []) {
    if (!matchesEmployeeFilter(f.who, filters)) continue;
    if (!matchesCommonFilters({ ...f, status: f.status }, filters, 'plannedDate')) continue;

    const fmsName = String(f.fmsName || 'Others').trim() || 'Others';
    if (!fmsSummaryMap[fmsName]) {
      fmsSummaryMap[fmsName] = { name: fmsName, pending: 0, completed: 0, total: 0 };
    }

    metrics.fms.total += 1;
    fmsSummaryMap[fmsName].total += 1;

    const done = clean(f.status) === 'completed';
    if (done) {
      metrics.fms.done += 1;
      fmsSummaryMap[fmsName].completed += 1;
    } else {
      metrics.fms.pending += 1;
      fmsSummaryMap[fmsName].pending += 1;
      feed.push({
        type: 'FMS',
        id: String(f.rowId || ''),
        description: f.taskName || f.fmsName || 'FMS Task',
        project: f.fmsName || '',
        targetDate: f.plannedDate || '',
        priority: 'Medium',
        status: f.status
      });
    }

    if (done && clean(f.onTimeStatus) === 'late') {
      metrics.fms.tasksDelayed += 1;
      metrics.fms.totalDelayDays += Number(f.delayDays || 0);
    } else if (done) {
      metrics.fms.doneOnTime += 1;
    } else if (!done && (f.plannedDate || f.planDate) && new Date(f.plannedDate || f.planDate) < todayStart) {
      // Pending FMS task past its planned date counts as delayed
      metrics.fms.tasksDelayed += 1;
    }
  }

  feed.sort((a, b) => {
    const pa = clean(a.priority);
    const pb = clean(b.priority);
    const rank = { high: 1, medium: 2, low: 3 };
    return (rank[pa] || 4) - (rank[pb] || 4);
  });

  // --- Build projectStatus (Project Wise Status table) ---
  const projectStatsMap = {};
  const getProjectEntry = (projName) => {
    if (!projName) return null;
    const key = String(projName).trim().toLowerCase();
    if (!projectStatsMap[key]) {
      projectStatsMap[key] = {
        displayName: String(projName).trim(),
        pending_delegation: 0, completed_delegation: 0,
        pending_work_request: 0, completed_work_request: 0,
        pending_checklist: 0, completed_checklist: 0
      };
    }
    return projectStatsMap[key];
  };

  for (const d of delegations) {
    if (!visibleUserIds.has(String(d.delegatedToUser?._id || ''))) continue;
    const entry = getProjectEntry(d.project?.name || 'Others');
    if (entry) {
      if (clean(d.status) === 'completed') entry.completed_delegation++;
      else entry.pending_delegation++;
    }
  }
  for (const w of workRequests) {
    if (!visibleUserIds.has(String(w.requestForUser?._id || ''))) continue;
    const entry = getProjectEntry(w.project?.name || 'Others');
    if (entry) {
      if (clean(w.status) === 'completed') entry.completed_work_request++;
      else entry.pending_work_request++;
    }
  }
  for (const c of checklists) {
    if (!visibleUserIds.has(String(c.user?._id || ''))) continue;
    const entry = getProjectEntry(c.project?.name || 'Others');
    if (entry) {
      if (Boolean(c.actualDate)) entry.completed_checklist++;
      else entry.pending_checklist++;
    }
  }

  const projectStatusLabels = [];
  const projectStatusStats = {
    pending_delegation: [], completed_delegation: [],
    pending_work_request: [], completed_work_request: [],
    pending_checklist: [], completed_checklist: []
  };
  Object.values(projectStatsMap).forEach((stat) => {
    projectStatusLabels.push(stat.displayName);
    projectStatusStats.pending_delegation.push(stat.pending_delegation);
    projectStatusStats.completed_delegation.push(stat.completed_delegation);
    projectStatusStats.pending_work_request.push(stat.pending_work_request);
    projectStatusStats.completed_work_request.push(stat.completed_work_request);
    projectStatusStats.pending_checklist.push(stat.pending_checklist);
    projectStatusStats.completed_checklist.push(stat.completed_checklist);
  });

  const projectStatus = projectStatusLabels.length > 0
    ? { labels: projectStatusLabels, ...projectStatusStats }
    : null;

  // --- Build trendData (last 30 days – delegation createdAt / completedDate) ---
  const today30 = new Date();
  today30.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(today30);
  thirtyDaysAgo.setDate(today30.getDate() - 29);

  const fmtDay = (d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    return `${dd}-${mon}`;
  };

  const createdCount = {};
  const completedCount = {};
  for (const d of delegations) {
    if (!visibleUserIds.has(String(d.delegatedToUser?._id || ''))) continue;
    if (d.createdAt) {
      const cd = new Date(d.createdAt); cd.setHours(0,0,0,0);
      if (cd >= thirtyDaysAgo) { const lbl = fmtDay(cd); createdCount[lbl] = (createdCount[lbl] || 0) + 1; }
    }
    if (d.completedDate || d.approvalDate) {
      const cd = new Date(d.completedDate || d.approvalDate); cd.setHours(0,0,0,0);
      if (cd >= thirtyDaysAgo) { const lbl = fmtDay(cd); completedCount[lbl] = (completedCount[lbl] || 0) + 1; }
    }
  }

  const trendLabels = [], createdData = [], completedData = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(today30);
    day.setDate(today30.getDate() - i);
    const lbl = fmtDay(day);
    trendLabels.push(lbl);
    createdData.push(createdCount[lbl] || 0);
    completedData.push(completedCount[lbl] || 0);
  }

  return {
    success: true,
    metrics,
    priorityTasks: feed.slice(0, 10),
    trendData: { labels: trendLabels, createdData, completedData },
    projectStatus,
    fmsChartData: Object.values(fmsSummaryMap),
    teamPriorityTasks: userRole === 'Employee' ? [] : feed.slice(0, 10)
  };
}

async function getEmployeeDashboardPageData(userName, filters = {}, context = {}) {
  return getDashboardPageData(userName, 'Employee', filters, context);
}

async function getDelegatedTasksForEmployee(userName, filters = {}, context = {}) {
  const user = await getUserByName(userName, context);
  if (!user) return [];

  const rows = await DelegationTask.find({ delegatedToUser: user._id })
    .populate('project', 'name')
    .populate('delegatedByUser', 'name')
    .sort({ targetDate: 1 })
    .lean();

  return rows
    .filter((x) => ['pending', 'rework', 'send for approval'].includes(clean(x.status)))
    .filter((x) => matchesCommonFilters({ ...x, status: x.status }, filters, 'targetDate'))
    .map((x) => ({
      taskId: x.legacyTaskId || x._id.toString(),
      delegatedBy: x.delegatedByUser?.name || '',
      taskDescription: x.description,
      project: x.project?.name || '',
      targetDate: x.targetDate,
      status: x.status,
      taskStatus: x.status,
      priority: x.priority,
      reworkRemark: x.reworkRemark || '',
      attachmentUrl: x.attachmentUrls || []
    }));
}

async function getUserWorkRequests(userName, filters = {}, context = {}) {
  const user = await getUserByName(userName, context);
  if (!user) return [];

  const rows = await WorkRequest.find({
    $or: [{ requestForUser: user._id }, { requestedByUser: user._id }]
  })
    .populate('project', 'name')
    .populate('requestedByUser', 'name')
    .populate('requestForUser', 'name')
    .lean();

  return rows
    .filter((x) => matchesCommonFilters({ ...x, status: x.status }, filters, 'deadline'))
    .map((x) => ({
      requestId: x.legacyRequestId || x._id.toString(),
      requestedBy: x.requestedByUser?.name || '',
      requestFor: x.requestForUser?.name || '',
      description: x.description,
      project: x.project?.name || '',
      deadline: x.deadline,
      status: x.status,
      finalRemarks: x.finalRemarks,
      attachment: x.attachmentUrls || []
    }));
}

async function getChecklistTasksForEmployee(userName, filters = {}, context = {}) {
  const user = await getUserByName(userName, context);
  if (!user) return [];

  const rows = await ChecklistTask.find({ user: user._id })
    .populate('project', 'name')
    .populate('delegatedByUser', 'name')
    .sort({ planDate: 1 })
    .lean();

  return rows
    .filter((x) => !x.actualDate || clean(x.approvalStatus) === 'rework')
    .filter((x) => matchesCommonFilters({ ...x, status: x.approvalStatus }, filters, 'planDate'))
    .map((x) => ({
      taskId: x.legacyTaskId || x._id.toString(),
      delegatedBy: x.delegatedByUser?.name || '',
      taskDescription: x.description,
      description: x.description,
      project: x.project?.name || '',
      planDate: x.planDate,
      frequency: x.frequency || '',
      status: x.approvalStatus,
      remarks: x.remarks || '',
      attReq: x.attachmentRequired
    }));
}

async function getAllPendingTasksForUser(userName, context = {}) {
  const [delegations, workRequests, checklists] = await Promise.all([
    getDelegatedTasksForEmployee(userName, {}, context),
    getUserWorkRequests(userName, {}, context),
    getChecklistTasksForEmployee(userName, {}, context)
  ]);

  return [
    ...delegations.map((x) => ({
      type: 'Delegation',
      id: x.taskId,
      description: x.taskDescription,
      project: x.project,
      targetDate: x.targetDate,
      status: x.status
    })),
    ...workRequests
      .filter((x) => clean(x.requestFor) === clean(userName) && ['pending', 'rework'].includes(clean(x.status)))
      .map((x) => ({
        type: 'Work Request',
        id: x.requestId,
        description: x.description,
        project: x.project,
        targetDate: x.deadline,
        status: x.status
      })),
    ...checklists.map((x) => ({
      type: 'Checklist',
      id: x.taskId,
      description: x.taskDescription,
      project: x.project,
      targetDate: x.planDate,
      status: x.status
    }))
  ];
}

async function getTasksForApproval(userName, userRole, filters = {}, context = {}) {
  const companyScope = getCompanyScope(context);
  const members = await getTeamMembersWithManager(userName, userRole, context);
  const visibleNames = new Set(members.map(clean));
  const visibleUsers = await User.find({ ...companyScope, name: { $in: members } }).select('_id').lean();
  const visibleUserIds = new Set(visibleUsers.map((u) => String(u._id)));
  const visibleUserIdList = [...visibleUserIds];

  const [delegations, workRequests] = await Promise.all([
    DelegationTask.find({ status: 'Send for Approval', delegatedToUser: { $in: visibleUserIdList } })
      .populate('delegatedByUser delegatedToUser project', 'name')
      .lean(),
    WorkRequest.find({ status: 'Send for Approval', requestForUser: { $in: visibleUserIdList } })
      .populate('requestedByUser requestForUser project', 'name')
      .lean()
  ]);

  const delegationRows = delegations
    .filter((x) => visibleUserIds.has(String(x.delegatedToUser?._id || '')))
    .filter((x) => isUserVisible(x.delegatedToUser?.name, visibleNames, userRole, userName))
    .filter((x) => matchesCommonFilters({ ...x, status: x.status }, filters, 'targetDate'))
    .map((x) => ({
      taskId: x.legacyTaskId || x._id.toString(),
      delegatedBy: x.delegatedByUser?.name || '',
      taskCompletedBy: x.delegatedToUser?.name || '',
      taskDescription: x.description,
      project: x.project?.name || '',
      status: x.status,
      approvalDate: x.actionDate,
      doerRemarks: x.finalRemarksByDoer,
      doerAttachments: x.attachmentByDoer || []
    }));

  const workRows = workRequests
    .filter((x) => visibleUserIds.has(String(x.requestForUser?._id || '')))
    .filter((x) => isUserVisible(x.requestForUser?.name, visibleNames, userRole, userName))
    .filter((x) => matchesCommonFilters({ ...x, status: x.status }, filters, 'deadline'))
    .map((x) => ({
      requestId: x.legacyRequestId || x._id.toString(),
      requestedBy: x.requestedByUser?.name || '',
      requestFor: x.requestForUser?.name || '',
      type: 'WorkRequest',
      description: x.description,
      project: x.project?.name || '',
      status: x.status,
      completionDate: x.completionDate,
      doerRemarks: x.remarksByDoer,
      doerAttachments: x.attachmentByDoer || []
    }));

  // Checklist is auto-approved and should never appear in Approve/Review queue.
  return { delegations: delegationRows, workRequests: workRows, checklists: [] };
}

async function markChecklistTaskDone(taskId, planDate, remarks, filesData = [], context = {}) {
  const normalized = normalizeFilesAndContext(filesData, context);
  filesData = normalized.filesData;
  context = normalized.context;

  return withLock(`checklist:${taskId}`, async () => {
    const idQuery = buildRecordIdQuery(taskId, 'legacyTaskId');
    const submitScope = buildSubmitScopeQuery('user', context);
    if (!idQuery || !submitScope) return 'Task ID not found.';

    const parsedPlanDate = planDate ? new Date(planDate) : null;
    const query =
      idQuery._id || !parsedPlanDate || Number.isNaN(parsedPlanDate.getTime())
        ? { ...idQuery, ...submitScope }
        : { ...idQuery, ...submitScope, planDate: parsedPlanDate };

    const row = await ChecklistTask.findOne(query);
    if (!row) return 'Task ID not found.';

    row.actualDate = new Date();
    row.remarks = remarks || row.remarks;
    if (Array.isArray(filesData) && filesData.length > 0) {
      row.attachmentUrls = filesData
        .map((file) => file?.url || file?.fileUrl || file?.fileName)
        .filter(Boolean);
    }
    const { delay, status } = calculateDelay(row.planDate, row.actualDate);
    row.totalDelay = delay;
    row.onTimeStatus = status;
    // Checklist is auto-approved: no "Send for Approval" stage.
    row.approvalStatus = 'Completed';
    await row.save();

    return 'success';
  });
}

async function markChecklistTasksDoneBulk(tasksToUpdate, remarks, filesData = []) {
  if (!Array.isArray(tasksToUpdate) || tasksToUpdate.length === 0) {
    return 'No tasks selected.';
  }

  let done = 0;
  for (const task of tasksToUpdate) {
    const result = await markChecklistTaskDone(task.taskId, task.planDate, remarks, filesData);
    if (result === 'success') done += 1;
  }

  return `success: ${done} tasks marked completed`;
}

async function getMisData(userName, userRole, filters = {}, context = {}) {
  const members = await getTeamMembersWithManager(userName, userRole, context);
  const companyScope = getCompanyScope(context);
  const memberSet = new Set(members.map(clean));

  const hasEmployeeFilter = filters.employee && !['All Team', 'All Employees', 'null'].includes(String(filters.employee));
  const requestedEmployee = hasEmployeeFilter ? clean(filters.employee) : null;

  const users = await User.find({ ...companyScope, status: 'Active', name: { $in: members } }).select('_id name').lean();
  const targetUsers = users.filter((u) => {
    const key = clean(u.name);
    if (!memberSet.has(key)) return false;
    if (!requestedEmployee) return true;
    return key === requestedEmployee;
  });

  if (!targetUsers.length) {
    return [];
  }

  const userMetricsMap = new Map();
  const userById = new Map();
  for (const u of targetUsers) {
    const id = String(u._id);
    userById.set(id, u);
    userMetricsMap.set(id, {
      delegation: toMetricBucket(),
      workRequest: toMetricBucket(),
      checklist: toMetricBucket(),
      fms: toMetricBucket()
    });
  }

  const userIds = targetUsers.map((u) => u._id);
  const targetIdSet = new Set(userIds.map((id) => String(id)));
  const hasProjectFilter = filters.project && filters.project !== 'All Projects';
  const projectFilter = hasProjectFilter ? clean(filters.project) : null;
  const hasPeriodFilter = filters.period && filters.period !== 'all';
  const { from, to } = getDateRangeYmd(filters);

  const [delegations, workRequests, checklists] = await Promise.all([
    DelegationTask.find({ delegatedToUser: { $in: userIds } }).populate('project delegatedToUser', 'name').lean(),
    WorkRequest.find({ requestForUser: { $in: userIds } }).populate('project requestForUser', 'name').lean(),
    ChecklistTask.find({ user: { $in: userIds } }).populate('project user', 'name').lean()
  ]);

  for (const row of delegations) {
    const uid = String(row.delegatedToUser?._id || row.delegatedToUser || '');
    if (!targetIdSet.has(uid)) continue;
    if (projectFilter && clean(row.project?.name) !== projectFilter) continue;

    const isDone = clean(row.status) === 'completed';
    if (hasPeriodFilter && isDone && !isDateInRange(row.targetDate, from, to)) continue;

    const stats = userMetricsMap.get(uid).delegation;
    stats.total += 1;
    if (isDone) {
      stats.done += 1;
      if (clean(row.onTimeStatus).includes('late')) {
        stats.tasksDelayed += 1;
        // GAS parity: delay KPI counts delayed tasks, not exact delay-days value.
        stats.totalDelayDays += 1;
      } else {
        stats.doneOnTime += 1;
      }
    } else {
      stats.pending += 1;
    }
  }

  for (const row of workRequests) {
    const uid = String(row.requestForUser?._id || row.requestForUser || '');
    if (!targetIdSet.has(uid)) continue;
    if (projectFilter && clean(row.project?.name) !== projectFilter) continue;

    const isDone = clean(row.status) === 'completed';
    if (hasPeriodFilter && isDone && !isDateInRange(row.deadline, from, to)) continue;

    const stats = userMetricsMap.get(uid).workRequest;
    stats.total += 1;
    if (isDone) {
      stats.done += 1;
      if (clean(row.onTimeStatus).includes('late')) {
        stats.tasksDelayed += 1;
        stats.totalDelayDays += 1;
      } else {
        stats.doneOnTime += 1;
      }
    } else {
      stats.pending += 1;
    }
  }

  for (const row of checklists) {
    const uid = String(row.user?._id || row.user || '');
    if (!targetIdSet.has(uid)) continue;
    if (projectFilter && clean(row.project?.name) !== projectFilter) continue;

    const isDone = Boolean(row.actualDate);
    if (hasPeriodFilter && isDone && !isDateInRange(row.planDate, from, to)) continue;

    const stats = userMetricsMap.get(uid).checklist;
    stats.total += 1;
    if (isDone) {
      stats.done += 1;
      if (clean(row.onTimeStatus).includes('late')) {
        stats.tasksDelayed += 1;
        stats.totalDelayDays += 1;
      } else {
        stats.doneOnTime += 1;
      }
    } else {
      stats.pending += 1;
    }
  }

  const targetHistory = await MisHistory.find({
    employeeUser: { $in: userIds },
    category: 'All',
    kpiName: 'Weekly Target'
  })
    .sort({ timestamp: -1 })
    .lean();

  const lastTargets = new Map();
  for (const row of targetHistory) {
    const key = String(row.employeeUser);
    if (lastTargets.has(key)) continue;
    const val = row.nextWeekTarget ?? row.score ?? null;
    lastTargets.set(key, val === null || val === undefined ? null : Number(val));
  }

  const calc = (n, d) => {
    if (d <= 0) return 0;
    const ratio = n / d;
    return ratio > 0 ? -ratio : 0;
  };

  const defineKPIs = (category, metric) => [
    { category, kpi: `Completed as per Plan (${category})`, score: calc(metric.pending * 100, metric.total) },
    { category, kpi: `Completed on Time (${category})`, score: calc(metric.tasksDelayed * 100, metric.done) },
    { category, kpi: `No Delay in Completing the Work (${category})`, score: calc(metric.totalDelayDays, metric.tasksDelayed) }
  ];

  return targetUsers.map((u) => {
    const uid = String(u._id);
    const metrics = userMetricsMap.get(uid);
    const kpis = [
      ...defineKPIs('Delegation', metrics.delegation),
      ...defineKPIs('Work Request', metrics.workRequest),
      ...defineKPIs('Checklist', metrics.checklist),
      ...defineKPIs('FMS', metrics.fms)
    ];

    return {
      personName: u.name,
      metrics,
      kpis,
      lastTargetScore: lastTargets.has(uid) ? lastTargets.get(uid) : null
    };
  });
}

async function saveTask(tasks, userName, context = {}) {
  const companyScope = getCompanyScope(context);
  const fromUser = await getUserByName(userName, context);
  if (!fromUser) return 'User not found.';

  if (!Array.isArray(tasks) || tasks.length === 0) return 'No tasks to save.';

  const normalizedTasks = tasks.map((t) => ({
    ...t,
    description: t.description || t.taskDetail || '',
    project: t.project || t.projectName || '',
    attachments: Array.isArray(t.attachments)
      ? t.attachments
      : Array.isArray(t.filesData)
        ? t.filesData.map((f) => f?.fileName).filter(Boolean)
        : []
  }));

  const projectNames = [...new Set(normalizedTasks.map((t) => t.project).filter(Boolean))];
  const projects = await Project.find({ ...companyScope, name: { $in: projectNames } }).lean();
  const projectMap = new Map(projects.map((p) => [p.name, p._id]));

  const assigneeNames = [...new Set(normalizedTasks.map((t) => t.delegatedTo).flat())];
  const assignees = await User.find({ ...companyScope, name: { $in: assigneeNames } }).lean();
  const userMap = new Map(assignees.map((u) => [u.name, u._id]));
  const assigneeById = new Map(assignees.map((u) => [String(u._id), u]));

  const last = await DelegationTask.findOne().sort({ legacyTaskId: -1 }).lean();
  let nextId = Number(last?.legacyTaskId || 0) + 1;

  const inserts = [];
  for (const payload of normalizedTasks) {
    const assignedUsers = Array.isArray(payload.delegatedTo) ? payload.delegatedTo : [payload.delegatedTo];
    for (const person of assignedUsers) {
      const uid = userMap.get(person);
      if (!uid) continue;

      const description = String(payload.description || '').trim();
      if (!description) continue;

      inserts.push({
        legacyTaskId: nextId++,
        delegatedByUser: fromUser._id,
        delegatedToUser: uid,
        description,
        project: projectMap.get(payload.project) || null,
        targetDate: payload.targetDate ? new Date(payload.targetDate) : null,
        attachmentUrls: payload.attachments || [],
        status: 'Pending',
        priority: payload.priority || 'Medium'
      });
    }
  }

  if (inserts.length === 0) return 'No valid assignees found.';

  await DelegationTask.insertMany(inserts);

  await Promise.allSettled(
    inserts.map((row) => {
      const target = assigneeById.get(String(row.delegatedToUser));
      const projectName = projects.find((p) => String(p._id) === String(row.project))?.name || 'General';
      return sendWorkflowMailSafe({
        toUser: target,
        category: 'Delegation',
        action: 'New Task Assigned',
        title: 'New Delegation Task Assigned',
        body: `A new delegation task has been assigned by ${fromUser.name}. Please review and take action.`,
        details: {
          Project: projectName,
          Priority: row.priority || 'Medium',
          DueDate: row.targetDate ? new Date(row.targetDate).toISOString().slice(0, 10) : 'Not Set',
          Task: row.description
        }
      });
    })
  );

  return 'success';
}

async function saveChecklistTask(taskData, userName, context = {}) {
  const companyScope = getCompanyScope(context);
  const creator = await getUserByName(userName, context);
  if (!creator) return 'User not found.';

  const rows = Array.isArray(taskData) ? taskData : [taskData];
  if (!rows.length) return 'No checklist tasks to save.';

  const normalizedRows = rows.flatMap((t) => {
    const rawEmployees = t.employee ?? t.employeeName ?? t.delegatedTo ?? userName;
    const employees = Array.isArray(rawEmployees)
      ? rawEmployees.filter((item) => String(item || '').trim())
      : [rawEmployees];

    return employees.map((employee) => ({
      employee,
      project: t.project || t.projectName || '',
      description: t.description || t.taskDescription || '',
      frequency: t.frequency || t.taskFrequency || 'Daily',
      startDate: t.startDate,
      dayDate: t.dayDate || t.dayOrDate || '',
      attReq: typeof t.attReq !== 'undefined' ? t.attReq : t.attachmentRequired
    }));
  });

  const employeeNames = [...new Set(normalizedRows.map((r) => r.employee).filter(Boolean))];
  const targets = await User.find({ ...companyScope, name: { $in: employeeNames } }).select('_id name').lean();
  const targetMap = new Map(targets.map((u) => [u.name, u._id]));

  const projectNames = [...new Set(normalizedRows.map((r) => r.project).filter(Boolean))];
  const projects = await Project.find({ ...companyScope, name: { $in: projectNames } }).select('_id name').lean();
  const projectMap = new Map(projects.map((p) => [p.name, p._id]));

  const invalidDateRow = normalizedRows.find((row) => {
    if (!row.startDate) return false;
    return !parseDateInIst(row.startDate);
  });
  if (invalidDateRow) {
    return `Invalid checklist startDate: ${String(invalidDateRow.startDate)}`;
  }

  const normalizeFrequency = (f) => {
    const raw = String(f || 'Daily').trim().toLowerCase();
    // 'One Time' tasks are single-occurrence — map to 'Adhoc' so cron never auto-repeats them
    if (raw === 'one time' || raw === 'adhoc') return 'Adhoc';
    if (raw === 'half yearly' || raw === 'half-yearly') return 'Yearly';
    const allowed = ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly', 'adhoc'];
    if (!allowed.includes(raw)) return 'Daily';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const last = await ChecklistWorkMaster.findOne().sort({ legacyTaskId: -1 }).lean();
  let nextId = Number(last?.legacyTaskId || 0) + 1;

  const inserts = normalizedRows
    .map((row) => {
      const targetId = targetMap.get(row.employee);
      const description = String(row.description || '').trim();
      if (!targetId || !description) return null;

      return {
        legacyTaskId: nextId++,
        delegatedToUser: targetId,
        delegatedByUser: creator._id,
        taskDescription: description,
        taskFrequency: normalizeFrequency(row.frequency),
        project: projectMap.get(row.project) || null,
        startDate: parseDateInIst(row.startDate) || new Date(),
        dayDate: row.dayDate || '',
        attachmentRequired: row.attReq ? 'Yes' : ''
      };
    })
    .filter(Boolean);

  if (!inserts.length) return 'No valid checklist tasks found.';
  await ChecklistWorkMaster.insertMany(inserts);

  return 'success';
}

function isTaskDueToday(startDate, frequency, today = new Date()) {
  const base = startOfIstDay(startDate);
  const now = startOfIstDay(today);

  if (now < base) return false;

  const diffDays = Math.floor((now - base) / DAY_MS);
  const freq = clean(frequency);
  const baseParts = getIstParts(base);
  const nowParts = getIstParts(now);

  if (freq === 'daily') return true;
  if (freq === 'weekly') return diffDays % 7 === 0;
  if (freq === 'fortnightly') return diffDays % 15 === 0;
  if (freq === 'monthly') return nowParts.day === baseParts.day;
  if (freq === 'quarterly') {
    const monthDiff = (nowParts.year - baseParts.year) * 12 + (nowParts.month - baseParts.month);
    return monthDiff >= 0 && monthDiff % 3 === 0 && nowParts.day === baseParts.day;
  }
  if (freq === 'yearly') {
    return nowParts.month === baseParts.month && nowParts.day === baseParts.day;
  }
  // 'Adhoc' (One Time) tasks are never auto-generated by the daily cron
  if (freq === 'adhoc') return false;
  return false;
}

async function getExistingTasks(today = new Date()) {
  const start = startOfIstDay(today);
  const end = new Date(start.getTime() + DAY_MS);

  const rows = await ChecklistTask.find({ planDate: { $gte: start, $lt: end } })
    .populate('user project', 'name')
    .lean();

  const set = new Set();
  for (const row of rows) {
    const key = `${row.user?.name || ''}_${row.description}_${row.project?.name || ''}_${getIstDayKey(row.planDate || start)}`;
    set.add(key);
  }
  return set;
}

async function addTasksToSheet(tasks) {
  if (!Array.isArray(tasks) || !tasks.length) return;
  await ChecklistTask.insertMany(tasks);
}

async function createTasksDaily() {
  const today = startOfIstDay(new Date());
  const todayKey = getIstDayKey(today);

  const existing = await getExistingTasks(today);
  const masters = await ChecklistWorkMaster.find({ isActive: true })
    .populate('delegatedByUser delegatedToUser project', 'name email companyId')
    .lean();

  const inserts = [];
  const mailJobs = [];
  const last = await ChecklistTask.findOne().sort({ legacyTaskId: -1 }).lean();
  let nextId = Number(last?.legacyTaskId || 0) + 1;

  for (const row of masters) {
    if (!row.delegatedToUser || !row.taskDescription || !row.taskFrequency || !row.startDate) continue;
    if (!isTaskDueToday(row.startDate, row.taskFrequency, today)) continue;

    const taskKey = `${row.delegatedToUser.name}_${row.taskDescription}_${row.project?.name || ''}_${todayKey}`;
    if (existing.has(taskKey)) continue;

    const planDate = applyIstTimeToDay(today, row.startDate);

    inserts.push({
      legacyTaskId: nextId++,
      user: row.delegatedToUser._id,
      delegatedByUser: row.delegatedByUser?._id || null,
      description: row.taskDescription,
      frequency: row.taskFrequency,
      project: row.project?._id || null,
      planDate,
      attachmentRequired: row.attachmentRequired || '',
      sourceType: 'Generated',
      approvalStatus: 'Pending'
    });

    mailJobs.push({
      toUser: row.delegatedToUser,
      category: 'Checklist',
      action: 'Checklist Task Assigned',
      title: 'New Checklist Task Assigned',
      body: `${row.delegatedByUser?.name || 'System'} assigned a checklist task for today. Please complete it within schedule.`,
      details: {
        Project: row.project?.name || 'General',
        Frequency: row.taskFrequency || 'Daily',
        PlanDate: planDate ? new Date(planDate).toISOString().slice(0, 10) : 'Not Set',
        Task: row.taskDescription
      }
    });
  }

  await addTasksToSheet(inserts);
  if (mailJobs.length > 0) {
    await Promise.allSettled(mailJobs.map((job) => sendWorkflowMailSafe(job)));
  }
  return inserts.length;
}

async function saveWorkRequest(requests, userName, context = {}) {
  const companyScope = getCompanyScope(context);
  const requester = await getUserByName(userName, context);
  if (!requester) return 'User not found.';

  const payloads = (Array.isArray(requests) ? requests : [requests]).map((x) => ({
    ...x,
    project: x.project || x.projectName || '',
    attachments: Array.isArray(x.attachments)
      ? x.attachments
      : Array.isArray(x.filesData)
        ? x.filesData.map((f) => f?.fileName).filter(Boolean)
        : []
  }));

  const invalidDeadline = payloads.find((x) => x.deadline && Number.isNaN(new Date(x.deadline).getTime()));
  if (invalidDeadline) {
    return `Invalid work request deadline: ${String(invalidDeadline.deadline)}`;
  }

  const targets = await User.find({ ...companyScope, name: { $in: payloads.map((x) => x.requestFor) } }).lean();
  const tMap = new Map(targets.map((u) => [u.name, u._id]));
  const targetById = new Map(targets.map((u) => [String(u._id), u]));

  const pNames = [...new Set(payloads.map((x) => x.project).filter(Boolean))];
  const projects = await Project.find({ ...companyScope, name: { $in: pNames } }).lean();
  const pMap = new Map(projects.map((p) => [p.name, p._id]));

  const last = await WorkRequest.findOne().sort({ legacyRequestId: -1 }).lean();
  let nextId = Number(last?.legacyRequestId || 0) + 1;

  const inserts = payloads
    .map((x) => ({
      legacyRequestId: nextId++,
      requestedByUser: requester._id,
      requestForUser: tMap.get(x.requestFor),
      description: x.description,
      project: pMap.get(x.project) || null,
      deadline: x.deadline ? new Date(x.deadline) : null,
      notes: x.notes || '',
      attachmentUrls: x.attachments || [],
      status: 'Pending'
    }))
    .filter((x) => x.requestForUser);

  if (!inserts.length) return 'No valid assignees found.';

  await WorkRequest.insertMany(inserts);

  await Promise.allSettled(
    inserts.map((row) => {
      const target = targetById.get(String(row.requestForUser));
      const projectName = projects.find((p) => String(p._id) === String(row.project))?.name || 'General';
      return sendWorkflowMailSafe({
        toUser: target,
        category: 'Work Request',
        action: 'New Work Request Assigned',
        title: 'New Work Request Assigned',
        body: `A work request has been assigned by ${requester.name}. Please review and act on it.`,
        details: {
          Project: projectName,
          Deadline: row.deadline ? new Date(row.deadline).toISOString().slice(0, 10) : 'Not Set',
          Task: row.description
        }
      });
    })
  );

  return 'success';
}

async function updateStatusWrapper(type, id, status, remarks, planDate, context = {}) {
  const normalized = normalizePlanDateAndContext(planDate, context);
  planDate = normalized.planDate;
  context = normalized.context;

  const normalizedType = String(type || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '');

  if (normalizedType === 'delegation' || normalizedType === 'task') {
    const idQuery = buildRecordIdQuery(id, 'legacyTaskId');
    const approvalScope = await buildApprovalScopeQuery('delegatedToUser', context);
    if (!idQuery || !approvalScope) return 'Task not found.';

    const query = { ...idQuery, ...approvalScope };
    const row = await DelegationTask.findOne(query).populate('delegatedByUser delegatedToUser project', 'name email companyId');
    if (!row) return 'Task not found.';

    row.status = status;
    if (status === 'Completed') {
      row.approvalDate = new Date();
      const { delay, status: onTime } = calculateDelay(row.targetDate, row.approvalDate);
      row.totalDelays = delay;
      row.onTimeStatus = onTime;
      row.finalRemarks = remarks || row.finalRemarks;
    }
    if (status === 'Rework') {
      row.reworkRemark = remarks || '';
    }
    await row.save();
    if (status === 'Completed' || status === 'Rework') {
      await sendWorkflowMailSafe({
        toUser: row.delegatedByUser,
        category: 'Delegation',
        action: status === 'Completed' ? 'Task Completed' : 'Task Rework Requested',
        title: `Delegation ${status}`,
        body:
          status === 'Completed'
            ? `${row.delegatedToUser?.name || 'Assignee'} completed a delegation task.`
            : `${row.delegatedToUser?.name || 'Assignee'} marked a delegation task for rework.`,
        details: {
          Project: row.project?.name || 'General',
          Assignee: row.delegatedToUser?.name || '',
          Status: status,
          Remarks: remarks || ''
        }
      });
    }
    return 'success';
  }

  if (normalizedType === 'workrequest') {
    const idQuery = buildRecordIdQuery(id, 'legacyRequestId');
    const approvalScope = await buildApprovalScopeQuery('requestForUser', context);
    if (!idQuery || !approvalScope) return 'Request not found.';

    const query = { ...idQuery, ...approvalScope };
    const row = await WorkRequest.findOne(query).populate('requestedByUser requestForUser project', 'name email companyId');
    if (!row) return 'Request not found.';

    row.status = status;
    if (status === 'Completed') {
      row.completionDate = new Date();
      const { delay, status: onTime } = calculateDelay(row.deadline, row.completionDate);
      row.delayDays = delay;
      row.onTimeStatus = onTime;
      row.finalRemarks = remarks || row.finalRemarks;
    }
    if (status === 'Rework') {
      row.finalRemarks = `Rework Required: ${remarks || ''}`;
      row.completionDate = null;
    }
    await row.save();
    if (status === 'Completed' || status === 'Rework') {
      await sendWorkflowMailSafe({
        toUser: row.requestedByUser,
        category: 'Work Request',
        action: status === 'Completed' ? 'Request Completed' : 'Request Rework Requested',
        title: `Work Request ${status}`,
        body:
          status === 'Completed'
            ? `${row.requestForUser?.name || 'Assignee'} completed a work request.`
            : `${row.requestForUser?.name || 'Assignee'} marked a work request for rework.`,
        details: {
          Project: row.project?.name || 'General',
          Assignee: row.requestForUser?.name || '',
          Status: status,
          Remarks: remarks || ''
        }
      });
    }
    return 'success';
  }

  if (normalizedType === 'checklist') {
    return withLock(`checklist:${id}`, async () => {
      const idQuery = buildRecordIdQuery(id, 'legacyTaskId');
      const approvalScope = await buildApprovalScopeQuery('user', context);
      if (!idQuery || !approvalScope) return 'Task ID not found.';

      const parsedPlanDate = planDate ? new Date(planDate) : null;
      const query =
        idQuery._id || !parsedPlanDate || Number.isNaN(parsedPlanDate.getTime())
          ? { ...idQuery, ...approvalScope }
          : { ...idQuery, ...approvalScope, planDate: parsedPlanDate };

      const row = await ChecklistTask.findOne(query);
      if (!row) return 'Task ID not found.';

      if (status === 'Completed') {
        row.actualDate = row.actualDate || new Date();
        row.remarks = remarks || row.remarks;
        const { delay, status: onTime } = calculateDelay(row.planDate, row.actualDate);
        row.totalDelay = delay;
        row.onTimeStatus = onTime;
        row.approvalStatus = 'Completed';
      } else if (status === 'Rework') {
        row.actualDate = null;
        row.approvalStatus = 'Rework';
        row.remarks = `Rework Required: ${remarks || ''}`;
      } else {
        row.approvalStatus = status;
        row.remarks = remarks || row.remarks;
      }

      await row.save();
      if (status === 'Completed' || status === 'Rework') {
        const [creator, assignee, project] = await Promise.all([
          row.delegatedByUser ? User.findById(row.delegatedByUser).select('name email companyId').lean() : Promise.resolve(null),
          row.user ? User.findById(row.user).select('name email companyId').lean() : Promise.resolve(null),
          row.project ? Project.findById(row.project).select('name').lean() : Promise.resolve(null)
        ]);
        await sendWorkflowMailSafe({
          toUser: creator,
          companyId: creator?.companyId || assignee?.companyId || null,
          category: 'Checklist',
          action: status === 'Completed' ? 'Checklist Completed' : 'Checklist Rework Requested',
          title: `Checklist ${status}`,
          body:
            status === 'Completed'
              ? `${assignee?.name || 'Assignee'} completed a checklist task.`
              : `${assignee?.name || 'Assignee'} marked a checklist task for rework.`,
          details: {
            Project: project?.name || 'General',
            Assignee: assignee?.name || '',
            Status: status,
            Remarks: remarks || ''
          }
        });
      }
      return 'success';
    });
  }

  return 'Invalid type.';
}

async function submitTaskWrapper(actionType, id, remarks, filesData = [], context = {}) {
  const normalized = normalizeFilesAndContext(filesData, context);
  filesData = normalized.filesData;
  context = normalized.context;
  const attachmentUrls = normalizeAttachmentUrls(filesData);

  if (actionType === 'Task') {
    const idQuery = buildRecordIdQuery(id, 'legacyTaskId');
    const submitScope = buildSubmitScopeQuery('delegatedToUser', context);
    if (!idQuery || !submitScope) return 'Task not found.';

    const query = { ...idQuery, ...submitScope };
    const row = await DelegationTask.findOne(query).populate('delegatedByUser delegatedToUser project', 'name email companyId');
    if (!row) return 'Task not found.';

    row.status = 'Send for Approval';
    row.actionDate = new Date();
    row.finalRemarksByDoer = remarks || '';
    if (attachmentUrls.length > 0) {
      row.attachmentByDoer = attachmentUrls;
    }
    await row.save();
    await sendWorkflowMailSafe({
      toUser: row.delegatedByUser,
      category: 'Delegation',
      action: 'Submitted For Approval',
      title: 'Delegation Submitted For Approval',
      body: `${row.delegatedToUser?.name || 'Assignee'} submitted a delegation task for approval.`,
      details: {
        Project: row.project?.name || 'General',
        Assignee: row.delegatedToUser?.name || '',
        Remarks: remarks || ''
      }
    });
    return 'success';
  }

  if (actionType === 'Work Request') {
    const idQuery = buildRecordIdQuery(id, 'legacyRequestId');
    const submitScope = buildSubmitScopeQuery('requestForUser', context);
    if (!idQuery || !submitScope) return 'Work request not found.';

    const query = { ...idQuery, ...submitScope };
    const row = await WorkRequest.findOne(query).populate('requestedByUser requestForUser project', 'name email companyId');
    if (!row) return 'Work request not found.';

    row.status = 'Send for Approval';
    row.remarksByDoer = remarks || '';
    // completionDate is set only on Admin approval, not on employee submission
    if (attachmentUrls.length > 0) {
      row.attachmentByDoer = attachmentUrls;
    }
    await row.save();
    await sendWorkflowMailSafe({
      toUser: row.requestedByUser,
      category: 'Work Request',
      action: 'Submitted For Approval',
      title: 'Work Request Submitted For Approval',
      body: `${row.requestForUser?.name || 'Assignee'} submitted a work request for approval.`,
      details: {
        Project: row.project?.name || 'General',
        Assignee: row.requestForUser?.name || '',
        Remarks: remarks || ''
      }
    });
    return 'success';
  }

  return 'Invalid action type.';
}

async function getDelegationReportData(userName, userRole, filters = {}, context = {}) {
  const companyScope = getCompanyScope(context);
  const members = await getTeamMembersWithManager(userName, userRole, context);
  const visibleNames = new Set(members.map(clean));
  const users = await User.find({ ...companyScope, name: { $in: members } }).select('_id').lean();
  const visibleUserIds = users.map((u) => u._id);

  const rows = await DelegationTask.find({ delegatedToUser: { $in: visibleUserIds } })
    .populate('project delegatedByUser delegatedToUser', 'name')
    .sort({ targetDate: 1 })
    .lean();

  return rows
    .filter((x) => isUserVisible(x.delegatedToUser?.name, visibleNames, userRole, userName))
    .filter((x) => matchesEmployeeFilter(x.delegatedToUser?.name, filters))
    .filter((x) => matchesCommonFilters({ ...x, status: x.status }, filters, 'targetDate'))
    .map((x) => ({
      taskId: x.legacyTaskId || x._id.toString(),
      delegatedBy: x.delegatedByUser?.name || '',
      delegatedTo: x.delegatedToUser?.name || '',
      taskDescription: x.description,
      project: x.project?.name || '',
      targetDate: x.targetDate,
      taskStatus: x.status,
      status: x.status,
      onTimeStatus: x.onTimeStatus || '',
      completedDate: x.approvalDate || x.actionDate || null,
      attachments: x.attachmentUrls || []
    }));
}

async function getWorkRequestReportData(userName, userRole, filters = {}, context = {}) {
  const companyScope = getCompanyScope(context);
  const members = await getTeamMembersWithManager(userName, userRole, context);
  const visibleNames = new Set(members.map(clean));
  const users = await User.find({ ...companyScope, name: { $in: members } }).select('_id').lean();
  const visibleUserIds = users.map((u) => u._id);

  const rows = await WorkRequest.find({ requestForUser: { $in: visibleUserIds } })
    .populate('project requestedByUser requestForUser', 'name')
    .sort({ deadline: 1 })
    .lean();

  return rows
    .filter((x) => isUserVisible(x.requestForUser?.name, visibleNames, userRole, userName))
    .filter((x) => matchesEmployeeFilter(x.requestForUser?.name, filters))
    .filter((x) => matchesCommonFilters({ ...x, status: x.status }, filters, 'deadline'))
    .map((x) => ({
      requestId: x.legacyRequestId || x._id.toString(),
      requestedBy: x.requestedByUser?.name || '',
      requestFor: x.requestForUser?.name || '',
      description: x.description,
      project: x.project?.name || '',
      deadline: x.deadline,
      status: x.status,
      onTimeStatus: x.onTimeStatus || '',
      completedDate: x.completionDate || null,
      finalRemarks: x.finalRemarks,
      attachment: x.attachmentUrls || []
    }));
}

async function getChecklistReportData(userName, userRole, filters = {}, context = {}) {
  const companyScope = getCompanyScope(context);
  const members = await getTeamMembersWithManager(userName, userRole, context);
  const visibleNames = new Set(members.map(clean));
  const users = await User.find({ ...companyScope, name: { $in: members } }).select('_id').lean();
  const visibleUserIds = users.map((u) => u._id);

  const rows = await ChecklistTask.find({ user: { $in: visibleUserIds } })
    .populate('project user delegatedByUser', 'name')
    .sort({ planDate: 1 })
    .lean();

  return rows
    .filter((x) => isUserVisible(x.user?.name, visibleNames, userRole, userName))
    .filter((x) => matchesEmployeeFilter(x.user?.name, filters))
    .filter((x) => matchesCommonFilters({ ...x, status: x.approvalStatus }, filters, 'planDate'))
    .map((x) => ({
      taskId: x.legacyTaskId || x._id.toString(),
      userName: x.user?.name || '',
      delegatedBy: x.delegatedByUser?.name || '',
      description: x.description,
      project: x.project?.name || '',
      planDate: x.planDate,
      actualDate: x.actualDate,
      onTimeStatus: x.onTimeStatus || '',
      totalDelay: x.totalDelay || 0,
      status: x.approvalStatus,
      approvalStatus: x.approvalStatus,
      attachment: x.attachmentUrls || []
    }));
}

async function getAllReportData(userName, userRole, filters = {}, context = {}) {
  const [delegation, workRequest, checklist, fms] = await Promise.all([
    getDelegationReportData(userName, userRole, filters, context),
    getWorkRequestReportData(userName, userRole, filters, context),
    getChecklistReportData(userName, userRole, filters, context),
    getFmsTasksForEmployee(userName, userRole, { ...filters, status: 'All Statuses' }, context)
  ]);

  return {
    projectReport: [],
    delegations: delegation,
    workRequests: workRequest,
    checklists: checklist,
    fms,
    delegationReport: delegation,
    workRequestReport: workRequest,
    checklistReport: checklist,
    fmsReport: fms,
    employeePerformanceReport: []
  };
}

async function getKraMasterData(userName, userRole, filters = {}, context = {}) {
  const companyScope = getCompanyScope(context);
  const members = await getTeamMembersWithManager(userName, userRole, context);
  const users = await User.find({ ...companyScope, name: { $in: members } }).select('_id name').lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u.name]));

  const rows = await ChecklistWorkMaster.find({ isActive: true })
    .populate('delegatedByUser delegatedToUser project', 'name')
    .lean();

  return rows
    .filter((x) => userMap.has(String(x.delegatedToUser?._id || '')))
    .filter((x) => {
      if (!filters.project || filters.project === 'All Projects') return true;
      return x.project?.name === filters.project;
    })
    .map((x) => ({
      taskId: x.legacyTaskId || x._id.toString(),
      delegatedBy: x.delegatedByUser?.name || '',
      delegatedTo: x.delegatedToUser?.name || '',
      taskDescription: x.taskDescription,
      description: x.taskDescription,
      project: x.project?.name || '',
      taskFrequency: x.taskFrequency,
      frequency: x.taskFrequency,
      startDate: x.startDate,
      attReq: x.attachmentRequired || ''
    }));
}

async function getFilteredDataForCard(cardType, status, userName, userRole, filters = {}, context = {}) {
  const statusWanted = clean(status);
  const card = clean(cardType);

  if (card === 'priority' || card === 'tasks') {
    const dashboard = await getDashboardPageData(userName, userRole, filters, context);
    return dashboard.priorityTasks.filter((x) => clean(x.status) === statusWanted);
  }

  const [delegations, workRequests, checklists, fmsRows] = await Promise.all([
    getDelegationReportData(userName, userRole, filters, context),
    getWorkRequestReportData(userName, userRole, filters, context),
    getChecklistReportData(userName, userRole, filters, context),
    getFmsTasksForEmployee(userName, userRole, { ...filters, status: 'All Statuses' }, context)
  ]);

  if (card === 'delegation') {
    if (statusWanted === 'pending') {
      return delegations.filter((t) => ['pending', 'rework', 'send for approval'].includes(clean(t.taskStatus)));
    }
    if (statusWanted === 'done') {
      return delegations.filter((t) => clean(t.taskStatus) === 'completed');
    }
    if (statusWanted === 'delayed') {
      const now = new Date(); now.setHours(0,0,0,0);
      return delegations.filter((t) =>
        (clean(t.taskStatus) === 'completed' && clean(t.onTimeStatus) === 'late') ||
        (!['completed'].includes(clean(t.taskStatus)) && t.targetDate && new Date(t.targetDate) < now)
      );
    }
    return delegations;
  }

  if (card === 'work request' || card === 'workrequest') {
    if (statusWanted === 'pending') {
      return workRequests.filter((t) => ['pending', 'rework', 'send for approval'].includes(clean(t.status)));
    }
    if (statusWanted === 'done') {
      return workRequests.filter((t) => clean(t.status) === 'completed');
    }
    if (statusWanted === 'delayed') {
      const now = new Date(); now.setHours(0,0,0,0);
      return workRequests.filter((t) =>
        (clean(t.status) === 'completed' && clean(t.onTimeStatus) === 'late') ||
        (!['completed'].includes(clean(t.status)) && t.deadline && new Date(t.deadline) < now)
      );
    }
    return workRequests;
  }

  if (card === 'checklist') {
    if (statusWanted === 'pending') {
      return checklists.filter((t) => !t.actualDate);
    }
    if (statusWanted === 'done') {
      return checklists.filter((t) => Boolean(t.actualDate) && clean(t.onTimeStatus) !== 'late');
    }
    if (statusWanted === 'delayed') {
      const now = new Date(); now.setHours(0,0,0,0);
      return checklists.filter((t) =>
        (Boolean(t.actualDate) && clean(t.onTimeStatus) === 'late') ||
        (!t.actualDate && t.planDate && new Date(t.planDate) < now)
      );
    }
    return checklists;
  }

  if (card === 'fms') {
    const normalized = fmsRows.map((x) => ({ ...x, planDate: x.planDate || x.plannedDate }));
    if (statusWanted === 'pending') {
      return normalized.filter((t) => !t.actualDate);
    }
    if (statusWanted === 'done') {
      return normalized.filter((t) => Boolean(t.actualDate));
    }
    if (statusWanted === 'delayed') {
      const now = new Date(); now.setHours(0,0,0,0);
      return normalized.filter((t) =>
        (Boolean(t.actualDate) && clean(t.onTimeStatus) === 'late') ||
        (!t.actualDate && t.planDate && new Date(t.planDate) < now)
      );
    }
    return normalized;
  }

  return [];
}

async function getEmployeePerformanceReport(userName, userRole, filters = {}, context = {}) {
  const rows = await getMisData(userName, userRole, filters, context);
  const report = rows.map((r) => {
    const metrics = r.metrics || {};
    const delegation = metrics.delegation || {};
    const workRequest = metrics.workRequest || {};
    const checklist = metrics.checklist || {};
    const fms = metrics.fms || {};

    const total = Number(delegation.total || 0) + Number(workRequest.total || 0) + Number(checklist.total || 0) + Number(fms.total || 0);
    const completed = Number(delegation.done || 0) + Number(workRequest.done || 0) + Number(checklist.done || 0) + Number(fms.done || 0);
    const pending = Math.max(0, total - completed);
    const delayed = Number(delegation.tasksDelayed || 0) + Number(workRequest.tasksDelayed || 0) + Number(checklist.tasksDelayed || 0) + Number(fms.tasksDelayed || 0);
    const doneOnTime = Number(delegation.doneOnTime || 0) + Number(workRequest.doneOnTime || 0) + Number(checklist.doneOnTime || 0) + Number(fms.doneOnTime || 0);
    const totalDelayDays = Number(delegation.totalDelayDays || 0) + Number(workRequest.totalDelayDays || 0) + Number(checklist.totalDelayDays || 0) + Number(fms.totalDelayDays || 0);

    const onTimePctNumber = completed > 0 ? (doneOnTime / completed) * 100 : 0;
    const avgDelayNumber = completed > 0 ? totalDelayDays / completed : 0;
    let score = onTimePctNumber * 0.8 - delayed * 2 - avgDelayNumber;
    if (score > 100) score = 100;
    if (score < 0) score = 0;
    if (completed === 0) score = 0;

    return {
      name: r.personName || 'Unknown',
      total,
      completed,
      pending,
      onTimePct: `${onTimePctNumber.toFixed(1)}%`,
      avgDelay: `${avgDelayNumber.toFixed(1)} days`,
      reworks: delayed,
      score: Number(score.toFixed(0))
    };
  });

  return report.sort((a, b) => a.score - b.score);
}

async function getFmsTasksForEmployee(userName, userRole, filters = {}, context = {}) {
  let rows = [];
  try {
    rows = await fetchFmsRows();
  } catch {
    rows = [];
  }

  const members = await getTeamMembersWithManager(userName, userRole, context);
  const visible = new Set(members.map(clean));

  const isDone = (x) => Boolean(x.actualDate && String(x.actualDate).trim() !== '');
  const wantedStatus = clean(filters.status || '');

  // Fallback: if sheet rows are empty, derive pending/completed work from FMS flow steps.
  if (!rows.length) {
    const scope = getCompanyScope(context);
    const flows = await FmsFlow.find({ ...scope }).select('name steps createdAt').lean();
    const now = Date.now();
    const fallbackRows = [];

    for (const flow of flows) {
      for (const step of flow.steps || []) {
        const assignee = String(step.assignedUserName || step.completedByName || '').trim();
        if (!assignee) continue;
        const normalizedAssignee = clean(assignee);
        if (userRole !== 'Super Admin' && !(normalizedAssignee === clean(userName) || visible.has(normalizedAssignee))) {
          continue;
        }

        const completedAt = step.completedAt ? new Date(step.completedAt) : null;
        const dueAt = step.dueAt ? new Date(step.dueAt) : null;
        const assignedAt = step.assignedAt ? new Date(step.assignedAt) : null;
        const status = clean(step.status);
        const done = status === 'completed' || Boolean(completedAt);
        const late = Boolean(done && dueAt && completedAt && completedAt.getTime() > dueAt.getTime());
        const delayDays = late ? Math.max(0, Math.ceil((completedAt.getTime() - dueAt.getTime()) / 86400000)) : 0;

        fallbackRows.push({
          rowId: `${flow._id}:${step.sequence}`,
          who: assignee,
          fmsName: flow.name || 'FMS',
          taskName: step.title || `Step ${step.sequence || ''}`.trim(),
          plannedDate: dueAt || assignedAt || flow.createdAt,
          actualDate: completedAt,
          delayDays,
          onTimeStatus: done ? (late ? 'Late' : 'On Time') : '',
          formLink: '',
          status: done ? 'Completed' : 'Pending'
        });
      }
    }

    rows = fallbackRows;
  }

  return rows
    .filter((x) => {
      const who = clean(x.who);
      if (userRole !== 'Super Admin') {
        if (!(who === clean(userName) || visible.has(who))) {
          return false;
        }
      }
      if (!x.fmsName) return false;
      if (!wantedStatus || wantedStatus === 'all statuses') return true;
      if (wantedStatus === 'pending') return !isDone(x);
      if (wantedStatus === 'completed') return isDone(x);
      return clean(x.onTimeStatus) === wantedStatus;
    })
    .map((x) => ({
      rowId: x.rowId,
      who: x.who,
      fmsName: x.fmsName,
      taskName: x.taskName,
      plannedDate: x.plannedDate,
      actualDate: x.actualDate,
      delayDays: x.delayDays,
      onTimeStatus: x.onTimeStatus,
      formLink: x.formLink,
      status: isDone(x) ? 'Completed' : 'Pending'
    }));
}

async function markFmsTaskDone(rowId) {
  return markFmsDoneByRow(rowId);
}

async function getEmployeeSubmissions(userName, context = {}) {
  const user = await getUserByName(userName, context);
  if (!user) return { delegations: [], checklists: [], workRequests: [] };

  const [delegations, checklists, workRequests] = await Promise.all([
    DelegationTask.find({ delegatedToUser: user._id, status: { $in: ['Send for Approval', 'Completed'] } })
      .populate('project delegatedByUser', 'name')
      .lean(),
    ChecklistTask.find({ user: user._id, actualDate: { $ne: null } }).populate('project', 'name').lean(),
    WorkRequest.find({ requestForUser: user._id, status: { $in: ['Send for Approval', 'Completed'] } })
      .populate('project requestedByUser', 'name')
      .lean()
  ]);

  return {
    delegations: delegations.map((x) => ({
      taskId: x.legacyTaskId || x._id.toString(),
      project: x.project?.name || '',
      description: x.description,
      status: x.status,
      delegatedBy: x.delegatedByUser?.name || ''
    })),
    checklists: checklists.map((x) => ({
      taskId: x.legacyTaskId || x._id.toString(),
      project: x.project?.name || '',
      description: x.description,
      status: x.approvalStatus,
      actualDate: x.actualDate
    })),
    workRequests: workRequests.map((x) => ({
      requestId: x.legacyRequestId || x._id.toString(),
      project: x.project?.name || '',
      description: x.description,
      status: x.status,
      requestedBy: x.requestedByUser?.name || ''
    }))
  };
}

async function saveUserWeeklyScore(targetEmployee, nextWeekTarget, _role, context = {}) {
  const employee = await getUserByName(targetEmployee, context);
  if (!employee) return 'No data found for this user.';

  const now = new Date();
  const week = `${now.getFullYear()}-W${Math.ceil((now.getDate() + 6) / 7)}`;

  await MisHistory.create({
    timestamp: now,
    weekId: week,
    employeeUser: employee._id,
    category: 'All',
    kpiName: 'Weekly Target',
    score: Number(nextWeekTarget || 0),
    nextWeekTarget: Number(nextWeekTarget || 0),
    metadata: { employeeNameSnapshot: targetEmployee }
  });

  return 'success';
}

async function saveMisWeeklySnapshot(userName, userRole, context = {}) {
  const companyScope = getCompanyScope(context);
  const rows = await getMisData(userName, userRole, { period: 'all' }, context);
  const now = new Date();
  const week = `${now.getFullYear()}-W${Math.ceil((now.getDate() + 6) / 7)}`;

  const users = await User.find({ ...companyScope, name: { $in: rows.map((x) => x.personName) } }).lean();
  const map = new Map(users.map((u) => [u.name, u._id]));

  for (const row of rows) {
    const uid = map.get(row.personName);
    if (!uid) continue;

    await MisHistory.create({
      timestamp: now,
      weekId: week,
      employeeUser: uid,
      category: 'Summary',
      kpiName: 'Snapshot',
      score: 0,
      totalTasks: row.metrics.delegation.total + row.metrics.workRequest.total + row.metrics.checklist.total,
      done: row.metrics.delegation.done + row.metrics.workRequest.done + row.metrics.checklist.done,
      pending: row.metrics.delegation.pending + row.metrics.workRequest.pending + row.metrics.checklist.pending,
      delayed: row.metrics.delegation.tasksDelayed + row.metrics.workRequest.tasksDelayed + row.metrics.checklist.tasksDelayed,
      onTime: row.metrics.delegation.doneOnTime + row.metrics.workRequest.doneOnTime + row.metrics.checklist.doneOnTime,
      metadata: { employeeNameSnapshot: row.personName }
    });
  }

  return 'success';
}

export {
  createTasksDaily,
  isTaskDueToday,
  getExistingTasks,
  addTasksToSheet,
  getDashboardPageData,
  getEmployeeDashboardPageData,
  getDelegatedTasksForEmployee,
  getUserWorkRequests,
  getChecklistTasksForEmployee,
  getAllPendingTasksForUser,
  getTasksForApproval,
  markChecklistTaskDone,
  markChecklistTasksDoneBulk,
  getMisData,
  getKraMasterData,
  getFilteredDataForCard,
  getEmployeePerformanceReport,
  getFmsTasksForEmployee,
  markFmsTaskDone,
  saveTask,
  saveChecklistTask,
  saveWorkRequest,
  updateStatusWrapper,
  submitTaskWrapper,
  getAllReportData,
  getEmployeeSubmissions,
  saveUserWeeklyScore,
  saveMisWeeklySnapshot
};

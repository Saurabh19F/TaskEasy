import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { HierarchyGroup } from '../models/HierarchyGroup.js';
import { AppSetting } from '../models/AppSetting.js';
import { ApiError } from '../utils/ApiError.js';
import { parseDateSafe, getDateRangeYmd, toYmdInt, isDateInRange } from '../utils/dateFilters.js';
import { getCached, setCached, clearCached } from '../utils/cache.js';
import { getCacheClient } from '../config/cacheClient.js';
import { composeProfessionalEmailTemplate, sendEmail } from './notificationService.js';
import { uploadAttachmentDataUri } from './uploadService.js';
import { DelegationTask } from '../models/DelegationTask.js';
import { WorkRequest } from '../models/WorkRequest.js';
import { ChecklistTask } from '../models/ChecklistTask.js';
import {
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
} from './coreTaskService.js';

function notMigrated(name) {
  return async () => ({
    success: false,
    error: `Function '${name}' is mapped but not fully migrated yet.`
  });
}

const cache = getCacheClient();

function cacheKey(prefix, ...parts) {
  return `${prefix}:${parts.map((x) => String(x ?? '')).join(':')}`;
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

async function checkCredentials(userId, password) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId || !password) {
    return { isValid: false, error: 'Invalid User ID or Password.' };
  }

  const user = await User.findOne({ userId: normalizedUserId }).lean();
  if (!user) {
    return { isValid: false, error: 'Invalid User ID or Password.' };
  }
  if (user.status !== 'Active') {
    return { isValid: false, error: 'Your account is inactive. Please contact admin.' };
  }
  if (typeof user.passwordHash !== 'string' || !user.passwordHash.startsWith('$2')) {
    return { isValid: false, error: 'Invalid User ID or Password.' };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return { isValid: false, error: 'Invalid User ID or Password.' };
  }

  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, 'Authentication is not configured. Set JWT_SECRET in backend environment.');
  }

  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });

  return {
    isValid: true,
    userName: user.name,
    role: user.role,
    roleName: user.roleName || user.role,
    isAppAdmin: Boolean(user.isAppAdmin || user.role === 'App Admin'),
    companyId: user.companyId || null,
    loginScope: user.isAppAdmin || user.role === 'App Admin' ? 'platform' : 'company',
    token
  };
}

async function ensureDefaultProject(companyId, createdBy = null) {
  if (!companyId) return;
  const existing = await Project.findOne({ companyId, name: 'General' }).lean();
  if (!existing) {
    await Project.create({ companyId, name: 'General', status: 'Active', createdBy });
  }
}

async function getProjectsWithStatus(context = {}) {
  const companyScope = getCompanyScope(context);
  if (companyScope.companyId) {
    await ensureDefaultProject(companyScope.companyId, getContextUser(context)?._id || null);
  }
  const projects = await Project.find(companyScope).select('name status').sort({ name: 1 }).lean();
  return projects.map((p) => ({ name: p.name, status: p.status }));
}

async function getProjects(context = {}) {
  const companyScope = getCompanyScope(context);
  if (companyScope.companyId) {
    await ensureDefaultProject(companyScope.companyId, getContextUser(context)?._id || null);
  }
  const projects = await Project.find({ ...companyScope, status: 'Active' }).select('name').sort({ name: 1 }).lean();
  return projects.map((p) => p.name);
}

async function getAllUsers(context = {}) {
  const users = await User.find({ ...getCompanyScope(context), status: 'Active' }).select('name').sort({ name: 1 }).lean();
  return [...new Set(users.map((u) => u.name))];
}

async function getAdminsAndEmployees(context = {}) {
  const users = await User.find({ ...getCompanyScope(context), status: 'Active' }).select('name role').lean();
  return {
    admins: users.filter((u) => ['Admin', 'Super Admin'].includes(u.role)).map((u) => u.name),
    employees: users.map((u) => u.name)
  };
}

async function getHierarchyData(context = {}) {
  const rows = await HierarchyGroup.find(getCompanyScope(context)).populate('adminUser employeeUsers', 'name').lean();
  return rows.map((r) => ({
    admin: r.adminUser?.name || r.legacyAdminName,
    employees: (r.employeeUsers || []).map((u) => u.name)
  }));
}

async function saveHierarchy(hierarchyData, context) {
  if (!Array.isArray(hierarchyData)) {
    throw new ApiError(400, 'Invalid hierarchy payload');
  }

  const companyScope = getCompanyScope(context);

  // Pre-resolve all admins and employees BEFORE touching the DB,
  // so we don't delete existing data and then discover a bad payload.
  const resolved = [];
  for (const item of hierarchyData) {
    const admin = await User.findOne({ ...companyScope, name: item.admin }).select('_id').lean();
    if (!admin) continue;
    const employees = await User.find({ ...companyScope, name: { $in: item.employees || [] } }).select('_id').lean();
    resolved.push({ item, admin, employees });
  }

  // Use a MongoDB session transaction so deleteMany + creates are atomic.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await HierarchyGroup.deleteMany(companyScope, { session });
      for (const { item, admin, employees } of resolved) {
        await HierarchyGroup.create([{
          ...companyScope,
          adminUser: admin._id,
          employeeUsers: employees.map((e) => e._id),
          legacyAdminName: item.admin,
          legacyEmployeeNames: item.employees || []
        }], { session });
      }
    });
  } finally {
    session.endSession();
  }

  return 'success';
}

async function getUsersForManagement(context = {}) {
  const rows = await User.find(getCompanyScope(context)).select('name number userId email role roleName status').sort({ name: 1 }).lean();
  return rows.map((u) => ({
    user: u.name,
    number: u.number,
    userId: u.userId,
    email: u.email,
    role: u.roleName || u.role,
    status: u.status
  }));
}

async function upsertUser(userData, context = {}) {
  const user = getContextUser(context);
  const companyScope = getCompanyScope(context);
  const normalizedRole = String(userData.role || 'Employee').trim();
  const update = {
    name: userData.user,
    number: userData.number,
    userId: userData.userId,
    email: userData.email,
    role: normalizedRole,
    roleName: normalizedRole,
    companyId: user?.companyId || null,
    isAppAdmin: normalizedRole === 'App Admin',
    status: userData.status
  };

  if (userData.password) {
    update.passwordHash = await bcrypt.hash(userData.password, 10);
  }

  await User.findOneAndUpdate({ ...companyScope, userId: userData.userId }, update, { upsert: true, new: true });
  // Invalidate user cache so dropdown lists and auth lookups reflect the change immediately
  await clearCached(cache, cacheKey('users', 'allRows'));
  return 'success';
}

async function deleteUser(userId, context = {}) {
  const res = await User.deleteOne({ ...getCompanyScope(context), userId });
  if (res.deletedCount) {
    // Invalidate user cache after deletion
    await clearCached(cache, cacheKey('users', 'allRows'));
    return 'success';
  }
  return 'User not found.';
}

async function manageProject(action, data, context = {}) {
  const companyScope = getCompanyScope(context);

  if (action === 'add') {
    await Project.create({ ...companyScope, name: data.newName, status: 'Active' });
    return 'success';
  }

  const project = await Project.findOne({ ...companyScope, name: data.name });
  if (!project) {
    return `Project '${data.name}' not found.`;
  }

  if (action === 'toggleStatus') {
    project.status = project.status === 'Active' ? 'Paused' : 'Active';
    await project.save();
    return 'success';
  }

  if (action === 'delete') {
    await project.deleteOne();
    return 'success';
  }

  return 'Invalid action.';
}

async function getTeamMembersWithManager(userName, userRole, context = {}) {
  const companyScope = getCompanyScope(context);

  if (userRole === 'Super Admin') {
    return getAllUsers(context);
  }
  if (userRole === 'Employee') {
    return [userName];
  }

  const admin = await User.findOne({ ...companyScope, name: userName }).select('_id').lean();
  if (!admin) return [userName];

  const group = await HierarchyGroup.findOne({ ...companyScope, adminUser: admin._id }).populate('employeeUsers', 'name').lean();
  if (!group) return [userName];

  return [userName, ...group.employeeUsers.map((u) => u.name)];
}

async function getNotificationCounts(userName, userRole, context = {}) {
  try {
    const companyScope = getCompanyScope(context);
    const members = await getTeamMembersWithManager(userName || '', userRole || 'Employee', context);
    const visibleUsers = await User.find({ ...companyScope, name: { $in: members } }).select('_id').lean();
    const visibleUserIds = visibleUsers.map((u) => u._id);

    const user = context?.user || null;
    const userId = user?._id || null;

    const [approvalDelegations, approvalWorkReqs, myPendingDelegations, myPendingChecklists, myPendingWorkReqs] = await Promise.all([
      // For Admin/Super Admin: count Send for Approval items in their team
      ['Admin', 'Super Admin'].includes(userRole)
        ? DelegationTask.countDocuments({ delegatedToUser: { $in: visibleUserIds }, status: 'Send for Approval' })
        : Promise.resolve(0),
      ['Admin', 'Super Admin'].includes(userRole)
        ? WorkRequest.countDocuments({ requestForUser: { $in: visibleUserIds }, status: 'Send for Approval' })
        : Promise.resolve(0),
      // For Employee / own tasks: count pending delegation tasks assigned to me
      userId
        ? DelegationTask.countDocuments({ delegatedToUser: userId, status: { $in: ['Pending', 'Rework'] } })
        : Promise.resolve(0),
      // Pending checklist tasks for current user
      userId
        ? ChecklistTask.countDocuments({ user: userId, actualDate: null, approvalStatus: { $in: ['Pending', 'Rework'] } })
        : Promise.resolve(0),
      // Pending work requests for current user
      userId
        ? WorkRequest.countDocuments({ requestForUser: userId, status: { $in: ['Pending', 'Rework'] } })
        : Promise.resolve(0)
    ]);

    const approvalCount = approvalDelegations + approvalWorkReqs;

    return {
      approvalCount,
      delegationCount: myPendingDelegations,
      checklistCount: myPendingChecklists,
      workRequestCount: myPendingWorkReqs,
      myDelegationCount: myPendingDelegations,
      myChecklistCount: myPendingChecklists,
      myWorkRequestCount: myPendingWorkReqs
    };
  } catch {
    return {
      approvalCount: 0,
      delegationCount: 0,
      checklistCount: 0,
      workRequestCount: 0,
      myDelegationCount: 0,
      myChecklistCount: 0,
      myWorkRequestCount: 0
    };
  }
}

async function getUnifiedAppData(userName, userRole, context = {}) {
  const key = cacheKey('unified-v2', userName, userRole);
  const cached = await getCached(cache, key);
  if (cached) return cached;

  const [projects, allUsers, notifications, dashboard] = await Promise.all([
    getProjects(context),
    getAllUsers(context),
    getNotificationCounts(userName, userRole),
    getDashboardPageData(userName, userRole, { period: 'all', project: 'All Projects', status: 'All Statuses' }, context)
  ]);

  const payload = {
    success: true,
    dashboard,
    notifications,
    projects,
    allUsers,
    teamMembers: await getTeamMembersWithManager(userName, userRole, context),
    rawData: { delegations: [], workRequests: [], checklists: [], fms: [] }
  };

  await setCached(cache, key, payload, 120);
  return payload;
}

async function saveFmsSheetSetting(sheetId, user) {
  const value = typeof sheetId === 'object' ? sheetId : { sheetId, range: process.env.FMS_DEFAULT_RANGE || 'FMS!A2:M' };
  await AppSetting.findOneAndUpdate(
    { key: 'fmsSheetId' },
    { key: 'fmsSheetId', value, updatedBy: user?._id || null },
    { upsert: true }
  );
  await clearCached(cache, cacheKey('fms', 'connector'));
  return 'success';
}

async function getInitialApplicationDataCompat(userName, userRole) {
  const [projects, allUsers, notifications] = await Promise.all([
    getProjects(),
    getAllUsers(),
    getNotificationCounts(userName, userRole)
  ]);
  return { success: true, notifications, projects, allUsers };
}

async function getCachedUsersDataCompat() {
  const key = cacheKey('users', 'allRows');
  const hit = await getCached(cache, key);
  if (hit) return hit;

  const users = await User.find().select('name number userId email role status').lean();
  await setCached(cache, key, users, 300);
  return users;
}

async function findUserInSheetsCompat(identifier, colIndex) {
  const allUsers = await getCachedUsersDataCompat();
  const mapByIndex = {
    0: 'name',
    1: 'number',
    2: 'userId',
    3: 'email',
    5: 'role',
    7: 'status'
  };
  const key = mapByIndex[colIndex] || 'userId';
  const row = allUsers.find((u) => String(u[key] || '').trim() === String(identifier || '').trim());
  return row ? { data: [row.name, row.number, row.userId, row.email, '', row.role, '', row.status] } : null;
}

async function getTeamMembersCompat(userName, userRole) {
  const withManager = await getTeamMembersWithManager(userName, userRole);
  if (userRole === 'Employee') return [];
  return withManager.filter((x) => String(x).trim().toLowerCase() !== String(userName).trim().toLowerCase());
}

async function getDelegationTasksForApprovalCompat(teamMembers = [], projectFilter = 'All Projects') {
  const all = await getTasksForApproval(teamMembers[0] || '', 'Super Admin', { project: projectFilter });
  const set = new Set(teamMembers.map((x) => String(x).trim().toLowerCase()));
  return (all.delegations || []).filter((x) => set.has(String(x.taskCompletedBy || '').trim().toLowerCase()));
}

async function getWorkRequestsForApprovalCompat(userName, userRole, projectFilter = 'All Projects') {
  const all = await getTasksForApproval(userName, userRole, { project: projectFilter });
  return all.workRequests || [];
}

async function getChecklistTasksForApprovalCompat() {
  return [];
}

async function updateWorkRequestStatusCompat(requestId, status, remarks) {
  return updateStatusWrapper('WorkRequest', requestId, status, remarks, null);
}

async function parseDateCompat(input) {
  return parseDateSafe(input);
}

async function calculateDelayCompat(targetDate, completionDate) {
  const target = parseDateSafe(targetDate);
  const actual = completionDate ? parseDateSafe(completionDate) : new Date();
  if (!target || !actual) return { delay: 0, status: 'N/A' };
  target.setHours(0, 0, 0, 0);
  actual.setHours(0, 0, 0, 0);
  const diff = Math.ceil((actual - target) / (1000 * 60 * 60 * 24));
  return diff > 0 ? { delay: diff, status: 'Late' } : { delay: 0, status: 'On Time' };
}

async function getDateRangeCompat(filters = {}) {
  const ymd = getDateRangeYmd(filters);
  return {
    from: ymd.from,
    to: ymd.to
  };
}

async function getIsoDateStringCompat(dateInput) {
  const d = parseDateSafe(dateInput);
  return d ? d.toISOString().slice(0, 10) : null;
}

async function getDateRangeStringsCompat(filters = {}) {
  const { from, to } = getDateRangeYmd(filters);
  const fromDate = from ? `${String(from).slice(0, 4)}-${String(from).slice(4, 6)}-${String(from).slice(6, 8)}` : null;
  const toDate = to ? `${String(to).slice(0, 4)}-${String(to).slice(4, 6)}-${String(to).slice(6, 8)}` : null;
  return { from: fromDate, to: toDate };
}

async function getDateRangeYmdCompat(filters = {}) {
  return getDateRangeYmd(filters);
}

async function getMisDataOptimizedCompat(allData, teamMembers, filters = {}) {
  const userName = (teamMembers && teamMembers[0]) || '';
  return getMisData(userName, 'Admin', filters);
}

async function getWorkRequestReportDataCompat(teamMembers = [], filters = {}) {
  const userName = (teamMembers && teamMembers[0]) || '';
  const payload = await getAllReportData(userName, 'Admin', filters);
  return payload.workRequestReport || [];
}

async function cleanStrCompat(str) {
  return String(str || '').trim().toLowerCase();
}

async function getFmsReportDataCompat(teamMembers = [], filters = {}) {
  const userName = (teamMembers && teamMembers[0]) || '';
  const rows = await getFmsTasksForEmployee(userName, 'Admin', filters);
  return rows;
}

async function getDelegationReportDataCompat(userName, userRole, teamMembers = [], filters = {}) {
  const payload = await getAllReportData(userName, userRole, filters);
  return payload.delegationReport || [];
}

async function getChecklistReportDataCompat(teamMembers = [], filters = {}) {
  const userName = (teamMembers && teamMembers[0]) || '';
  const payload = await getAllReportData(userName, 'Admin', filters);
  return payload.checklistReport || [];
}

async function getProjectReportDataCompat(teamMembers = [], filters = {}) {
  const userName = (teamMembers && teamMembers[0]) || '';
  const payload = await getAllReportData(userName, 'Admin', filters);
  return payload.projectReport || [];
}

async function submitTaskForApprovalCompat(taskId, remarks, filesData = []) {
  return submitTaskWrapper('Task', taskId, remarks, filesData);
}

async function updateTaskStatusCompat(taskId, status, remarks) {
  return updateStatusWrapper('Delegation', taskId, status, remarks, null);
}

async function updateChecklistStatusCompat(taskId, planDate, newStatus, remarks) {
  return updateStatusWrapper('Checklist', taskId, newStatus, remarks, planDate);
}

async function getDelegatedSubmissionsForEmployeeCompat(userName) {
  const rows = await getEmployeeSubmissions(userName);
  return rows.delegations || [];
}

async function getChecklistSubmissionsForEmployeeCompat(userName) {
  const rows = await getEmployeeSubmissions(userName);
  return rows.checklists || [];
}

async function getWorkRequestSubmissionsForEmployeeCompat(userName) {
  const rows = await getEmployeeSubmissions(userName);
  return rows.workRequests || [];
}

async function getLastTargetsMapCompat() {
  return {};
}

async function toYmdIntCompat(dateInput) {
  return toYmdInt(dateInput);
}

async function isTaskInFilterCompat(taskDate, filters = {}) {
  const { from, to } = getDateRangeYmd(filters);
  return isDateInRange(taskDate, from, to);
}

async function isDateInRangeCompat(targetDate, fromDate, toDate) {
  return isDateInRange(targetDate, fromDate, toDate);
}

async function isUserMatchCompat(rowUser, filterUser, teamMembers = []) {
  const r = String(rowUser || '').trim().toLowerCase();
  const f = String(filterUser || '').trim().toLowerCase();
  if (!f) return true;
  if (r === f) return true;
  return new Set((teamMembers || []).map((x) => String(x).trim().toLowerCase())).has(r);
}

async function clearAppCacheCompat() {
  // Clear known keys from in-memory and redis cache.
  await clearCached(cache, cacheKey('users', 'allRows'));
  return 'success';
}

async function getRealLastRowCompat() {
  return 1;
}

async function formatSafeDateCompat(dateInput, format = 'dd-MMM-yyyy') {
  const d = parseDateSafe(dateInput);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

async function getDashboardMetrics_OptimizedCompat(allData, userName, userRole, filters = {}, teamMembers = []) {
  const payload = await getDashboardPageData(userName, userRole, filters || {});
  return payload.metrics;
}

async function getMyPriorityTasks_OptimizedCompat(allData, userName) {
  const payload = await getDashboardPageData(userName, 'Employee', { period: 'all', status: 'All Statuses' });
  return payload.priorityTasks || [];
}

async function getDashboardTrendData_OptimizedCompat(allData, userName, userRole) {
  const payload = await getDashboardPageData(userName, userRole, { period: 'all', status: 'All Statuses' });
  return payload.trendData || { labels: [], created: [], completed: [] };
}

async function getProjectStatusData_OptimizedCompat(allData, userName, userRole) {
  const payload = await getDashboardPageData(userName, userRole, { period: 'all', status: 'All Statuses' });
  return payload.projectStatus || [];
}

async function getTeamPriorityTasks_OptimizedCompat(allData) {
  return [];
}

async function getMyPriorityTasksCompat(userName) {
  const payload = await getDashboardPageData(userName, 'Employee', { period: 'all', status: 'All Statuses' });
  return payload.priorityTasks || [];
}

async function getDashboardTrendDataCompat(userName, userRole) {
  const payload = await getDashboardPageData(userName, userRole, { period: 'all', status: 'All Statuses' });
  return payload.trendData || { labels: [], created: [], completed: [] };
}

async function getDashboardMetricsCompat(userName, userRole, filters = {}) {
  const payload = await getDashboardPageData(userName, userRole, filters || {});
  return payload.metrics;
}

async function getProjectStatusDataCompat(userName, userRole) {
  const payload = await getDashboardPageData(userName, userRole, { period: 'all', status: 'All Statuses' });
  return payload.projectStatus || [];
}

async function getTeamPriorityTasksCompat() {
  return [];
}

async function getFmsStatusData_OptimizedCompat(allData, userName, userRole) {
  const rows = await getFmsTasksForEmployee(userName, userRole, { period: 'all', status: 'All Statuses' });
  const acc = new Map();

  for (const row of rows) {
    const name = String(row.fmsName || 'Unknown').trim() || 'Unknown';
    if (!acc.has(name)) {
      acc.set(name, { name, pending: 0, completed: 0, total: 0 });
    }

    const bucket = acc.get(name);
    if (String(row.status || '').toLowerCase() === 'completed') {
      bucket.completed += 1;
    } else {
      bucket.pending += 1;
    }
    bucket.total += 1;
  }

  return Array.from(acc.values()).sort((a, b) => b.total - a.total);
}

async function getAppInitialStateCompat(userName, userRole) {
  return getUnifiedAppData(userName, userRole);
}

async function getAllAppDataRawCompat() {
  return { delegations: [], workRequests: [], checklists: [], fms: [] };
}

async function setupDailyTriggerCompat() {
  return { success: true, message: 'Scheduler is handled by backend cron jobs.' };
}

async function getAllUsersDataCompat() {
  return getCachedUsersDataCompat();
}

async function onOpenCompat() {
  return { success: true, message: 'UI menu hooks are not required in server runtime.' };
}

async function onEditCompat() {
  return { success: true, message: 'Sheet onEdit trigger is not used in MERN runtime.' };
}

async function setupSheetCompat() {
  return { success: true, message: 'Sheet bootstrap is replaced by MongoDB models/migrations.' };
}

async function updateDelegationRowStatusCompat(taskId, status, remarks) {
  return updateStatusWrapper('Delegation', taskId, status, remarks, null);
}

async function updateWorkRequestRowStatusCompat(requestId, status, remarks) {
  return updateStatusWrapper('WorkRequest', requestId, status, remarks, null);
}

async function updateChecklistRowStatusCompat(taskId, status, remarks, planDate = null) {
  return updateStatusWrapper('Checklist', taskId, status, remarks, planDate);
}

async function recalculateAllStatusesCompat() {
  return { success: true, message: 'Statuses are calculated during write operations in backend services.' };
}

async function doGetCompat() {
  return { success: true, app: 'taskdone-backend', mode: 'api' };
}

async function getCachedDataCompat(key, fallbackValue = null, ttlSec = 120) {
  if (!key) return fallbackValue;
  const existing = await getCached(cache, key);
  if (existing !== null && typeof existing !== 'undefined') return existing;
  if (typeof fallbackValue !== 'undefined') {
    await setCached(cache, key, fallbackValue, ttlSec);
  }
  return fallbackValue;
}

async function getTrueLastRowCompat() {
  const [dCount, wCount, cCount] = await Promise.all([
    DelegationTask.countDocuments({}),
    WorkRequest.countDocuments({}),
    ChecklistTask.countDocuments({})
  ]);
  return dCount + wCount + cCount;
}

async function findUserInSheetsForUpdateCompat(identifier, colIndex) {
  return findUserInSheetsCompat(identifier, colIndex);
}

async function getActiveUsersSetCompat() {
  const rows = await User.find({ status: 'Active' }).select('name').lean();
  return rows.map((r) => String(r.name || '').trim()).filter(Boolean);
}

async function calculateMetricsGenericCompat(rows = []) {
  const total = Array.isArray(rows) ? rows.length : 0;
  const done = (rows || []).filter((x) => String(x.status || '').toLowerCase() === 'done').length;
  const pending = Math.max(total - done, 0);
  return {
    total,
    done,
    pending,
    tasksDelayed: 0,
    totalDelayDays: 0,
    doneOnTime: done
  };
}

function normalizeUserNameInput(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name.trim();
    if (typeof value.userName === 'string') return value.userName.trim();
    if (value.user && typeof value.user.name === 'string') return value.user.name.trim();
  }
  return String(value || '').trim();
}

async function getDetailedDataForUserCompat(employeeName, kpiCategory, filters = {}, context = {}) {
  const targetEmployee = normalizeUserNameInput(employeeName);
  if (!targetEmployee) return [];

  const queryFilters = { ...(filters || {}), employee: targetEmployee };
  const reportData = await getAllReportData(targetEmployee, 'Employee', queryFilters, context);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const parseDateSafe = (d) => {
    if (!d) return null;
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return null;
    return x;
  };

  const getDuration = (target, actual) => {
    const t = parseDateSafe(target);
    if (!t) return '';
    const a = parseDateSafe(actual) || new Date();
    t.setHours(0, 0, 0, 0);
    a.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((a - t) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays} Days` : '';
  };

  const processRow = (row, type) => {
    let id;
    let desc;
    let target;
    let completed;
    let onTimeRaw;
    let statusRaw;
    let fmsNameVal = '';

    if (type === 'delegation') {
      id = row.taskId;
      desc = row.taskDescription;
      target = row.targetDate;
      completed = row.completedDate;
      onTimeRaw = row.onTimeStatus;
      statusRaw = row.taskStatus;
    } else if (type === 'workrequest') {
      id = row.requestId;
      desc = row.description;
      target = row.deadline;
      completed = row.completedDate;
      onTimeRaw = row.onTimeStatus;
      statusRaw = row.status;
    } else if (type === 'checklist') {
      id = row.taskId;
      desc = row.description;
      target = row.planDate;
      completed = row.actualDate;
      onTimeRaw = row.onTimeStatus;
      statusRaw = completed ? 'Completed' : 'Pending';
    } else {
      id = row.stepNo || '#';
      fmsNameVal = row.fmsName;
      desc = row.taskName;
      target = row.planDate;
      completed = row.actualDate;
      onTimeRaw = row.onTimeStatus;
      statusRaw = completed ? 'Completed' : 'Pending';
    }

    const tDate = parseDateSafe(target);
    const cDate = parseDateSafe(completed);

    let displayStatus = 'Pending';
    let differenceStr = '';

    if (cDate || String(statusRaw || '').toLowerCase() === 'completed') {
      if (String(onTimeRaw || '').toLowerCase().includes('late')) {
        displayStatus = 'Late';
        differenceStr = getDuration(target, completed);
      } else {
        displayStatus = 'On Time';
      }
    } else if (tDate && tDate < now) {
      displayStatus = 'Overdue';
      differenceStr = getDuration(target, null);
    }

    return {
      id,
      fmsName: fmsNameVal,
      description: desc || 'No Description',
      targetDate: target || '-',
      completedDate: completed || '',
      displayStatus,
      difference: differenceStr
    };
  };

  const category = String(kpiCategory || '').trim().toLowerCase().replace(/\s+/g, '');
  if (category === 'delegation') return (reportData.delegations || []).map((r) => processRow(r, 'delegation'));
  if (category === 'workrequest') return (reportData.workRequests || []).map((r) => processRow(r, 'workrequest'));
  if (category === 'checklist') return (reportData.checklists || []).map((r) => processRow(r, 'checklist'));
  if (category === 'fms') return (reportData.fms || []).map((r) => processRow(r, 'fms'));

  return [];
}

async function saveAttachmentToDriveCompat(fileData, fileName = 'attachment.bin') {
  const uploaded = await uploadAttachmentDataUri(fileData, fileName);
  return uploaded || { url: null, provider: 'disabled' };
}

function getModelByTaskType(taskType) {
  const normalized = String(taskType || '').trim().toLowerCase();
  if (normalized === 'delegation' || normalized === 'task') return DelegationTask;
  if (normalized === 'workrequest' || normalized === 'work_request') return WorkRequest;
  if (normalized === 'checklist') return ChecklistTask;
  return null;
}

async function findRowByIdCompat(taskType, id) {
  const Model = getModelByTaskType(taskType);
  if (!Model || !id) return null;
  return Model.findOne({ taskId: id }).lean();
}

async function getEmailRecipientCompat(userName) {
  const user = await User.findOne({ name: userName }).select('email companyId').lean();
  return {
    email: user?.email || null,
    companyId: user?.companyId || null
  };
}

async function getEmailForUserCompat(userName) {
  const recipient = await getEmailRecipientCompat(userName);
  return recipient.email || null;
}

async function createEmailTemplateCompat(kind, payload = {}) {
  const safeKind = String(kind || 'Notification').trim();
  const title = String(payload.title || `${safeKind} Update`).trim();
  const body = String(payload.body || 'Please review the latest task update in TaskDone.').trim();
  const details = payload.details && typeof payload.details === 'object' ? payload.details : {};
  return composeProfessionalEmailTemplate({
    category: safeKind,
    action: title,
    recipientName: payload.recipientName || payload.toUserName || 'Team Member',
    title,
    body,
    details
  });
}

async function shouldSendNotificationCompat(kind = '', companyId = null) {
  const key = companyId ? `platformNotificationSettings:${String(companyId)}` : 'platformNotificationSettings';
  const row = await AppSetting.findOne({ key }).select('value').lean();
  const flags = row?.value?.notifications || {};
  const map = {
    delegation: 'assignment',
    checklist: 'submission',
    workrequest: 'submission',
    submission: 'submission',
    completion: 'approval',
    rework: 'rework'
  };
  const flagKey = map[String(kind || '').toLowerCase()] || '';
  if (!flagKey) return true;
  return flags[flagKey] !== false;
}

async function sendDelegationEmailCompat(toUserName, payload = {}) {
  const recipient = await getEmailRecipientCompat(toUserName);
  if (!(await shouldSendNotificationCompat('delegation', recipient.companyId))) {
    return { success: true, skipped: true, reason: 'Assignment email disabled in platform settings.' };
  }
  const to = payload.to || recipient.email;
  if (!to) return { success: false, error: 'Recipient email not found.' };
  const tpl = await createEmailTemplateCompat('Delegation', {
    title: payload.title || 'New Delegation Task',
    body: payload.body || `A delegation task has been assigned to ${toUserName}.`,
    recipientName: toUserName,
    toUserName,
    details: payload.details || {}
  });
  return sendEmail({ to, companyId: recipient.companyId, subject: tpl.subject, html: tpl.html, text: tpl.text });
}

async function sendWorkRequestEmailCompat(toUserName, payload = {}) {
  const recipient = await getEmailRecipientCompat(toUserName);
  if (!(await shouldSendNotificationCompat('workrequest', recipient.companyId))) {
    return { success: true, skipped: true, reason: 'Submission email disabled in platform settings.' };
  }
  const to = payload.to || recipient.email;
  if (!to) return { success: false, error: 'Recipient email not found.' };
  const tpl = await createEmailTemplateCompat('Work Request', {
    title: payload.title || 'Work Request Update',
    body: payload.body || `A work request update is available for ${toUserName}.`,
    recipientName: toUserName,
    toUserName,
    details: payload.details || {}
  });
  return sendEmail({ to, companyId: recipient.companyId, subject: tpl.subject, html: tpl.html, text: tpl.text });
}

async function sendCompletionNotificationCompat(toUserName, payload = {}) {
  const recipient = await getEmailRecipientCompat(toUserName);
  if (!(await shouldSendNotificationCompat('completion', recipient.companyId))) {
    return { success: true, skipped: true, reason: 'Approval email disabled in platform settings.' };
  }
  const to = payload.to || recipient.email;
  if (!to) return { success: false, error: 'Recipient email not found.' };
  const tpl = await createEmailTemplateCompat('Completion', {
    title: payload.title || 'Task Completion Notification',
    body: payload.body || `${toUserName}, a task has been completed and is ready for review.`,
    recipientName: toUserName,
    toUserName,
    details: payload.details || {}
  });
  return sendEmail({ to, companyId: recipient.companyId, subject: tpl.subject, html: tpl.html, text: tpl.text });
}

async function sendChecklistEmailCompat(toUserName, payload = {}) {
  const recipient = await getEmailRecipientCompat(toUserName);
  if (!(await shouldSendNotificationCompat('submission', recipient.companyId))) {
    return { success: true, skipped: true, reason: 'Checklist email disabled in platform settings.' };
  }
  const to = payload.to || recipient.email;
  if (!to) return { success: false, error: 'Recipient email not found.' };
  const tpl = await createEmailTemplateCompat('Checklist', {
    title: payload.title || 'Checklist Task Update',
    body: payload.body || `A checklist update is available for ${toUserName}.`,
    recipientName: toUserName,
    toUserName,
    details: payload.details || {}
  });
  return sendEmail({ to, companyId: recipient.companyId, subject: tpl.subject, html: tpl.html, text: tpl.text });
}

async function fixAppSpeedCompat() {
  await clearAppCacheCompat();
  return { success: true, message: 'Cache cleared and baseline speed optimization applied.' };
}

async function logErrorCompat(err, context = {}) {
  const safeError = err instanceof Error ? err : new Error(String(err || 'Unknown error'));
  console.error('[gasCompatService]', safeError.message, context);
  return false;
}

async function silentReloadCompat() {
  return { success: true, message: 'No-op in API runtime.' };
}

async function archiveOldDataCompat(days = 180) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(days || 180));

  const [delegations, workRequests, checklists] = await Promise.all([
    DelegationTask.countDocuments({ updatedAt: { $lt: cutoff }, status: 'Completed' }),
    WorkRequest.countDocuments({ updatedAt: { $lt: cutoff }, status: 'Completed' }),
    ChecklistTask.countDocuments({ updatedAt: { $lt: cutoff }, approvalStatus: 'Completed' })
  ]);

  return {
    success: true,
    dryRun: true,
    cutoff,
    counts: { delegations, workRequests, checklists }
  };
}

async function superFixAppSpeedCompat() {
  await clearAppCacheCompat();
  await setCached(cache, cacheKey('warmup', 'users'), await getCachedUsersDataCompat(), 120);
  return { success: true, message: 'Cache reset and warmup complete.' };
}

const methodMap = {
  checkCredentials,
  getProjects,
  getProjectsWithStatus,
  getAllUsers,
  getAdminsAndEmployees,
  getHierarchyData,
  saveHierarchy,
  getUsersForManagement,
  upsertUser,
  deleteUser,
  manageProject,
  getTeamMembersWithManager,
  getNotificationCounts,
  getUnifiedAppData,
  saveFmsSheetSetting,

  createTasksDaily,
  isTaskDueToday,
  getExistingTasks,
  addTasksToSheet,
  setupDailyTrigger: setupDailyTriggerCompat,
  saveUserWeeklyScore,
  getInitialApplicationData: getInitialApplicationDataCompat,
  _getAllUsersData: getAllUsersDataCompat,
  getCachedUsersData: getCachedUsersDataCompat,
  findUserInSheets: findUserInSheetsCompat,
  onOpen: onOpenCompat,
  onEdit: onEditCompat,
  setupSheet: setupSheetCompat,
  parseDate_: parseDateCompat,
  _calculateDelay: calculateDelayCompat,
  updateDelegationRowStatus: updateDelegationRowStatusCompat,
  updateWorkRequestRowStatus: updateWorkRequestRowStatusCompat,
  updateChecklistRowStatus: updateChecklistRowStatusCompat,
  recalculateAllStatuses: recalculateAllStatusesCompat,
  doGet: doGetCompat,
  getCachedData_: getCachedDataCompat,
  getTrueLastRow: getTrueLastRowCompat,
  findUserInSheetsForUpdate: findUserInSheetsForUpdateCompat,
  getActiveUsersSet_: getActiveUsersSetCompat,
  getTeamMembers: getTeamMembersCompat,
  getDashboardPageData,
  getDashboardMetrics_Optimized: getDashboardMetrics_OptimizedCompat,
  calculateMetricsGeneric: calculateMetricsGenericCompat,
  getTasksForApproval,
  getDelegationTasksForApproval: getDelegationTasksForApprovalCompat,
  getWorkRequestsForApproval: getWorkRequestsForApprovalCompat,
  getChecklistTasksForApproval: getChecklistTasksForApprovalCompat,
  updateWorkRequestStatus: updateWorkRequestStatusCompat,
  getEmployeeDashboardPageData,
  getMyPriorityTasks_Optimized: getMyPriorityTasks_OptimizedCompat,
  getDashboardTrendData_Optimized: getDashboardTrendData_OptimizedCompat,
  getProjectStatusData_Optimized: getProjectStatusData_OptimizedCompat,
  getTeamPriorityTasks_Optimized: getTeamPriorityTasks_OptimizedCompat,
  getMyPriorityTasks: getMyPriorityTasksCompat,
  getDashboardTrendData: getDashboardTrendDataCompat,
  getDashboardMetrics: getDashboardMetricsCompat,
  getDateRange: getDateRangeCompat,
  parseDateSafe: parseDateCompat,
  getIsoDateString: getIsoDateStringCompat,
  getDateRangeStrings: getDateRangeStringsCompat,
  getDateRangeYmd: getDateRangeYmdCompat,
  getAllPendingTasksForUser,
  getMisData,
  getMisData_Optimized: getMisDataOptimizedCompat,
  getFilteredDataForCard,
  getDetailedDataForUser: getDetailedDataForUserCompat,
  getAllReportData,
  getKraMasterData,
  getWorkRequestReportData: getWorkRequestReportDataCompat,
  cleanStr: cleanStrCompat,
  getFmsReportData: getFmsReportDataCompat,
  getDelegationReportData: getDelegationReportDataCompat,
  getChecklistReportData: getChecklistReportDataCompat,
  getProjectReportData: getProjectReportDataCompat,
  saveTask,
  saveWorkRequest,
  saveChecklistTask,
  saveAttachmentToDrive: saveAttachmentToDriveCompat,
  submitTaskForApproval: submitTaskForApprovalCompat,
  findRowById: findRowByIdCompat,
  updateTaskStatus: updateTaskStatusCompat,
  markChecklistTaskDone,
  markChecklistTasksDoneBulk,
  updateChecklistStatus: updateChecklistStatusCompat,
  getProjectStatusData: getProjectStatusDataCompat,
  getDelegatedTasksForEmployee,
  getUserWorkRequests,
  getChecklistTasksForEmployee,
  getDelegatedSubmissionsForEmployee: getDelegatedSubmissionsForEmployeeCompat,
  getChecklistSubmissionsForEmployee: getChecklistSubmissionsForEmployeeCompat,
  getWorkRequestSubmissionsForEmployee: getWorkRequestSubmissionsForEmployeeCompat,
  sendDelegationEmail: sendDelegationEmailCompat,
  sendWorkRequestEmail: sendWorkRequestEmailCompat,
  sendChecklistEmail: sendChecklistEmailCompat,
  sendCompletionNotification: sendCompletionNotificationCompat,
  getEmailForUser: getEmailForUserCompat,
  createEmailTemplate: createEmailTemplateCompat,
  getFmsTasksForEmployee,
  markFmsTaskDone,
  saveMisWeeklySnapshot,
  getLastTargetsMap: getLastTargetsMapCompat,
  toYmdInt: toYmdIntCompat,
  isTaskInFilter: isTaskInFilterCompat,
  isDateInRange: isDateInRangeCompat,
  isUserMatch: isUserMatchCompat,
  getEmployeePerformanceReport,
  getTeamPriorityTasks: getTeamPriorityTasksCompat,
  getFmsStatusData_Optimized: getFmsStatusData_OptimizedCompat,
  fixAppSpeed: fixAppSpeedCompat,
  submitTaskWrapper,
  updateStatusWrapper,
  getAllAppDataRaw: getAllAppDataRawCompat,
  clearAppCache: clearAppCacheCompat,
  logError: logErrorCompat,
  getAppInitialState: getAppInitialStateCompat,
  silentReload: silentReloadCompat,
  getEmployeeSubmissions,
  archiveOldData: archiveOldDataCompat,
  superFixAppSpeed: superFixAppSpeedCompat,
  getRealLastRow: getRealLastRowCompat,
  formatSafeDate: formatSafeDateCompat
};

export async function runGasMethod(method, params = [], context = {}) {
  const fn = methodMap[method];
  if (!fn) {
    throw new ApiError(404, `Unknown method: ${method}`);
  }
  return fn(...params, context);
}

export function listGasMethods() {
  return Object.keys(methodMap).sort();
}

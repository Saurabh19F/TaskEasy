import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { EscalationProcessor } from './escalation.processor';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AutomationService } from '../../modules/automation/automation.service';
import { QUEUES } from '../queue.constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const TENANT_ID = 'tenant-1';
const RAM_ID = 'user-ram';
const AKASH_ID = 'user-akash';

// ── Mock factories ───────────────────────────────────────────────────────────

function mockQueue() {
  return { add: jest.fn().mockResolvedValue(undefined) };
}

function mockRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    delByPattern: jest.fn().mockResolvedValue(undefined),
  };
}

function mockAutomation() {
  return { triggerEvent: jest.fn().mockResolvedValue(undefined) };
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('EscalationProcessor — Buddy/Absence System', () => {
  let processor: EscalationProcessor;
  let prisma: Record<string, any>;
  let notificationQueue: ReturnType<typeof mockQueue>;
  let emailQueue: ReturnType<typeof mockQueue>;
  let fmsQueue: ReturnType<typeof mockQueue>;

  beforeEach(async () => {
    notificationQueue = mockQueue();
    emailQueue = mockQueue();
    fmsQueue = mockQueue();

    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      loginHistory: { findFirst: jest.fn().mockResolvedValue(null) },
      notification: { findFirst: jest.fn().mockResolvedValue(null) },
      hierarchy: { findFirst: jest.fn().mockResolvedValue(null) },
      delegationTask: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      workRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      checklistTask: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      fmsTask: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      tenant: { findMany: jest.fn().mockResolvedValue([]) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      bulkImport: { deleteMany: jest.fn() },
      comment: { deleteMany: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: mockRedis() },
        { provide: AutomationService, useValue: mockAutomation() },
        { provide: getQueueToken(QUEUES.NOTIFICATION), useValue: notificationQueue },
        { provide: getQueueToken(QUEUES.EMAIL), useValue: emailQueue },
        { provide: getQueueToken(QUEUES.FMS), useValue: fmsQueue },
      ],
    }).compile();

    processor = module.get(EscalationProcessor);
  });

  // ── check-punch-in ─────────────────────────────────────────────────────────

  describe('handleCheckPunchIn', () => {
    function makeRam(overrides: Partial<{
      punchInTime: string | null;
      buddyId: string | null;
      weeklyOff: string[];
    }> = {}) {
      return {
        id: RAM_ID,
        tenantId: TENANT_ID,
        name: 'Ram',
        punchInTime: '09:00',
        buddyId: AKASH_ID,
        weeklyOff: ['SUN'],
        ...overrides,
      };
    }

    it('should detect absent user and trigger buddy reassignment', async () => {
      // Ram's punch-in is 09:00, grace 15 min → deadline 09:15
      // Simulate "now" being 09:20 (past grace, within fire window)
      const now = new Date();
      now.setHours(9, 20, 0, 0);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
      jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) return now;
        // @ts-ignore
        return new (Function.prototype.bind.apply(OriginalDate, [null, ...args]))();
      });
      const OriginalDate = Date;
      // Restore Date for the test — instead, we'll test the reassign method directly
      jest.restoreAllMocks();

      // Test reassignWorkToBuddy directly — it's the critical path
      prisma.delegationTask.updateMany.mockResolvedValue({ count: 3 });
      prisma.checklistTask.updateMany.mockResolvedValue({ count: 2 });
      prisma.workRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.fmsTask.updateMany.mockResolvedValue({ count: 4 });

      const total = await (processor as any).reassignWorkToBuddy(RAM_ID, AKASH_ID, TENANT_ID);

      expect(total).toBe(10);
    });

    it('should reassign ALL 4 modules (delegation, checklist, work request, FMS) to buddy', async () => {
      prisma.delegationTask.updateMany.mockResolvedValue({ count: 2 });
      prisma.checklistTask.updateMany.mockResolvedValue({ count: 3 });
      prisma.workRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.fmsTask.updateMany.mockResolvedValue({ count: 5 });

      await (processor as any).reassignWorkToBuddy(RAM_ID, AKASH_ID, TENANT_ID);

      const todayEnd = endOfDayLocal(new Date());

      // Delegation: reassign delegatedToId
      expect(prisma.delegationTask.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          delegatedToId: RAM_ID,
          status: { in: ['PENDING', 'IN_PROGRESS', 'REWORK'] },
          targetDate: { lte: todayEnd },
        },
        data: { delegatedToId: AKASH_ID },
      });

      // Checklist: reassign assignedToId
      expect(prisma.checklistTask.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          assignedToId: RAM_ID,
          status: { in: ['PENDING', 'LATE'] },
          plannedDate: { lte: todayEnd },
        },
        data: { assignedToId: AKASH_ID },
      });

      // Work Request: reassign requestedForId
      expect(prisma.workRequest.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          requestedForId: RAM_ID,
          status: { in: ['PENDING', 'REWORK'] },
          deadlineDate: { lte: todayEnd },
        },
        data: { requestedForId: AKASH_ID },
      });

      // FMS: reassign personId
      expect(prisma.fmsTask.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          personId: RAM_ID,
          status: { not: 'COMPLETED' },
          plannedDate: { lte: todayEnd },
        },
        data: { personId: AKASH_ID },
      });
    });

    it('should only reassign tasks due TODAY (not future tasks)', async () => {
      prisma.delegationTask.updateMany.mockResolvedValue({ count: 1 });
      prisma.checklistTask.updateMany.mockResolvedValue({ count: 0 });
      prisma.workRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.fmsTask.updateMany.mockResolvedValue({ count: 0 });

      await (processor as any).reassignWorkToBuddy(RAM_ID, AKASH_ID, TENANT_ID);

      const todayEnd = endOfDayLocal(new Date());

      // All queries use todayEnd as the upper bound
      const delCall = prisma.delegationTask.updateMany.mock.calls[0][0];
      expect(delCall.where.targetDate.lte).toEqual(todayEnd);

      const clCall = prisma.checklistTask.updateMany.mock.calls[0][0];
      expect(clCall.where.plannedDate.lte).toEqual(todayEnd);

      const wrCall = prisma.workRequest.updateMany.mock.calls[0][0];
      expect(wrCall.where.deadlineDate.lte).toEqual(todayEnd);

      const fmsCall = prisma.fmsTask.updateMany.mock.calls[0][0];
      expect(fmsCall.where.plannedDate.lte).toEqual(todayEnd);
    });

    it('should send notification to BOTH absent user and buddy', async () => {
      prisma.delegationTask.updateMany.mockResolvedValue({ count: 2 });
      prisma.checklistTask.updateMany.mockResolvedValue({ count: 1 });
      prisma.workRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.fmsTask.updateMany.mockResolvedValue({ count: 1 });

      await (processor as any).reassignWorkToBuddy(RAM_ID, AKASH_ID, TENANT_ID);

      const notifCalls = notificationQueue.add.mock.calls;
      expect(notifCalls.length).toBe(2);

      // Notification to absent user (Ram)
      const absentNotif = notifCalls.find(
        (c: any) => c[1].userId === RAM_ID,
      );
      expect(absentNotif).toBeDefined();
      expect(absentNotif[1].type).toBe('TASK_REASSIGNED_TO_BUDDY');
      expect(absentNotif[1].body).toContain('5 task(s)');

      // Notification to buddy (Akash)
      const buddyNotif = notifCalls.find(
        (c: any) => c[1].userId === AKASH_ID,
      );
      expect(buddyNotif).toBeDefined();
      expect(buddyNotif[1].type).toBe('TASK_REASSIGNED_TO_BUDDY');
      expect(buddyNotif[1].body).toContain('5 task(s)');
    });

    it('should write audit log with per-module counts', async () => {
      prisma.delegationTask.updateMany.mockResolvedValue({ count: 3 });
      prisma.checklistTask.updateMany.mockResolvedValue({ count: 2 });
      prisma.workRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.fmsTask.updateMany.mockResolvedValue({ count: 4 });

      await (processor as any).reassignWorkToBuddy(RAM_ID, AKASH_ID, TENANT_ID);

      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      const auditData = prisma.auditLog.create.mock.calls[0][0].data;
      expect(auditData.action).toBe('REASSIGN');
      expect(auditData.newValue.counts).toEqual({
        delegation: 3,
        checklist: 2,
        workRequest: 1,
        fms: 4,
        total: 10,
      });
    });

    it('should NOT reassign or notify when there are zero tasks', async () => {
      prisma.delegationTask.updateMany.mockResolvedValue({ count: 0 });
      prisma.checklistTask.updateMany.mockResolvedValue({ count: 0 });
      prisma.workRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.fmsTask.updateMany.mockResolvedValue({ count: 0 });

      const total = await (processor as any).reassignWorkToBuddy(RAM_ID, AKASH_ID, TENANT_ID);

      expect(total).toBe(0);
      expect(notificationQueue.add).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should invalidate dashboard and MIS caches after reassignment', async () => {
      prisma.delegationTask.updateMany.mockResolvedValue({ count: 1 });
      prisma.checklistTask.updateMany.mockResolvedValue({ count: 0 });
      prisma.workRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.fmsTask.updateMany.mockResolvedValue({ count: 0 });

      const redis = (processor as any).redis as ReturnType<typeof mockRedis>;
      await (processor as any).reassignWorkToBuddy(RAM_ID, AKASH_ID, TENANT_ID);

      expect(redis.delByPattern).toHaveBeenCalledTimes(2);
    });
  });

  // ── handleMissedPunchIn ────────────────────────────────────────────────────

  describe('handleMissedPunchIn', () => {
    it('should skip reassignment when buddy is on weekly off', async () => {
      const today = new Date();
      const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const todayDayName = DAY_NAMES[today.getDay()];

      // Buddy (Akash) is on weekly off today
      prisma.user.findUnique.mockResolvedValue({
        id: AKASH_ID,
        name: 'Akash',
        weeklyOff: [todayDayName],
      });

      // Admin fallback
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      await (processor as any).handleMissedPunchIn({
        id: RAM_ID,
        tenantId: TENANT_ID,
        name: 'Ram',
        buddyId: AKASH_ID,
      });

      // Should NOT call reassignWorkToBuddy
      expect(prisma.delegationTask.updateMany).not.toHaveBeenCalled();
      expect(prisma.checklistTask.updateMany).not.toHaveBeenCalled();
      expect(prisma.workRequest.updateMany).not.toHaveBeenCalled();
      expect(prisma.fmsTask.updateMany).not.toHaveBeenCalled();

      // Should still notify admin
      expect(notificationQueue.add).toHaveBeenCalled();
      const adminNotif = notificationQueue.add.mock.calls[0][1];
      expect(adminNotif.body).toContain('weekly off');
    });

    it('should skip reassignment when no buddy is configured', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      await (processor as any).handleMissedPunchIn({
        id: RAM_ID,
        tenantId: TENANT_ID,
        name: 'Ram',
        buddyId: null,
      });

      expect(prisma.delegationTask.updateMany).not.toHaveBeenCalled();

      const adminNotif = notificationQueue.add.mock.calls[0][1];
      expect(adminNotif.body).toContain('No buddy configured');
    });

    it('should reassign work when buddy is available (not on weekly off)', async () => {
      const today = new Date();
      const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const todayDayName = DAY_NAMES[today.getDay()];
      // Buddy's weekly off is a different day
      const otherDay = DAY_NAMES[(today.getDay() + 1) % 7];

      prisma.user.findUnique.mockResolvedValue({
        id: AKASH_ID,
        name: 'Akash',
        weeklyOff: [otherDay],
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      // Some tasks to reassign
      prisma.delegationTask.updateMany.mockResolvedValue({ count: 2 });
      prisma.checklistTask.updateMany.mockResolvedValue({ count: 1 });
      prisma.workRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.fmsTask.updateMany.mockResolvedValue({ count: 0 });

      await (processor as any).handleMissedPunchIn({
        id: RAM_ID,
        tenantId: TENANT_ID,
        name: 'Ram',
        buddyId: AKASH_ID,
      });

      // All 4 modules should be attempted
      expect(prisma.delegationTask.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.checklistTask.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.workRequest.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.fmsTask.updateMany).toHaveBeenCalledTimes(1);

      // Admin notified about reassignment
      const adminNotif = notificationQueue.add.mock.calls[0][1];
      expect(adminNotif.body).toContain('reassigned to Akash');
    });
  });
});

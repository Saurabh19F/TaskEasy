import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { AutomationService } from '../../modules/automation/automation.service';
import { generateChecklistTaskId } from '../../common/utils/id-generator.utils';
import { parseFrontendDateTime, skipToNextWorkingDay } from '../../common/utils/date.utils';
import { QUEUES } from '../queue.constants';

export interface GenerateChecklistTasksJob {
  masterId: string;
  tenantId: string;
}

@Processor(QUEUES.CHECKLIST)
export class ChecklistProcessor {
  private readonly logger = new Logger(ChecklistProcessor.name);

  constructor(
    private prisma: PrismaService,
    private automation: AutomationService,
    @InjectQueue(QUEUES.NOTIFICATION) private notificationQueue: Queue,
  ) {}

  /**
   * Generates planned checklist task instances from a master.
   * Called when a checklist master is created.
   */
  @Process('generate-tasks')
  async handleGenerateTasks(job: Job<GenerateChecklistTasksJob>) {
    const { masterId, tenantId } = job.data;

    const master = await this.prisma.checklistMaster.findUnique({
      where: { id: masterId },
    });
    if (!master || !master.isActive) return;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true, workingDays: true },
    });
    const timezone = tenant?.timezone ?? 'UTC';
    const workingDays = tenant?.workingDays?.length ? tenant.workingDays : [1, 2, 3, 4, 5, 6];
    const startTime = master.startTime || '09:00';

    const rawDates = this.generateOccurrenceDates(
      master.startDate,
      master.frequency as any,
      master.endDate,
    );

    const rangeEnd = master.endDate
      ?? new Date(master.startDate.getFullYear() + 1, master.startDate.getMonth(), master.startDate.getDate());
    const holidays = await this.prisma.holidayCalendar.findMany({
      where: { tenantId, date: { gte: master.startDate, lte: rangeEnd } },
      select: { date: true },
    });
    const holidayDates = holidays.map((h) => h.date);

    const dates = rawDates.map((d) => skipToNextWorkingDay(d, workingDays, holidayDates, timezone));

    const existingCount = await this.prisma.checklistTask.count({ where: { tenantId } });

    const tasks = dates.map((date, i) => ({
      tenantId,
      masterId,
      taskId: generateChecklistTaskId(existingCount + i + 1),
      assignedToId: master.assignedToId,
      projectId: master.projectId,
      title: master.title,
      description: master.description,
      frequency: master.frequency,
      // Combine the occurrence's calendar date with the master's configured
      // Start Time, in the tenant's timezone — previously plannedDate only
      // ever carried master.startDate's original (midnight) time component,
      // so every checklist task was effectively planned for 00:00 regardless
      // of what Start Time the admin set. startTime was stored separately
      // as `plannedTime` but never actually fed into the real DateTime used
      // for overdue/on-time calculations and MIS filtering.
      plannedDate: parseFrontendDateTime(this.toDateString(date), startTime, timezone),
      plannedTime: master.startTime,
      attachmentRequired: master.attachmentRequired,
    }));

    if (tasks.length > 0) {
      await this.prisma.checklistTask.createMany({ data: tasks });
      this.logger.log(`Generated ${tasks.length} checklist tasks for master: ${masterId}`);

      const firstTask = await this.prisma.checklistTask.findFirst({
        where: { tenantId, masterId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, taskId: true },
      });

      if (firstTask) {
        await this.notificationQueue.add('create-notification', {
          tenantId,
          userId: master.assignedToId,
          type: 'CHECKLIST_ASSIGNED',
          title: '📝 Checklist Assigned',
          body: `Checklist "${master.title}" has been assigned to you. ${tasks.length} planned task(s) have been scheduled.`,
          refType: 'CHECKLIST',
          refId: firstTask.id,
        });
      }
    }
  }

  /**
   * Daily job: check for missed checklist tasks.
   * Marks overdue tasks as LATE.
   */
  @Process('check-missed')
  async handleCheckMissed(job: Job<{ tenantId?: string }>) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    const where: any = {
      status: 'PENDING',
      plannedDate: { lt: yesterday },
      ...(job.data.tenantId ? { tenantId: job.data.tenantId } : {}),
    };

    // Switched from a single updateMany() to findMany() + per-row update so each
    // missed task's id/title/assignee/tenantId is available to fire CHECKLIST_MISSED
    // — updateMany() doesn't return the affected rows, so there was no way to call
    // AutomationService.triggerEvent() with anything meaningful per task.
    const missed = await this.prisma.checklistTask.findMany({
      where,
      select: { id: true, tenantId: true, title: true, assignedToId: true },
    });

    if (missed.length === 0) return;

    await Promise.all(
      missed.map(async (task) => {
        await this.prisma.checklistTask.update({
          where: { id: task.id },
          data: { status: 'LATE' },
        });
        await this.automation.triggerEvent(task.tenantId, 'CHECKLIST_MISSED', {
          taskId: task.id,
          taskTitle: task.title,
          refType: 'CHECKLIST',
          assigneeId: task.assignedToId,
        });
      }),
    );

    this.logger.log(`Marked ${missed.length} checklist tasks as LATE`);
  }

  /**
   * Formats a Date as YYYY-MM-DD using local getters — matching how
   * generateOccurrenceDates() steps dates internally (date-fns add*()
   * reads/writes via local getters), so the calendar date extracted here
   * is consistent with what was actually stepped.
   */
  private toDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private generateOccurrenceDates(
    startDate: Date,
    frequency: string,
    endDate?: Date | null,
    maxOccurrences = 365,
  ): Date[] {
    const dates: Date[] = [];
    let current = new Date(startDate);
    const limit = endDate || new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());

    while (current <= limit && dates.length < maxOccurrences) {
      dates.push(new Date(current));

      switch (frequency) {
        case 'DAILY':        current.setDate(current.getDate() + 1); break;
        case 'WEEKLY':       current.setDate(current.getDate() + 7); break;
        case 'FORTNIGHTLY':  current.setDate(current.getDate() + 14); break;
        case 'MONTHLY':      current.setMonth(current.getMonth() + 1); break;
        case 'QUARTERLY':    current.setMonth(current.getMonth() + 3); break;
        case 'HALF_YEARLY':  current.setMonth(current.getMonth() + 6); break;
        case 'YEARLY':       current.setFullYear(current.getFullYear() + 1); break;
        default:             return dates; // ONE_TIME or unknown — one occurrence
      }
    }

    return dates;
  }
}

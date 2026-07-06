import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUES } from './queue.constants';

/**
 * Registers Bull's native repeatable jobs on boot.
 *
 * Several processors (escalation.processor's `check-sla`, fms.processor's
 * `escalate-step`, checklist.processor's `check-missed`) were previously
 * dead code: they existed and worked when invoked, but nothing ever invoked
 * them. This service is what actually triggers those recurring sweeps —
 * without it, overdue delegation tasks, FMS steps, and checklist tasks are
 * silently never escalated or marked LATE.
 */
@Injectable()
export class QueueSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(QueueSchedulerService.name);

  constructor(
    @InjectQueue(QUEUES.ESCALATION) private escalationQueue: Queue,
    @InjectQueue(QUEUES.CHECKLIST) private checklistQueue: Queue,
  ) {}

  async onModuleInit() {
    try {
      // Bull keys repeatable jobs by name + repeat options, so re-adding these on
      // every app restart does not create duplicate schedules.
      await this.escalationQueue.add(
        'check-sla',
        {},
        { repeat: { every: 30 * 60 * 1000 } }, // every 30 minutes
      );
      this.logger.log('Scheduled recurring SLA check (every 30 min) — covers delegation + FMS overdue escalation');

      await this.checklistQueue.add(
        'check-missed',
        {},
        { repeat: { every: 60 * 60 * 1000 } }, // hourly
      );
      this.logger.log('Scheduled recurring checklist missed-task sweep (hourly) — marks overdue PENDING tasks LATE');

      await this.escalationQueue.add(
        'check-punch-in',
        {},
        { repeat: { every: 1 * 60 * 1000 } }, // every 1 minute
      );
      this.logger.log('Scheduled recurring punch-in check (every 1 min) — alerts admin + reassigns work to buddy when someone misses their punch-in window');
    } catch (error: any) {
      this.logger.warn(`Redis queue scheduler skipped during boot: ${error?.message ?? error}`);
    }
  }
}

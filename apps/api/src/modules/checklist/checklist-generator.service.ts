import { Injectable, Logger } from '@nestjs/common';

/**
 * BUG-02 FIX: ChecklistGeneratorService.generateDueTasks() removed.
 *
 * There were two separate systems generating checklist task instances:
 *
 *  1. ChecklistProcessor ('generate-tasks' BullMQ job) — fired when a master
 *     is created. Uses generateOccurrenceDates() to pre-create up to 365
 *     planned task rows from the master's startDate in the tenant timezone.
 *
 *  2. ChecklistGeneratorService.generateDueTasks() — fired daily by the
 *     scheduler. Computed "next" occurrence from `now` via getNextPlannedDate()
 *     and inserted it if missing.
 *
 * The two paths computed plannedDate differently, so the exact-Date duplicate
 * guard failed and duplicate task rows were created.
 *
 * Resolution: ChecklistProcessor (path 1) is the sole authoritative generator.
 * This service is kept as a stub so module wiring doesn't break. The scheduler
 * in queue-scheduler.service.ts should only call 'check-missed', not this.
 */
@Injectable()
export class ChecklistGeneratorService {
  private readonly logger = new Logger(ChecklistGeneratorService.name);

  /**
   * @deprecated No-op. Task generation is handled exclusively by
   * ChecklistProcessor ('generate-tasks' BullMQ job). Remove any scheduler
   * calls to this method.
   */
  async generateDueTasks(): Promise<void> {
    this.logger.warn(
      'generateDueTasks() is a no-op — task generation is handled by ' +
      'ChecklistProcessor. Remove this scheduler call.',
    );
  }
}

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QUEUES } from '../queue.constants';

@Processor(QUEUES.REPORT)
export class ReportProcessor {
  private readonly logger = new Logger(ReportProcessor.name);

  /** Build a heavy report asynchronously and store it for download */
  @Process('build-report')
  async handleBuildReport(job: Job<{
    type: string;
    tenantId: string;
    userId: string;
    filters: Record<string, any>;
    format: 'csv' | 'xlsx' | 'pdf';
  }>) {
    this.logger.log(`Building ${job.data.type} report for tenant ${job.data.tenantId}`);
    // Future: generate file, upload to Cloudinary, notify user with download link
  }

  /** Send weekly performance summary email */
  @Process('weekly-summary')
  async handleWeeklySummary(job: Job<{ tenantId: string }>) {
    this.logger.log(`Sending weekly summary for tenant ${job.data.tenantId}`);
  }
}

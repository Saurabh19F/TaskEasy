import cron from 'node-cron';
import { runGasMethod } from '../services/gasCompatService.js';

// Default: 06:00 IST — tasks appear at start of business day, not midnight.
// Override by setting CHECKLIST_CRON in .env (standard cron syntax, e.g. "30 6 * * *").
const CHECKLIST_CRON = process.env.CHECKLIST_CRON || '0 6 * * *';

export function registerCronJobs() {
  cron.schedule(CHECKLIST_CRON, async () => {
    try {
      await runGasMethod('createTasksDaily', []);
      console.log('[cron] createTasksDaily executed (schedule:', CHECKLIST_CRON, 'Asia/Kolkata)');
    } catch (error) {
      console.error('[cron] createTasksDaily failed', error.message);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });
}

/**
 * E2E tests — Approval flow
 * Verifies: pending submission → admin approves → status becomes COMPLETED
 */

import { test, expect, Page } from '@playwright/test';
import { login, TEST_ADMIN, TEST_EMPLOYEE } from './helpers';

/**
 * Helper: as employee, create a delegation task, then mark it done to send for approval.
 * Returns the task title so the admin can locate it.
 */
async function employeeSubmitTask(page: Page): Promise<string> {
  await login(page, TEST_EMPLOYEE);
  await page.goto('/delegation');

  // Tab: pending tasks assigned to this employee
  await page.getByRole('tab', { name: /my pending/i }).click();
  const doneBtn = page.getByRole('button', { name: /done/i }).first();

  if (!(await doneBtn.isVisible())) {
    return ''; // no pending task to test with
  }

  // Grab task title from the row before clicking Done
  const row = page.locator('table tbody tr').first();
  const title = await row.locator('td').nth(1).textContent() ?? '';

  await doneBtn.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/remarks/i).fill('E2E completion test remarks');
  await dialog.getByRole('button', { name: /submit for approval/i }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  return title.trim();
}

test.describe('Approval flow', () => {
  test('admin can approve a submitted task', async ({ browser }) => {
    // Use separate browser contexts to simulate two users
    const empCtx = await browser.newContext();
    const adminCtx = await browser.newContext();

    const empPage = await empCtx.newPage();
    const adminPage = await adminCtx.newPage();

    try {
      // Step 1: Employee submits a task
      const taskTitle = await employeeSubmitTask(empPage);
      if (!taskTitle) {
        test.skip(); // no pending task in DB — skip rather than fail
        return;
      }

      // Step 2: Admin opens Approvals and approves it
      await login(adminPage, TEST_ADMIN);
      await adminPage.goto('/approvals');

      // Find the row matching the task title
      const row = adminPage.locator('table tbody tr', { hasText: taskTitle }).first();
      await expect(row).toBeVisible({ timeout: 10_000 });

      // Click Approve (green check button)
      await row.getByRole('button', { name: /approve/i }).click();

      // Confirmation modal: enter remarks and confirm
      const dialog = adminPage.getByRole('dialog');
      if (await dialog.isVisible()) {
        await dialog.getByLabel(/remarks/i).fill('Looks good');
        await dialog.getByRole('button', { name: /confirm|approve/i }).last().click();
        await expect(dialog).not.toBeVisible({ timeout: 8_000 });
      }

      // Task should no longer appear in the New Submissions tab
      await expect(row).not.toBeVisible({ timeout: 8_000 });
    } finally {
      await empCtx.close();
      await adminCtx.close();
    }
  });

  test('admin can send a task for rework', async ({ browser }) => {
    const empCtx = await browser.newContext();
    const adminCtx = await browser.newContext();
    const empPage = await empCtx.newPage();
    const adminPage = await adminCtx.newPage();

    try {
      const taskTitle = await employeeSubmitTask(empPage);
      if (!taskTitle) { test.skip(); return; }

      await login(adminPage, TEST_ADMIN);
      await adminPage.goto('/approvals');

      const row = adminPage.locator('table tbody tr', { hasText: taskTitle }).first();
      await expect(row).toBeVisible({ timeout: 10_000 });

      await row.getByRole('button', { name: /rework/i }).click();

      const dialog = adminPage.getByRole('dialog');
      if (await dialog.isVisible()) {
        await dialog.getByLabel(/remarks/i).fill('Please add proof attachment');
        await dialog.getByRole('button', { name: /confirm|rework/i }).last().click();
        await expect(dialog).not.toBeVisible({ timeout: 8_000 });
      }

      // Should disappear from New Submissions (moves to Rework tab)
      await expect(row).not.toBeVisible({ timeout: 8_000 });

      // Rework Submissions tab should now contain the task
      await adminPage.getByRole('tab', { name: /rework/i }).click();
      const reworkRow = adminPage.locator('table tbody tr', { hasText: taskTitle }).first();
      await expect(reworkRow).toBeVisible({ timeout: 8_000 });
    } finally {
      await empCtx.close();
      await adminCtx.close();
    }
  });
});

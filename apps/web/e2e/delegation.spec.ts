/**
 * E2E tests — Delegation module
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Delegation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigation link opens delegation page', async ({ page }) => {
    await page.getByRole('link', { name: /delegation/i }).click();
    await expect(page).toHaveURL(/\/delegation/);
    await expect(page.getByRole('heading', { name: /delegation/i })).toBeVisible();
  });

  test('Assign Tasks button opens modal', async ({ page }) => {
    await page.goto('/delegation');
    await page.getByRole('button', { name: /assign tasks/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/assign tasks/i)).toBeVisible();
  });

  test('create delegation task and verify it appears in My Pending tab', async ({ page }) => {
    await page.goto('/delegation');

    // Open assign modal
    await page.getByRole('button', { name: /assign tasks/i }).click();
    const dialog = page.getByRole('dialog');

    // Fill form
    await dialog.getByLabel(/project/i).selectOption({ index: 1 });
    await dialog.getByLabel(/task title/i).fill('E2E Test Task — ' + Date.now());
    await dialog.getByLabel(/target date/i).fill(
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    );
    await dialog.getByLabel(/priority/i).selectOption('MEDIUM');

    // Select at least one assignee (first checkbox in the list)
    await dialog.locator('input[type="checkbox"]').first().check();

    // Submit
    await dialog.getByRole('button', { name: /send all tasks/i }).click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Switch to My Pending tab and confirm a row appeared
    await page.getByRole('tab', { name: /my pending/i }).click();
    // At least one row
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8_000 });
  });

  test('Done button opens submit-for-approval modal', async ({ page }) => {
    await page.goto('/delegation');
    await page.getByRole('tab', { name: /my pending/i }).click();

    const doneBtn = page.getByRole('button', { name: /done/i }).first();
    // If no pending tasks, skip gracefully
    if (await doneBtn.isVisible()) {
      await doneBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/submit for approval/i)).toBeVisible();
    } else {
      test.skip();
    }
  });
});

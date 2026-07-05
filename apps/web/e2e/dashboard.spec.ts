/**
 * E2E tests — Dashboard
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('shows four module metric cards', async ({ page }) => {
    await page.goto('/dashboard');
    // Each card has a heading: Delegation, Work Requests, Checklist, FMS
    for (const label of ['Delegation', 'Work Requests', 'Checklist', 'FMS']) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test('team/my view toggle visible for admin', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /team view/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /my view/i })).toBeVisible();
  });

  test('switching to My View keeps page functional', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /my view/i }).click();
    // Page should still render without error
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('charts are rendered', async ({ page }) => {
    await page.goto('/dashboard');
    // Recharts renders <svg> elements
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10_000 });
  });

  test('critical tasks section is present', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/critical.*overdue/i)).toBeVisible();
  });
});

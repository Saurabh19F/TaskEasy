/**
 * E2E tests — Authentication flows
 */

import { test, expect } from '@playwright/test';
import { login, logout, TEST_ADMIN } from './helpers';

test.describe('Auth guard', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders required fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill('wrong@example.com');
    await page.getByPlaceholder(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /log in/i }).click();
    // Toast or inline error should appear
    await expect(page.getByText(/invalid|incorrect|unauthorized/i)).toBeVisible({ timeout: 8_000 });
  });

  test('valid admin login lands on dashboard', async ({ page }) => {
    await login(page, TEST_ADMIN);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    await login(page, TEST_ADMIN);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
    // Navigating to /dashboard should redirect back to /login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

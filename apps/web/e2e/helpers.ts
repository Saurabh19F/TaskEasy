/**
 * Shared E2E helpers for TaskEasy Playwright tests
 */

import { Page } from '@playwright/test';

export const TEST_ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@taskeasy.test',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'Test@1234',
};

export const TEST_EMPLOYEE = {
  email: process.env.E2E_EMPLOYEE_EMAIL ?? 'employee@taskeasy.test',
  password: process.env.E2E_EMPLOYEE_PASSWORD ?? 'Test@1234',
};

/** Log in and wait for the dashboard to be visible */
export async function login(page: Page, credentials = TEST_ADMIN) {
  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill(credentials.email);
  await page.getByPlaceholder(/password/i).fill(credentials.password);
  await page.getByRole('button', { name: /log in/i }).click();
  // Wait until dashboard heading is visible
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await page.getByRole('heading', { name: /dashboard/i }).waitFor({ timeout: 10_000 });
}

/** Log out via the profile dropdown */
export async function logout(page: Page) {
  await page.getByRole('button', { name: /profile|avatar/i }).first().click();
  await page.getByRole('menuitem', { name: /logout/i }).click();
  await page.waitForURL('**/login', { timeout: 8_000 });
}

import { type Page } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";

/**
 * Authentication helper functions
 * Reusable utilities for user authentication in tests
 */

export interface TestUser {
  email: string;
  password: string;
  id?: string;
}

/**
 * Get test user credentials from environment variables
 */
export function getTestUser(): TestUser {
  const email = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  const id = process.env.E2E_USERNAME_ID;

  if (!email || !password) {
    throw new Error("E2E_USERNAME and E2E_PASSWORD must be set in .env.test");
  }

  return { email, password, id };
}

/**
 * Login as test user and navigate to goals list
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  const user = getTestUser();
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.loginAndWaitForRedirect(user.email, user.password);
}

/**
 * Perform login and return the page instance
 * Useful for test setup
 */
export async function setupAuthenticatedPage(page: Page): Promise<Page> {
  await loginAsTestUser(page);
  return page;
}

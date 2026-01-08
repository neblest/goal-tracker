import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages";
import { getTestUser } from "./helpers";

test.describe("Authentication", () => {
  test("should login successfully with valid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const user = getTestUser();

    await loginPage.goto();
    await loginPage.login(user.email, user.password);

    // Should redirect to goals page
    await expect(page).toHaveURL("/app/goals");
  });

  test("should show error with invalid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login("invalid@email.com", "wrongpassword");

    // Should show error message
    await expect(loginPage.errorMessage).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL("/login");
  });
});

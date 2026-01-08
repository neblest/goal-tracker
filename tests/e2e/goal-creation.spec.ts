import { test, expect } from "@playwright/test";
import { LoginPage, GoalsListPage, GoalCreateModal } from "./pages";
import { loginAsTestUser, generateGoalData, cleanupTestGoals } from "./helpers";

test.describe("Goal Creation Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestGoals(page);
  });

  test("should complete full goal creation flow", async ({ page }) => {
    // Step 1: User is logged in and waits for goals page to load
    const goalsListPage = new GoalsListPage(page);
    await goalsListPage.waitForLoad();
    await expect(goalsListPage.header).toBeVisible();

    // Step 2: Click Create Goal button
    await goalsListPage.openCreateGoalModal();

    // Step 3: Wait for modal to load
    const createModal = new GoalCreateModal(page);
    await createModal.waitForOpen();
    await expect(createModal.dialogTitle).toBeVisible();

    // Step 4: Fill in values
    const goalData = generateGoalData({
      name: "Complete E2E Test Goal",
      targetValue: "50",
    });

    await createModal.fillForm(goalData);

    // Step 5: Submit the goal
    await createModal.submit();

    // Step 6: Wait for redirect to goal details page
    await page.waitForURL(/\/app\/goals\/[a-f0-9-]+$/);

    // Verify we're on the goal details page
    await expect(page.getByRole("heading", { name: goalData.name })).toBeVisible();
  });

  test("should show validation errors for invalid input", async ({ page }) => {
    const goalsListPage = new GoalsListPage(page);
    await goalsListPage.openCreateGoalModal();

    const createModal = new GoalCreateModal(page);
    await createModal.waitForOpen();

    // Try to submit empty form
    await createModal.submit();

    // Should show validation errors
    await expect(createModal.nameError).toBeVisible();
    await expect(createModal.targetValueError).toBeVisible();
    await expect(createModal.deadlineError).toBeVisible();
  });

  test("should allow canceling goal creation", async ({ page }) => {
    const goalsListPage = new GoalsListPage(page);
    await goalsListPage.openCreateGoalModal();

    const createModal = new GoalCreateModal(page);
    await createModal.waitForOpen();

    // Fill some data
    await createModal.fillGoalName("Test Goal");

    // Click cancel
    await createModal.cancel();

    // Modal should close
    await createModal.waitForClose();
    await expect(createModal.dialog).not.toBeVisible();

    // Should still be on goals list page
    await expect(page).toHaveURL("/app/goals");
  });
});

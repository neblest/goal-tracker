import { test, expect } from "@playwright/test";
import { GoalsListPage } from "./pages";
import { loginAsTestUser, createGoalViaApi, generateGoalData, cleanupTestGoals } from "./helpers";

test.describe("Goals List", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupTestGoals(page);
  });

  test("should display goals list page", async ({ page }) => {
    const goalsListPage = new GoalsListPage(page);
    await goalsListPage.goto();
    await goalsListPage.waitForLoad();

    await expect(goalsListPage.header).toBeVisible();
    await expect(goalsListPage.searchInput).toBeVisible();
    await expect(goalsListPage.createGoalButton.first()).toBeVisible();
  });

  test("should search goals by name", async ({ page }) => {
    // Create a test goal first
    const goalData = generateGoalData({ name: "Unique Search Goal 12345" });
    await createGoalViaApi(page, goalData);

    const goalsListPage = new GoalsListPage(page);
    await goalsListPage.goto();
    await goalsListPage.waitForLoad();

    // Search for the goal
    await goalsListPage.searchGoals("Unique Search Goal");
    await page.waitForTimeout(500); // Wait for debounce

    // Should show the matching goal
    const goalCard = await goalsListPage.getGoalCardByName(goalData.name);
    await expect(goalCard).toBeVisible();
  });

  test("should filter goals by status", async ({ page }) => {
    const goalsListPage = new GoalsListPage(page);
    await goalsListPage.goto();
    await goalsListPage.waitForLoad();

    // Change status filter
    await goalsListPage.filterByStatus("active");
    await page.waitForTimeout(500);

    // All visible goals should be active
    const cards = await goalsListPage.getGoalCards();
    const count = await cards.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        await expect(card).toContainText(/Active|Complete/);
      }
    }
  });

  test("should navigate to goal details when clicking a goal card", async ({ page }) => {
    // Create a test goal
    const goalData = generateGoalData();
    const { id } = await createGoalViaApi(page, goalData);

    const goalsListPage = new GoalsListPage(page);
    await goalsListPage.goto();
    await goalsListPage.waitForLoad();

    // Click the goal card
    await goalsListPage.clickGoalCard(goalData.name);

    // Should navigate to goal details
    await expect(page).toHaveURL(`/app/goals/${id}`);
  });

  test("should show empty state when no goals exist", async ({ page }) => {
    // Clean all goals first
    await cleanupTestGoals(page);

    const goalsListPage = new GoalsListPage(page);
    await goalsListPage.goto();
    await goalsListPage.waitForLoad();

    // Should show empty state
    await expect(goalsListPage.emptyState).toBeVisible();
  });
});

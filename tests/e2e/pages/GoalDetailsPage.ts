import { type Page, type Locator } from "@playwright/test";

/**
 * Page Object Model for Goal Details Page
 * Handles individual goal viewing and interactions
 */
export class GoalDetailsPage {
  readonly page: Page;
  readonly header: Locator;
  readonly backButton: Locator;
  readonly goalName: Locator;
  readonly goalStatus: Locator;
  readonly progressSection: Locator;
  readonly addProgressButton: Locator;
  readonly completeGoalButton: Locator;
  readonly failGoalButton: Locator;
  readonly abandonGoalButton: Locator;
  readonly deleteGoalButton: Locator;
  readonly historySection: Locator;
  readonly aiSummarySection: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator("header").first();
    this.backButton = page.getByRole("link", { name: /back|goals/i });
    this.goalName = page.getByRole("heading", { level: 1 });
    this.goalStatus = page.getByText(/Active|Completed|Failed|Abandoned/);
    this.progressSection = page
      .locator("section")
      .filter({ hasText: /progress/i })
      .first();
    this.addProgressButton = page.getByRole("button", { name: "Add Progress" });
    this.completeGoalButton = page.getByRole("button", { name: /complete/i });
    this.failGoalButton = page.getByRole("button", { name: /fail/i });
    this.abandonGoalButton = page.getByRole("button", { name: /abandon/i });
    this.deleteGoalButton = page.getByRole("button", { name: /delete/i });
    this.historySection = page
      .locator("section")
      .filter({ hasText: /history/i })
      .first();
    this.aiSummarySection = page
      .locator("section")
      .filter({ hasText: /summary|ai/i })
      .first();
    this.logoutButton = page.getByRole("button", { name: "Logout" });
  }

  async goto(goalId: string) {
    await this.page.goto(`/app/goals/${goalId}`);
  }

  async waitForLoad() {
    await this.page.waitForLoadState("networkidle");
  }

  async goBack() {
    await this.backButton.click();
  }

  async addProgress() {
    await this.addProgressButton.click();
  }

  async completeGoal() {
    await this.completeGoalButton.click();
  }

  async failGoal() {
    await this.failGoalButton.click();
  }

  async abandonGoal() {
    await this.abandonGoalButton.click();
  }

  async deleteGoal() {
    await this.deleteGoalButton.click();
  }

  async getProgressPercentage() {
    const progressText = await this.progressSection.getByText(/%/).textContent();
    return progressText ? parseInt(progressText, 10) : 0;
  }

  async getCurrentValue() {
    const valueElement = this.progressSection.getByText(/\d+\s*\/\s*\d+/);
    const text = await valueElement.textContent();
    return text ? text.split("/")[0].trim() : "0";
  }

  async getTargetValue() {
    const valueElement = this.progressSection.getByText(/\d+\s*\/\s*\d+/);
    const text = await valueElement.textContent();
    return text ? text.split("/")[1].trim() : "0";
  }

  async hasAiSummary() {
    return this.aiSummarySection.isVisible();
  }

  async getHistoryItems() {
    return this.historySection.getByRole("listitem");
  }

  async logout() {
    await this.logoutButton.click();
  }
}

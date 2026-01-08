import { type Page, type Locator } from "@playwright/test";

/**
 * Page Object Model for Goals List Page
 * Handles goals listing, filtering, and navigation
 */
export class GoalsListPage {
  readonly page: Page;
  readonly header: Locator;
  readonly logoutButton: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly sortSelect: Locator;
  readonly orderSelect: Locator;
  readonly createGoalButton: Locator;
  readonly loadMoreButton: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;
  readonly errorBanner: Locator;
  readonly retryButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator("header").first();
    this.logoutButton = page.getByRole("button", { name: "Logout" });
    this.searchInput = page.getByPlaceholder("Search by name");
    this.statusFilter = page.getByLabel("Filter by status");
    this.sortSelect = page.getByLabel("Sort", { exact: true });
    this.orderSelect = page.getByLabel("Sort order");

    // Create goal buttons - both in empty state and in grid
    this.createGoalButton = page.getByRole("button", { name: /Create goal|\+/ });

    this.loadMoreButton = page.getByRole("button", { name: "Load more" });
    this.emptyState = page.getByText("No goals");
    this.loadingState = page.getByText("Loading goals...");
    this.errorBanner = page.locator("[role='alert']");
    this.retryButton = page.getByRole("button", { name: "Try again" });
  }

  async goto() {
    await this.page.goto("/app/goals");
  }

  async waitForLoad() {
    await this.page.waitForLoadState("networkidle");
  }

  async searchGoals(query: string) {
    await this.searchInput.fill(query);
  }

  async filterByStatus(status: "active" | "completed_success" | "completed_failure" | "abandoned") {
    await this.statusFilter.click();
    await this.page.getByRole("option", { name: status }).click();
  }

  async sortBy(field: "created_at" | "deadline", order: "asc" | "desc") {
    await this.sortSelect.click();
    await this.page.getByRole("option", { name: field }).click();

    await this.orderSelect.click();
    await this.page.getByRole("option", { name: order }).click();
  }

  async openCreateGoalModal() {
    await this.createGoalButton.first().click();
  }

  async clickGoalCard(goalName: string) {
    await this.page.getByRole("link").filter({ hasText: goalName }).click();
  }

  async loadMore() {
    await this.loadMoreButton.click();
  }

  async logout() {
    await this.logoutButton.click();
  }

  async getGoalCards() {
    return this.page.getByRole("link").filter({ has: this.page.locator("[role='img']") });
  }

  async getGoalCardByName(name: string) {
    return this.page.getByRole("link").filter({ hasText: name });
  }
}

import { type Page, type Locator } from "@playwright/test";

/**
 * Page Object Model for Goal Create Modal
 * Handles goal creation form interactions
 */
export class GoalCreateModal {
  readonly page: Page;
  readonly dialog: Locator;
  readonly dialogTitle: Locator;
  readonly nameInput: Locator;
  readonly targetValueInput: Locator;
  readonly deadlineInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly errorMessage: Locator;
  readonly nameError: Locator;
  readonly targetValueError: Locator;
  readonly deadlineError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole("dialog");
    this.dialogTitle = this.dialog.getByRole("heading", { name: "Create new goal" });
    this.nameInput = this.dialog.getByPlaceholder("Goal name");
    this.targetValueInput = this.dialog.getByPlaceholder(/e\.g\.\s*\d+/);
    this.deadlineInput = this.dialog.locator("input[type='date']");
    this.submitButton = this.dialog.getByRole("button", { name: "Create goal" });
    this.cancelButton = this.dialog.getByRole("button", { name: "Cancel" });
    this.errorMessage = this.dialog.locator("[role='alert']");

    // Field-specific error messages
    this.nameError = this.dialog.locator("[id$='-name-error']");
    this.targetValueError = this.dialog.locator("[id$='-target-error'], [id$='-target_value-error']");
    this.deadlineError = this.dialog.locator("[id$='-deadline-error']");
  }

  async waitForOpen() {
    await this.dialog.waitFor({ state: "visible" });
  }

  async waitForClose() {
    await this.dialog.waitFor({ state: "hidden" });
  }

  async fillGoalName(name: string) {
    await this.nameInput.fill(name);
  }

  async fillTargetValue(value: string) {
    await this.targetValueInput.fill(value);
  }

  async fillDeadline(date: string) {
    await this.deadlineInput.fill(date);
  }

  async fillForm(data: { name: string; targetValue: string; deadline: string }) {
    await this.fillGoalName(data.name);
    await this.fillTargetValue(data.targetValue);
    await this.fillDeadline(data.deadline);
  }

  async submit() {
    await this.submitButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async createGoal(data: { name: string; targetValue: string; deadline: string }) {
    await this.fillForm(data);
    await this.submit();
  }

  async createGoalAndWaitForRedirect(data: { name: string; targetValue: string; deadline: string }) {
    await this.createGoal(data);
    await this.page.waitForURL(/\/app\/goals\/[a-f0-9-]+$/);
  }

  async isOpen() {
    return this.dialog.isVisible();
  }

  async getCharacterCount(field: "name" | "targetValue") {
    const fieldLocator = field === "name" ? this.nameInput : this.targetValueInput;
    const container = fieldLocator.locator("..");
    return container.getByText(/\d+\/\d+/);
  }
}

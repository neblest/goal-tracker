import { type Page, type Locator } from "@playwright/test";

/**
 * Page Object Model for Login Page
 * Handles user authentication flow
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.loginButton = page.getByRole("button", { name: "Log in" });
    this.errorMessage = page.getByRole("status");
    this.registerLink = page.getByRole("link", { name: "Sign up" });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.waitFor({ state: "visible" });
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async waitForNavigation() {
    await this.page.waitForURL("/app/goals", { timeout: 10000 });
  }

  async loginAndWaitForRedirect(email: string, password: string) {
    await this.login(email, password);
    await this.waitForNavigation();
  }
}

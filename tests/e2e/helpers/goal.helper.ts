import { type Page } from "@playwright/test";

/**
 * Goal helper functions
 * Reusable utilities for goal-related test operations
 */

export interface GoalData {
  name: string;
  targetValue: string;
  deadline: string;
}

/**
 * Generate future date for goal deadline
 * @param daysFromNow - number of days in the future
 */
export function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
}

/**
 * Generate random goal data for testing
 */
export function generateGoalData(overrides?: Partial<GoalData>): GoalData {
  const timestamp = Date.now();
  return {
    name: `Test Goal ${timestamp}`,
    targetValue: "100",
    deadline: getFutureDate(30),
    ...overrides,
  };
}

/**
 * Create a goal via API (faster than UI)
 * Useful for test setup when you need existing goals
 */
export async function createGoalViaApi(page: Page, goalData: GoalData): Promise<{ id: string }> {
  const response = await page.request.post("/api/goals", {
    data: {
      name: goalData.name,
      target_value: goalData.targetValue,
      deadline: goalData.deadline,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create goal via API: ${response.status()}`);
  }

  const body = await response.json();
  return { id: body.data.goal.id };
}

/**
 * Delete a goal via API
 * Useful for test cleanup
 */
export async function deleteGoalViaApi(page: Page, goalId: string): Promise<void> {
  const response = await page.request.delete(`/api/goals/${goalId}`);

  if (!response.ok()) {
    throw new Error(`Failed to delete goal via API: ${response.status()}`);
  }
}

/**
 * Clean up all test goals created during the test session
 * Call this in afterEach or afterAll hooks
 */
export async function cleanupTestGoals(page: Page, testGoalPrefix = "Test Goal"): Promise<void> {
  try {
    const response = await page.request.get("/api/goals?limit=100");
    if (!response.ok()) return;

    const body = await response.json();
    const goals = body.data.goals || [];

    for (const goal of goals) {
      if (goal.name.startsWith(testGoalPrefix)) {
        await deleteGoalViaApi(page, goal.id).catch(() => {
          // Ignore cleanup errors
        });
      }
    }
  } catch (error) {
    // Ignore cleanup errors
    console.error("Cleanup failed:", error);
  }
}

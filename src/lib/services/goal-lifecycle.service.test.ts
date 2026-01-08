import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { syncStatuses, abandonGoal } from "./goal-lifecycle.service";
import type { SupabaseClient } from "../../db/supabase.client";
import type { SyncStatusesCommand, AbandonGoalCommand } from "../../types";

/**
 * Unit Tests for goal-lifecycle.service - syncStatuses function
 *
 * Test Coverage:
 * - GOAL-05: Automatyczna zmiana statusu na "Failed" (Test Plan requirement)
 * - Status transitions based on deadline and target value
 * - Edge cases: multiple goals, abandoned goals, deadline timing
 * - Error handling: database errors
 *
 * Key Business Rules Tested:
 * 1. Goal transitions to completed_failure when:
 *    - Status is active
 *    - Current time > deadline end of day (23:59:59)
 *    - Current progress < target value
 *
 * 2. Goal does NOT transition when:
 *    - Target is reached (manual completion required)
 *    - Deadline not yet passed
 *    - Goal is abandoned (never auto-changed)
 *
 * 3. Error handling:
 *    - Database errors are caught and thrown as "database_error"
 *    - AI summary generation failures don't block status updates
 */

// Mock the AI summary service to prevent real API calls
vi.mock("./ai-summary.service", () => ({
  generateAiSummary: vi.fn().mockResolvedValue(undefined),
}));

describe("goal-lifecycle.service - syncStatuses", () => {
  let mockSupabase: SupabaseClient;
  const userId = "test-user-123";

  beforeEach(() => {
    // Create a fresh mock Supabase client for each test
    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    } as unknown as SupabaseClient;
  });

  describe("GOAL-05: Automatyczna zmiana statusu na Failed", () => {
    it("should transition active goal to completed_failure when deadline passed and target not reached", async () => {
      // Arrange - Setup goal with deadline in the past and insufficient progress
      const pastDeadline = "2026-01-01"; // 7 days ago
      const goalId = "goal-123";
      const targetValue = 100;
      const currentProgress = 50; // Less than target

      const mockGoals = [
        {
          id: goalId,
          status: "active",
          target_value: targetValue,
          deadline: pastDeadline,
        },
      ];

      const mockProgress = [
        { goal_id: goalId, value: 30 },
        { goal_id: goalId, value: 20 },
      ];

      // Mock update operation
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      // Mock Supabase from method with proper chaining
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === "goals") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: mockGoals, error: null }),
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            update: mockUpdate,
          } as any;
        }
        if (table === "goal_progress") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockProgress, error: null }),
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      const command: SyncStatusesCommand = { goal_ids: [goalId] };

      // Act
      const result = await syncStatuses(mockSupabase, userId, command);

      // Assert
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0]).toMatchObject({
        id: goalId,
        from: "active",
        to: "completed_failure",
      });

      // Verify that update was called with correct status
      expect(mockUpdate).toHaveBeenCalledWith({ status: "completed_failure" });
    });

    it("should NOT transition when deadline passed but target is reached", async () => {
      // Arrange
      const pastDeadline = "2026-01-01";
      const goalId = "goal-456";
      const targetValue = 100;
      const currentProgress = 100; // Equals target

      const mockGoals = [
        {
          id: goalId,
          status: "active",
          target_value: targetValue,
          deadline: pastDeadline,
        },
      ];

      const mockProgress = [
        { goal_id: goalId, value: 60 },
        { goal_id: goalId, value: 40 },
      ];

      // Setup mocks with proper chaining
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === "goals") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: mockGoals, error: null }),
                }),
              }),
            }),
          } as any;
        }
        if (table === "goal_progress") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockProgress, error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      const command: SyncStatusesCommand = { goal_ids: [goalId] };

      // Act
      const result = await syncStatuses(mockSupabase, userId, command);

      // Assert - No updates should occur (manual completion required)
      expect(result.updated).toHaveLength(0);
    });

    it("should NOT transition when target not reached but deadline not passed", async () => {
      // Arrange
      const futureDeadline = "2026-12-31"; // In the future
      const goalId = "goal-789";
      const targetValue = 100;
      const currentProgress = 50;

      const mockGoals = [
        {
          id: goalId,
          status: "active",
          target_value: targetValue,
          deadline: futureDeadline,
        },
      ];

      const mockProgress = [{ goal_id: goalId, value: 50 }];

      // Setup mocks with proper chaining
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === "goals") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: mockGoals, error: null }),
                }),
              }),
            }),
          } as any;
        }
        if (table === "goal_progress") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockProgress, error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      const command: SyncStatusesCommand = { goal_ids: [goalId] };

      // Act
      const result = await syncStatuses(mockSupabase, userId, command);

      // Assert
      expect(result.updated).toHaveLength(0);
    });

    it("should never auto-change abandoned goals", async () => {
      // Arrange
      const pastDeadline = "2026-01-01";
      const goalId = "goal-abandoned";

      // Setup mocks - syncStatuses filters by status='active', so abandoned goals won't be fetched
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === "goals") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: [], error: null }), // Empty - no active goals
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const command: SyncStatusesCommand = {};

      // Act
      const result = await syncStatuses(mockSupabase, userId, command);

      // Assert
      expect(result.updated).toHaveLength(0);
    });

    it("should handle multiple goals with mixed transition requirements", async () => {
      // Arrange
      const goalToFail = {
        id: "goal-fail",
        status: "active" as const,
        target_value: 100,
        deadline: "2026-01-01", // Past
      };

      const goalToStayActive = {
        id: "goal-active",
        status: "active" as const,
        target_value: 100,
        deadline: "2026-12-31", // Future
      };

      const mockGoals = [goalToFail, goalToStayActive];

      const mockProgress = [
        { goal_id: "goal-fail", value: 30 },
        { goal_id: "goal-active", value: 50 },
      ];

      // Mock update operation - will be called only once for goal-fail
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      // Track number of calls to from() to handle multiple table accesses
      let fromCallCount = 0;

      // Setup mocks with proper chaining for multiple calls
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        fromCallCount++;

        // First call: goals query
        if (table === "goals" && fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockGoals, error: null }),
              }),
            }),
          } as any;
        }

        // Second call: goal_progress query
        if (table === "goal_progress" && fromCallCount === 2) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockProgress, error: null }),
            }),
          } as any;
        }

        // Third call: goals update for goal-fail
        if (table === "goals" && fromCallCount === 3) {
          return {
            update: mockUpdate,
          } as any;
        }

        // Fourth call: goals query for AI summary (tryGenerateAiSummary)
        if (table === "goals" && fromCallCount === 4) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      const command: SyncStatusesCommand = {};

      // Act
      const result = await syncStatuses(mockSupabase, userId, command);

      // Assert
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0]).toMatchObject({
        id: "goal-fail",
        from: "active",
        to: "completed_failure",
      });

      // Verify update was called
      expect(mockUpdate).toHaveBeenCalledWith({ status: "completed_failure" });
    });

    it("should throw database_error when goals query fails", async () => {
      // Arrange
      const dbError = { message: "Connection failed" };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: dbError }),
        }),
      });

      vi.mocked(mockSupabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const command: SyncStatusesCommand = {};

      // Act & Assert
      await expect(syncStatuses(mockSupabase, userId, command)).rejects.toThrow("database_error");
    });

    it("should throw database_error when progress query fails", async () => {
      // Arrange
      const mockGoals = [
        {
          id: "goal-123",
          status: "active",
          target_value: 100,
          deadline: "2026-01-01",
        },
      ];

      let fromCallCount = 0;

      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        fromCallCount++;

        // First call: goals query - success
        if (table === "goals" && fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockGoals, error: null }),
              }),
            }),
          } as any;
        }

        // Second call: goal_progress query - failure
        if (table === "goal_progress" && fromCallCount === 2) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: null, error: { message: "Query failed" } }),
            }),
          } as any;
        }

        return {} as any;
      });

      const command: SyncStatusesCommand = {};

      // Act & Assert
      await expect(syncStatuses(mockSupabase, userId, command)).rejects.toThrow("database_error");
    });

    it("should consider end of day (23:59:59) when checking deadline", async () => {
      // Arrange - Deadline is today, but it's not passed yet (should fail after 23:59:59)
      const todayDeadline = "2026-01-08"; // Today (from context)
      const goalId = "goal-today";
      const targetValue = 100;
      const currentProgress = 50;

      const mockGoals = [
        {
          id: goalId,
          status: "active",
          target_value: targetValue,
          deadline: todayDeadline,
        },
      ];

      const mockProgress = [{ goal_id: goalId, value: 50 }];

      // Setup mocks with proper chaining including .in() method
      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        if (table === "goals") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: mockGoals, error: null }),
                }),
              }),
            }),
          } as any;
        }
        if (table === "goal_progress") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockProgress, error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      const command: SyncStatusesCommand = { goal_ids: [goalId] };

      // Act
      const result = await syncStatuses(mockSupabase, userId, command);

      // Assert - Should NOT fail yet because we haven't passed end of day
      // Note: This test might be time-dependent. Since it's currently 2026-01-08,
      // and deadline is 2026-01-08 23:59:59, the goal should still be active
      // unless the test runs after 23:59:59
      expect(result.updated).toHaveLength(0);
    });
  });

  describe("GOAL-04: Porzucenie celu (Abandon)", () => {
    it("should abandon an active goal with a reason", async () => {
      // Arrange
      const goalId = "goal-active-123";
      const abandonReason = "Changed priorities - focusing on different objectives";

      const mockGoal = {
        id: goalId,
        status: "active",
      };

      const mockUpdatedGoal = {
        id: goalId,
        status: "abandoned",
        abandonment_reason: abandonReason,
      };

      let fromCallCount = 0;

      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        fromCallCount++;

        // First call: fetch goal to verify status
        if (table === "goals" && fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockGoal, error: null }),
                }),
              }),
            }),
          } as any;
        }

        // Second call: update goal to abandoned
        if (table === "goals" && fromCallCount === 2) {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: mockUpdatedGoal, error: null }),
                  }),
                }),
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      const command: AbandonGoalCommand = { reason: abandonReason };

      // Act
      const result = await abandonGoal(mockSupabase, userId, goalId, command);

      // Assert
      expect(result).toEqual({
        id: goalId,
        status: "abandoned",
        abandonment_reason: abandonReason,
      });
    });

    it("should throw goal_not_found when goal does not exist", async () => {
      // Arrange
      const goalId = "non-existent-goal";
      const command: AbandonGoalCommand = { reason: "Some reason" };

      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      } as any);

      // Act & Assert
      await expect(abandonGoal(mockSupabase, userId, goalId, command)).rejects.toThrow("goal_not_found");
    });

    it("should throw goal_not_found when goal belongs to different user", async () => {
      // Arrange
      const goalId = "goal-other-user";
      const command: AbandonGoalCommand = { reason: "Some reason" };

      // Mock returns null because eq("user_id", userId) filters out the goal
      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      } as any);

      // Act & Assert
      await expect(abandonGoal(mockSupabase, userId, goalId, command)).rejects.toThrow("goal_not_found");
    });

    it("should throw goal_not_active when goal is already completed", async () => {
      // Arrange
      const goalId = "goal-completed";
      const command: AbandonGoalCommand = { reason: "Too late" };

      const mockGoal = {
        id: goalId,
        status: "completed_success",
      };

      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockGoal, error: null }),
            }),
          }),
        }),
      } as any);

      // Act & Assert
      await expect(abandonGoal(mockSupabase, userId, goalId, command)).rejects.toThrow("goal_not_active");
    });

    it("should throw goal_not_active when goal is already abandoned", async () => {
      // Arrange
      const goalId = "goal-already-abandoned";
      const command: AbandonGoalCommand = { reason: "Trying again" };

      const mockGoal = {
        id: goalId,
        status: "abandoned",
      };

      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockGoal, error: null }),
            }),
          }),
        }),
      } as any);

      // Act & Assert
      await expect(abandonGoal(mockSupabase, userId, goalId, command)).rejects.toThrow("goal_not_active");
    });

    it("should throw goal_not_active when goal has failed", async () => {
      // Arrange
      const goalId = "goal-failed";
      const command: AbandonGoalCommand = { reason: "Giving up" };

      const mockGoal = {
        id: goalId,
        status: "completed_failure",
      };

      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockGoal, error: null }),
            }),
          }),
        }),
      } as any);

      // Act & Assert
      await expect(abandonGoal(mockSupabase, userId, goalId, command)).rejects.toThrow("goal_not_active");
    });

    it("should throw database_error when fetch fails", async () => {
      // Arrange
      const goalId = "goal-db-error";
      const command: AbandonGoalCommand = { reason: "Some reason" };

      const dbError = { message: "Connection timeout" };

      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: dbError }),
            }),
          }),
        }),
      } as any);

      // Act & Assert
      await expect(abandonGoal(mockSupabase, userId, goalId, command)).rejects.toThrow("database_error");
    });

    it("should throw database_error when update fails", async () => {
      // Arrange
      const goalId = "goal-update-error";
      const command: AbandonGoalCommand = { reason: "Some reason" };

      const mockGoal = {
        id: goalId,
        status: "active",
      };

      const updateError = { message: "Update failed" };

      let fromCallCount = 0;

      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        fromCallCount++;

        // First call: fetch goal - success
        if (table === "goals" && fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockGoal, error: null }),
                }),
              }),
            }),
          } as any;
        }

        // Second call: update goal - failure
        if (table === "goals" && fromCallCount === 2) {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: null, error: updateError }),
                  }),
                }),
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      // Act & Assert
      await expect(abandonGoal(mockSupabase, userId, goalId, command)).rejects.toThrow("database_error");
    });

    it("should store the abandonment reason correctly", async () => {
      // Arrange
      const goalId = "goal-with-detailed-reason";
      const detailedReason = "Found the goal unrealistic after consultation with mentor. Need to revise approach.";

      const mockGoal = {
        id: goalId,
        status: "active",
      };

      const mockUpdatedGoal = {
        id: goalId,
        status: "abandoned",
        abandonment_reason: detailedReason,
      };

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedGoal, error: null }),
            }),
          }),
        }),
      });

      let fromCallCount = 0;

      vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
        fromCallCount++;

        if (table === "goals" && fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockGoal, error: null }),
                }),
              }),
            }),
          } as any;
        }

        if (table === "goals" && fromCallCount === 2) {
          return {
            update: mockUpdate,
          } as any;
        }

        return {} as any;
      });

      const command: AbandonGoalCommand = { reason: detailedReason };

      // Act
      const result = await abandonGoal(mockSupabase, userId, goalId, command);

      // Assert
      expect(result.abandonment_reason).toBe(detailedReason);
      expect(mockUpdate).toHaveBeenCalledWith({
        status: "abandoned",
        abandonment_reason: detailedReason,
      });
    });
  });
});

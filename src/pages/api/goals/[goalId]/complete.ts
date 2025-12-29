import type { APIContext } from "astro";
import { z } from "zod";
import type { CompleteGoalResponseDto, ApiErrorDto } from "../../../../types";
import { completeGoal } from "../../../../lib/services/goal-lifecycle.service";
import { getUserFromRequest } from "../../../../lib/auth/getUserFromRequest";

export const prerender = false;

/**
 * Zod schema for goalId path parameter validation
 */
const goalIdSchema = z.string().uuid("Goal ID must be a valid UUID");

/**
 * PATCH /api/goals/:goalId/complete - Manually complete an active goal with success
 *
 * Allows a user to manually mark a goal as completed successfully when the
 * target value has been reached or exceeded.
 *
 * Business rules:
 * - Goal must be in 'active' status (409 if not)
 * - Current value must be >= target value (409 if not met)
 * - Goal must belong to authenticated user (404 if not found)
 * - Status changes to 'completed_success'
 * - AI summary generation is triggered if conditions are met (≥3 progress entries)
 *
 * Test scenarios:
 * 1. Success (200):
 *    PATCH /api/goals/<active_goal_uuid>/complete
 *    Authorization: Bearer <valid_token>
 *    (Goal has current_value >= target_value)
 *
 * 2. Invalid UUID (400):
 *    PATCH /api/goals/invalid-uuid/complete
 *
 * 3. Goal not found (404):
 *    PATCH /api/goals/00000000-0000-0000-0000-000000000000/complete
 *
 * 4. Goal not active (409):
 *    PATCH /api/goals/<completed_goal_uuid>/complete
 *
 * 5. Target not reached (409):
 *    PATCH /api/goals/<active_goal_uuid>/complete
 *    (Goal has current_value < target_value)
 *
 * 6. Unauthorized (401):
 *    PATCH /api/goals/<goal_uuid>/complete
 *    (No Authorization header or invalid token)
 *
 * HTTP responses:
 * - 200: Goal successfully completed with { data: { goal: { id, status, ai_summary, ai_generation_attempts } } }
 * - 400: Invalid UUID format
 * - 401: User not authenticated
 * - 404: Goal not found or not owned by user
 * - 409: Goal not active or target value not reached
 * - 500: Server error during processing
 */
export async function PATCH(context: APIContext): Promise<Response> {
  const { params } = context;

  // Step 1: Authentication
  const authResult = await getUserFromRequest(context);
  if (!authResult.success) {
    return authResult.response;
  }

  // Step 2: Validate goalId path parameter
  const goalIdValidation = goalIdSchema.safeParse(params.goalId);

  if (!goalIdValidation.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: "invalid_path_params",
          message: goalIdValidation.error.errors[0]?.message || "Goal ID must be a valid UUID",
          details: goalIdValidation.error.flatten(),
        },
      } satisfies ApiErrorDto<"invalid_path_params">),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const goalId = goalIdValidation.data;

  // Step 3: Complete the goal via service layer
  try {
    const result = await completeGoal(context.locals.supabase, authResult.userId, goalId);

    const successResponse: CompleteGoalResponseDto = {
      data: {
        goal: {
          id: result.id,
          status: result.status,
          ai_summary: result.ai_summary ?? null,
          ai_generation_attempts: result.ai_generation_attempts,
        },
      },
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Map service-layer errors to appropriate HTTP responses
    if (error instanceof Error) {
      switch (error.message) {
        case "goal_not_found": {
          return new Response(
            JSON.stringify({
              error: {
                code: "goal_not_found",
                message: "The specified goal does not exist or you do not have access to it",
              },
            } satisfies ApiErrorDto<"goal_not_found">),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        case "goal_not_active": {
          return new Response(
            JSON.stringify({
              error: {
                code: "goal_not_active",
                message: "Only active goals can be manually completed",
              },
            } satisfies ApiErrorDto<"goal_not_active">),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        case "target_not_reached": {
          return new Response(
            JSON.stringify({
              error: {
                code: "target_not_reached",
                message: "Goal cannot be completed because the target value has not been reached yet",
              },
            } satisfies ApiErrorDto<"target_not_reached">),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        default: {
          // eslint-disable-next-line no-console
          console.error("Unexpected error completing goal:", error);
          return new Response(
            JSON.stringify({
              error: {
                code: "internal_error",
                message: "An error occurred while completing the goal",
              },
            } satisfies ApiErrorDto<"internal_error">),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Fallback for non-Error exceptions
    // eslint-disable-next-line no-console
    console.error("Unknown error completing goal:", error);
    return new Response(
      JSON.stringify({
        error: {
          code: "internal_error",
          message: "An unexpected error occurred",
        },
      } satisfies ApiErrorDto<"internal_error">),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

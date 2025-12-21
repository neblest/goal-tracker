import type { APIContext } from "astro";
import { z } from "zod";
import type { RetryGoalCommand, RetryGoalResponseDto, ApiErrorDto } from "../../../../types";
import { retryGoal } from "../../../../lib/services/goal-lifecycle.service";

export const prerender = false;

/**
 * Zod schema for goalId path parameter validation
 */
const goalIdSchema = z.string().uuid("Goal ID must be a valid UUID");

/**
 * Zod schema for RetryGoalCommand validation
 *
 * Validates:
 * - target_value: decimal string greater than 0
 * - deadline: YYYY-MM-DD format, must be in the future
 * - name: optional string (1-500 characters)
 */
const retryGoalSchema = z
  .object({
    target_value: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "target_value must be a valid decimal number")
      .refine((val) => parseFloat(val) > 0, "target_value must be greater than 0"),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "deadline must be in YYYY-MM-DD format")
      .refine((date) => {
        const deadlineDate = new Date(date + "T00:00:00Z");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return deadlineDate > today;
      }, "deadline must be in the future"),
    name: z.string().trim().min(1, "name must not be empty").max(500, "name must not exceed 500 characters").optional(),
  })
  .strict();

/**
 * POST /api/goals/:goalId/retry - Create a new active goal as retry of a failed/abandoned goal
 *
 * Allows a user to retry a goal that failed or was abandoned.
 * The new goal will have status 'active' and parent_goal_id set to the source goal.
 *
 * Business rules:
 * - Source goal must be in 'completed_failure' or 'abandoned' status (409 if not)
 * - Name is copied from source goal by default, or can be overridden
 * - New target_value and deadline must be provided
 * - Goal must belong to authenticated user (404 if not found)
 *
 * Test scenarios:
 * 1. Success with completed_failure (201):
 *    POST /api/goals/<failed_goal_uuid>/retry
 *    Authorization: Bearer <valid_token>
 *    Body: { "target_value": "70", "deadline": "2026-02-28" }
 *
 * 2. Success with abandoned (201):
 *    POST /api/goals/<abandoned_goal_uuid>/retry
 *    Body: { "target_value": "70", "deadline": "2026-02-28", "name": "New attempt" }
 *
 * 3. Invalid UUID (400):
 *    POST /api/goals/invalid-uuid/retry
 *
 * 4. Goal not found (404):
 *    POST /api/goals/00000000-0000-0000-0000-000000000000/retry
 *
 * 5. Goal not retryable (409):
 *    POST /api/goals/<active_goal_uuid>/retry
 *    Body: { "target_value": "70", "deadline": "2026-02-28" }
 *
 * 6. Invalid target_value (422):
 *    POST /api/goals/<failed_goal_uuid>/retry
 *    Body: { "target_value": "-10", "deadline": "2026-02-28" }
 *
 * 7. Deadline in the past (422):
 *    POST /api/goals/<failed_goal_uuid>/retry
 *    Body: { "target_value": "70", "deadline": "2020-01-01" }
 *
 * 8. Unauthenticated (401):
 *    No Authorization header or invalid token
 */
export async function POST(context: APIContext) {
  try {
    // Step 1: Validate goalId path parameter
    const goalId = context.params.goalId;

    const goalIdParseResult = goalIdSchema.safeParse(goalId);
    if (!goalIdParseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_path_params",
            message: "Invalid goal ID format",
            details: goalIdParseResult.error.flatten(),
          },
        } satisfies ApiErrorDto<"invalid_path_params">),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validatedGoalId = goalIdParseResult.data;

    // Step 2: Parse and validate request body
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_json",
            message: "Invalid JSON in request body",
          },
        } satisfies ApiErrorDto<"invalid_json">),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const commandParseResult = retryGoalSchema.safeParse(requestBody);
    if (!commandParseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Validation failed",
            details: commandParseResult.error.flatten(),
          },
        } satisfies ApiErrorDto<"validation_error">),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const command = commandParseResult.data as RetryGoalCommand;

    // Step 3: Authenticate user
    const supabase = context.locals.supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: "unauthorized",
            message: "Authentication required",
          },
        } satisfies ApiErrorDto<"unauthorized">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Call service to retry goal
    const newGoal = await retryGoal(supabase, user.id, validatedGoalId, command);

    // Step 5: Return success response
    return new Response(
      JSON.stringify({
        data: {
          goal: newGoal,
        },
      } satisfies RetryGoalResponseDto),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Step 6: Handle service errors
    if (error instanceof Error) {
      switch (error.message) {
        case "goal_not_found":
          return new Response(
            JSON.stringify({
              error: {
                code: "goal_not_found",
                message: "Goal not found or access denied",
              },
            } satisfies ApiErrorDto<"goal_not_found">),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );

        case "goal_not_retryable":
          return new Response(
            JSON.stringify({
              error: {
                code: "goal_not_retryable",
                message: "Goal can only be retried when status is completed_failure or abandoned",
              },
            } satisfies ApiErrorDto<"goal_not_retryable">),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            }
          );

        case "database_error":
        default:
          // eslint-disable-next-line no-console
          console.error("Unexpected error in retry endpoint:", error);
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

    // Fallback for non-Error exceptions
    // eslint-disable-next-line no-console
    console.error("Unexpected non-Error exception in retry endpoint:", error);
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

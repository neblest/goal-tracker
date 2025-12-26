import type { APIContext } from "astro";
import { z } from "zod";
import type { ContinueGoalCommand, ContinueGoalResponseDto, ApiErrorDto } from "../../../../types";
import { continueGoal } from "../../../../lib/services/goal-lifecycle.service";

export const prerender = false;

/**
 * Zod schema for goalId path parameter validation
 */
const goalIdSchema = z.string().uuid("Goal ID must be a valid UUID");

/**
 * Zod schema for ContinueGoalCommand validation
 *
 * Validates:
 * - name: required, non-empty string (1-500 characters)
 * - target_value: DecimalString > 0
 * - deadline: YYYY-MM-DD format, must be in the future
 */
const continueGoalSchema = z
  .object({
    name: z.string().trim().min(1, "Goal name is required").max(500, "Goal name must not exceed 500 characters"),
    target_value: z
      .string()
      .trim()
      .regex(/^\d+(\.\d+)?$/, "Target value must be a valid decimal number")
      .refine((val) => parseFloat(val) > 0, "Target value must be greater than 0"),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be in YYYY-MM-DD format")
      .refine((date) => {
        const deadlineDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return deadlineDate > today;
      }, "Deadline must be in the future"),
  })
  .strict();

/**
 * POST /api/goals/:goalId/continue - Create a new goal as continuation after success
 *
 * Allows a user to create a new active goal as a continuation after completing
 * a goal successfully. The new goal will have parent_goal_id set to the source goal.
 *
 * Business rules:
 * - Source goal must be in 'completed_success' status (409 if not)
 * - Name, target_value, and deadline are required
 * - New goal starts with status 'active'
 * - Goal must belong to authenticated user (404 if not found)
 *
 * Test scenarios:
 * 1. Success (201):
 *    POST /api/goals/<completed_success_goal_uuid>/continue
 *    Authorization: Bearer <valid_token>
 *    Body: { "name": "Run 120 km", "target_value": "120", "deadline": "2026-02-28" }
 *
 * 2. Invalid UUID (400):
 *    POST /api/goals/invalid-uuid/continue
 *
 * 3. Goal not found (404):
 *    POST /api/goals/00000000-0000-0000-0000-000000000000/continue
 *
 * 4. Goal not completed_success (409):
 *    POST /api/goals/<active_goal_uuid>/continue
 *    Body: { "name": "Run 120 km", "target_value": "120", "deadline": "2026-02-28" }
 *
 * 5. Missing name (422):
 *    POST /api/goals/<completed_success_goal_uuid>/continue
 *    Body: { "target_value": "120", "deadline": "2026-02-28" }
 *
 * 6. Invalid target_value (422):
 *    POST /api/goals/<completed_success_goal_uuid>/continue
 *    Body: { "name": "Run 120 km", "target_value": "0", "deadline": "2026-02-28" }
 *
 * 7. Invalid deadline (422):
 *    POST /api/goals/<completed_success_goal_uuid>/continue
 *    Body: { "name": "Run 120 km", "target_value": "120", "deadline": "2020-01-01" }
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

    const bodyParseResult = continueGoalSchema.safeParse(requestBody);
    if (!bodyParseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Invalid request body",
            details: bodyParseResult.error.flatten(),
          },
        } satisfies ApiErrorDto<"validation_error">),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const command: ContinueGoalCommand = bodyParseResult.data;

    // Step 3: Authentication
    const supabase = context.locals.supabase;

    // TODO: Remove hardcoded user ID before production deployment
    const DEV_USER_ID = "44d2849d-867f-4c21-b386-d017b85896c0";
    const user = { id: DEV_USER_ID };

    /*
    // Production authentication code (currently disabled):
    const authHeader = context.request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: {
            code: "unauthenticated",
            message: "Missing or invalid authentication token",
          },
        } satisfies ApiErrorDto<"unauthenticated">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: "unauthenticated",
            message: "Invalid or expired authentication token",
          },
        } satisfies ApiErrorDto<"unauthenticated">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    */

    // Step 4: Call service to continue the goal
    const result = await continueGoal(supabase, user.id, validatedGoalId, command);

    // Step 5: Return success response
    return new Response(
      JSON.stringify({
        data: {
          goal: result,
        },
      } satisfies ContinueGoalResponseDto),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("POST /api/goals/:goalId/continue error:", error);

    // Handle specific service errors
    if (error instanceof Error) {
      if (error.message === "goal_not_found") {
        return new Response(
          JSON.stringify({
            error: {
              code: "goal_not_found",
              message: "Goal not found or you do not have access to it",
            },
          } satisfies ApiErrorDto<"goal_not_found">),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (error.message === "goal_not_continuable") {
        return new Response(
          JSON.stringify({
            error: {
              code: "goal_not_continuable",
              message: "Goal cannot be continued. Only goals with status 'completed_success' can be continued.",
            },
          } satisfies ApiErrorDto<"goal_not_continuable">),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (error.message === "active_goal_exists") {
        return new Response(
          JSON.stringify({
            error: {
              code: "active_goal_exists",
              message: "An active goal already exists in this iteration chain",
            },
          } satisfies ApiErrorDto<"active_goal_exists">),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (error.message === "goal_not_youngest") {
        return new Response(
          JSON.stringify({
            error: {
              code: "goal_not_youngest",
              message: "Goal can only be continued from the most recent iteration",
            },
          } satisfies ApiErrorDto<"goal_not_youngest">),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (error.message === "database_error") {
        return new Response(
          JSON.stringify({
            error: {
              code: "internal_error",
              message: "An internal error occurred while processing your request",
            },
          } satisfies ApiErrorDto<"internal_error">),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Generic internal error for unexpected errors
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

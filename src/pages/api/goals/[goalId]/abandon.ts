import type { APIContext } from "astro";
import { z } from "zod";
import type { AbandonGoalCommand, AbandonGoalResponseDto, ApiErrorDto } from "../../../../types";
import { abandonGoal } from "../../../../lib/services/goal-lifecycle.service";

export const prerender = false;

/**
 * Zod schema for goalId path parameter validation
 */
const goalIdSchema = z.string().uuid("Goal ID must be a valid UUID");

/**
 * Zod schema for AbandonGoalCommand validation
 *
 * Validates:
 * - reason: non-empty string with reasonable length limit (1-2000 characters)
 */
const abandonGoalSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Abandonment reason is required")
    .max(2000, "Abandonment reason must not exceed 2000 characters"),
});

/**
 * POST /api/goals/:goalId/abandon - Manually abandon an active goal
 *
 * Allows a user to manually abandon a goal that is currently active.
 * The goal's status will be changed to 'abandoned' and the reason will be stored.
 *
 * Business rules:
 * - Goal must be in 'active' status (409 if not)
 * - Reason must be provided (422 if missing/empty)
 * - Goal must belong to authenticated user (404 if not found)
 *
 * Test scenarios:
 * 1. Success (200):
 *    POST /api/goals/<active_goal_uuid>/abandon
 *    Authorization: Bearer <valid_token>
 *    Body: { "reason": "No time" }
 *
 * 2. Invalid UUID (400):
 *    POST /api/goals/invalid-uuid/abandon
 *
 * 3. Goal not found (404):
 *    POST /api/goals/00000000-0000-0000-0000-000000000000/abandon
 *
 * 4. Goal not active (409):
 *    POST /api/goals/<completed_goal_uuid>/abandon
 *    Body: { "reason": "Already completed" }
 *
 * 5. Missing reason (422):
 *    POST /api/goals/<active_goal_uuid>/abandon
 *    Body: {}
 *
 * 6. Empty reason (422):
 *    POST /api/goals/<active_goal_uuid>/abandon
 *    Body: { "reason": "" }
 *
 * 7. Unauthenticated (401):
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

    const bodyParseResult = abandonGoalSchema.safeParse(requestBody);
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

    const command: AbandonGoalCommand = bodyParseResult.data;

    // Step 3: Authentication
    const supabase = context.locals.supabase;

    // TODO: Remove hardcoded user ID before production deployment
    const DEV_USER_ID = "7e4b878a-8597-4b14-a9dd-4d198b79a2ab";
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

    // Step 4: Call service to abandon the goal
    const result = await abandonGoal(supabase, user.id, validatedGoalId, command);

    // Step 5: Return success response
    return new Response(
      JSON.stringify({
        data: {
          goal: result,
        },
      } satisfies AbandonGoalResponseDto),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("POST /api/goals/:goalId/abandon error:", error);

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

      if (error.message === "goal_not_active") {
        return new Response(
          JSON.stringify({
            error: {
              code: "goal_not_active",
              message: "Goal is not active and cannot be abandoned",
            },
          } satisfies ApiErrorDto<"goal_not_active">),
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
              message: "Database error occurred",
            },
          } satisfies ApiErrorDto<"internal_error">),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Generic error handler
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

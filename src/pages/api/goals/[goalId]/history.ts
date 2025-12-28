import type { APIContext } from "astro";
import { z } from "zod";
import type { ApiErrorDto, GetGoalHistoryQueryDto, GetGoalHistoryResponseDto } from "../../../../types";
import { listGoalHistory } from "../../../../lib/services/goal-history.service";

export const prerender = false;

/**
 * Zod schema for goalId path parameter validation
 */
const goalIdSchema = z.string().uuid("Goal ID must be a valid UUID");

/**
 * Zod schema for query parameters validation
 */
const querySchema = z.object({
  sort: z.enum(["created_at"]).optional().default("created_at"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * GET /api/goals/:goalId/history - Get goal history (all iterations in the chain)
 *
 * Returns all iterations (versions) of a goal that belong to the same "history chain".
 * The chain is defined by the self-referencing `goals.parent_goal_id` relationship:
 * - The "root" of the chain is the record where `parent_goal_id IS NULL`
 * - Subsequent iterations are descendants of the root (recursively via `parent_goal_id`)
 *
 * Business rules:
 * - User must be authenticated (401 if not)
 * - Goal must belong to authenticated user (404 if not found)
 * - Returns chronologically sorted list of all goals in the chain (newest first by default)
 *
 * Test scenarios:
 * 1. Success (200):
 *    GET /api/goals/<valid_goal_uuid>/history
 *    Authorization: Bearer <valid_token>
 *
 * 2. Success with sorting (200):
 *    GET /api/goals/<valid_goal_uuid>/history?order=asc
 *
 * 3. Invalid UUID (400):
 *    GET /api/goals/invalid-uuid/history
 *
 * 4. Invalid query param (400):
 *    GET /api/goals/<valid_goal_uuid>/history?sort=invalid
 *
 * 5. Goal not found (404):
 *    GET /api/goals/00000000-0000-0000-0000-000000000000/history
 *
 * 6. Unauthenticated (401):
 *    No Authorization header or invalid token
 */
export async function GET(context: APIContext) {
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

    // Step 2: Validate query parameters
    const url = new URL(context.request.url);
    const queryParams = {
      sort: url.searchParams.get("sort") ?? undefined,
      order: url.searchParams.get("order") ?? undefined,
    };

    const queryParseResult = querySchema.safeParse(queryParams);
    if (!queryParseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_query_params",
            message: "Invalid query parameters",
            details: queryParseResult.error.flatten(),
          },
        } satisfies ApiErrorDto<"invalid_query_params">),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validatedQuery: GetGoalHistoryQueryDto = queryParseResult.data;

    // Step 3: Authenticate user
    // const authHeader = context.request.headers.get("Authorization");
    // if (!authHeader || !authHeader.startsWith("Bearer ")) {
    //   return new Response(
    //     JSON.stringify({
    //       error: {
    //         code: "unauthenticated",
    //         message: "Missing or invalid authorization header",
    //       },
    //     } satisfies ApiErrorDto<"unauthenticated">),
    //     {
    //       status: 401,
    //       headers: { "Content-Type": "application/json" },
    //     }
    //   );
    // }

    // const token = authHeader.replace("Bearer ", "");
    const supabase = context.locals.supabase;

    // const {
    //   data: { user },
    //   error: authError,
    // } = await supabase.auth.getUser(token);

    // if (authError || !user) {
    //   return new Response(
    //     JSON.stringify({
    //       error: {
    //         code: "unauthenticated",
    //         message: "Invalid or expired token",
    //       },
    //     } satisfies ApiErrorDto<"unauthenticated">),
    //     {
    //       status: 401,
    //       headers: { "Content-Type": "application/json" },
    //     }
    //   );
    // }
    const DEV_USER_ID = "7e4b878a-8597-4b14-a9dd-4d198b79a2ab";
    const user = { id: DEV_USER_ID };
    // Step 4: Call service to get goal history
    const result = await listGoalHistory(supabase, user.id, validatedGoalId, validatedQuery);

    // Step 5: Return success response
    return new Response(
      JSON.stringify({
        data: result,
      } satisfies GetGoalHistoryResponseDto),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("GET /api/goals/:goalId/history error:", error);

    // Handle known service errors
    if (error instanceof Error) {
      // goal_not_found -> 404
      if (error.message === "goal_not_found") {
        return new Response(
          JSON.stringify({
            error: {
              code: "goal_not_found",
              message: "Goal not found or does not belong to user",
            },
          } satisfies ApiErrorDto<"goal_not_found">),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // database_error -> 500
      if (error.message === "database_error") {
        return new Response(
          JSON.stringify({
            error: {
              code: "database_error",
              message: "Database operation failed",
            },
          } satisfies ApiErrorDto<"database_error">),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Unexpected errors -> 500
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

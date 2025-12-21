import type { APIContext } from "astro";
import { z } from "zod";
import type { ApiErrorDto, SyncStatusesCommand, SyncStatusesResponseDto } from "../../../types";
import { syncStatuses } from "../../../lib/services/goal-lifecycle.service";

export const prerender = false;

/**
 * Zod schema for POST /api/goals/sync-statuses request body
 *
 * Validates:
 * - goal_ids: optional array of UUIDs (1-200 items)
 *   - If provided: sync only specified goals
 *   - If omitted or empty: sync all user's goals
 */
const syncStatusesCommandSchema = z.object({
  goal_ids: z
    .array(z.string().uuid("Each goal_id must be a valid UUID"))
    .min(0)
    .max(200, "Cannot sync more than 200 goals at once")
    .optional(),
});

/**
 * POST /api/goals/sync-statuses - Apply automatic status transitions
 *
 * Applies business rules to update goal statuses:
 * - If current_value >= target_value → completed_success
 * - If now is after deadline (23:59 local time) AND current_value < target_value → completed_failure
 * - If status is abandoned → never auto-change
 *
 * Idempotent: repeated calls won't cause duplicate transitions.
 *
 * Test scenarios:
 * 1. Success - sync all goals (200):
 *    POST /api/goals/sync-statuses
 *    Authorization: Bearer <valid_token>
 *    Body: {} or no body
 *
 * 2. Success - sync specific goals (200):
 *    POST /api/goals/sync-statuses
 *    Body: { "goal_ids": ["uuid1", "uuid2"] }
 *
 * 3. Idempotency - no changes on second call (200):
 *    POST /api/goals/sync-statuses (repeat)
 *    Response: { "data": { "updated": [] } }
 *
 * 4. Validation error - invalid UUID (400):
 *    Body: { "goal_ids": ["invalid-uuid"] }
 *
 * 5. Validation error - too many IDs (400):
 *    Body: { "goal_ids": [201 UUIDs] }
 *
 * 6. Unauthenticated (401):
 *    No Authorization header or invalid token
 *
 * 7. Database error (500):
 *    Supabase connection failure or unexpected error
 */
export async function POST(context: APIContext) {
  try {
    // Step 1: Parse and validate request body
    let requestBody: unknown;
    try {
      const text = await context.request.text();
      // Empty body is valid (sync all goals)
      if (!text || text.trim() === "") {
        requestBody = {};
      } else {
        requestBody = JSON.parse(text);
      }
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_payload",
            message: "Request body must be valid JSON or empty",
          },
        } satisfies ApiErrorDto<"invalid_payload">),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const parseResult = syncStatusesCommandSchema.safeParse(requestBody);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_payload",
            message: "Invalid request body",
            details: parseResult.error.flatten(),
          },
        } satisfies ApiErrorDto<"invalid_payload">),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const command: SyncStatusesCommand = parseResult.data;

    // Step 2: Authentication
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

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
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

    const user = authData.user;
    */

    // Step 3: Execute sync logic via service
    const result = await syncStatuses(supabase, user.id, command);

    // Step 4: Return success response
    const response: SyncStatusesResponseDto = {
      data: {
        updated: result.updated,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Step 5: Error handling
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/goals/sync-statuses:", error);

    // Map known error codes
    if (error instanceof Error) {
      if (error.message === "database_error") {
        return new Response(
          JSON.stringify({
            error: {
              code: "internal_error",
              message: "A database error occurred while syncing statuses",
            },
          } satisfies ApiErrorDto<"internal_error">),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Unexpected errors
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

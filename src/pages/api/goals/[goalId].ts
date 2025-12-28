import type { APIContext } from "astro";
import { z } from "zod";
import type { ApiErrorDto, GetGoalResponseDto, UpdateGoalResponseDto } from "../../../types";
import { getGoalDetails, updateGoal, deleteGoal } from "../../../lib/services/goals.service";

export const prerender = false;

/**
 * Zod schema for goalId path parameter validation
 */
const goalIdSchema = z.string().uuid("Goal ID must be a valid UUID");

/**
 * Zod schema for PATCH request body validation
 *
 * All fields are optional, but at least one field must be present.
 * - name, target_value, deadline: Can only be updated when goal is not locked
 * - reflection_notes, ai_summary: Always editable
 */
const updateGoalSchema = z
  .object({
    name: z.string().min(1, "Name cannot be empty").optional(),
    target_value: z
      .string()
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
        message: "Target value must be a positive number",
      })
      .optional(),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be in YYYY-MM-DD format")
      .refine(
        (val) => {
          const date = new Date(val);
          return !isNaN(date.getTime());
        },
        { message: "Invalid date" }
      )
      .optional(),
    reflection_notes: z.string().nullable().optional(),
    ai_summary: z.string().nullable().optional(),
  })
  .strict()
  .refine(
    (data) => {
      // At least one field must be present
      return Object.keys(data).length > 0;
    },
    { message: "At least one field must be provided for update" }
  );

/**
 * GET /api/goals/:goalId - Get goal details
 *
 * Returns detailed information about a single goal including:
 * - All goal fields from the database
 * - Computed fields (progress, status, days remaining)
 * - Progress entry count
 *
 * Test scenarios:
 * 1. Success (200):
 *    GET /api/goals/<valid_uuid>
 *    Authorization: Bearer <valid_token>
 *
 * 2. Invalid UUID (400):
 *    GET /api/goals/invalid-uuid
 *
 * 3. Goal not found (404):
 *    GET /api/goals/00000000-0000-0000-0000-000000000000
 *
 * 4. Unauthenticated (401):
 *    No Authorization header or invalid token
 */
export async function GET(context: APIContext) {
  try {
    // Step 1: Validate goalId path parameter
    const goalId = context.params.goalId;

    const parseResult = goalIdSchema.safeParse(goalId);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_path_params",
            message: "Invalid goal ID format",
            details: parseResult.error.flatten(),
          },
        } satisfies ApiErrorDto<"invalid_path_params">),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validatedGoalId = parseResult.data;

    // Step 2: Authentication
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

    // Step 3: Call service to get goal details
    const goalDetails = await getGoalDetails(supabase, user.id, validatedGoalId);

    // Step 4: Return success response
    const response: GetGoalResponseDto = {
      data: { goal: goalDetails },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("GET /api/goals/:goalId error:", error);

    // Handle specific service errors
    if (error instanceof Error) {
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

    // Generic error
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

/**
 * PATCH /api/goals/:goalId - Update goal
 *
 * Updates editable fields of a goal. Some fields can only be edited when the goal
 * is not "locked" (i.e., has no progress entries):
 * - Always editable: reflection_notes, ai_summary
 * - Only editable when unlocked: name, target_value, deadline
 *
 * Test scenarios:
 * 1. Success - Update reflection_notes (200):
 *    PATCH /api/goals/<valid_uuid>
 *    Authorization: Bearer <valid_token>
 *    Body: { "reflection_notes": "Updated notes" }
 *
 * 2. Success - Update name when unlocked (200):
 *    PATCH /api/goals/<valid_uuid_no_progress>
 *    Body: { "name": "New goal name" }
 *
 * 3. Conflict - Update name when locked (409):
 *    PATCH /api/goals/<valid_uuid_with_progress>
 *    Body: { "name": "New goal name" }
 *
 * 4. Invalid UUID (400):
 *    PATCH /api/goals/invalid-uuid
 *
 * 5. Empty body (422):
 *    PATCH /api/goals/<valid_uuid>
 *    Body: {}
 *
 * 6. Invalid body (422):
 *    PATCH /api/goals/<valid_uuid>
 *    Body: { "target_value": "-10" }
 *
 * 7. Goal not found (404):
 *    PATCH /api/goals/00000000-0000-0000-0000-000000000000
 *
 * 8. Unauthenticated (401):
 *    No Authorization header or invalid token
 */
export async function PATCH(context: APIContext) {
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
            code: "validation_error",
            message: "Invalid JSON in request body",
          },
        } satisfies ApiErrorDto<"validation_error">),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const bodyParseResult = updateGoalSchema.safeParse(requestBody);
    if (!bodyParseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Request validation failed",
            details: bodyParseResult.error.flatten(),
          },
        } satisfies ApiErrorDto<"validation_error">),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validatedBody = bodyParseResult.data;

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

    // Step 4: Call service to update goal
    const updatedGoal = await updateGoal(supabase, user.id, validatedGoalId, validatedBody);

    // Step 5: Return success response
    const response: UpdateGoalResponseDto = {
      data: { goal: updatedGoal },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("PATCH /api/goals/:goalId error:", error);

    // Handle specific service errors
    if (error instanceof Error) {
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

      if (error.message === "goal_locked") {
        return new Response(
          JSON.stringify({
            error: {
              code: "goal_locked",
              message: "Cannot update immutable fields (name, target_value, deadline) after progress has been recorded",
            },
          } satisfies ApiErrorDto<"goal_locked">),
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

    // Generic error
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

/**
 * DELETE /api/goals/:goalId - Delete a goal
 *
 * MVP restriction: Only allows deletion when there are no progress entries yet.
 * If progress entries exist, returns 409 Conflict.
 *
 * Test scenarios:
 * 1. Success (204):
 *    DELETE /api/goals/<valid_uuid_without_progress>
 *    Authorization: Bearer <valid_token>
 *
 * 2. Goal has progress entries (409):
 *    DELETE /api/goals/<valid_uuid_with_progress>
 *
 * 3. Invalid UUID (400):
 *    DELETE /api/goals/invalid-uuid
 *
 * 4. Goal not found (404):
 *    DELETE /api/goals/00000000-0000-0000-0000-000000000000
 *
 * 5. Unauthenticated (401):
 *    No Authorization header or invalid token
 */
export async function DELETE(context: APIContext) {
  try {
    // Step 1: Validate goalId path parameter
    const goalId = context.params.goalId;

    const parseResult = goalIdSchema.safeParse(goalId);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_path_params",
            message: "Invalid goal ID format",
            details: parseResult.error.flatten(),
          },
        } satisfies ApiErrorDto<"invalid_path_params">),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validatedGoalId = parseResult.data;

    // Step 2: Authentication
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

    // Step 3: Call service to delete goal
    await deleteGoal(supabase, user.id, validatedGoalId);

    // Step 4: Return 204 No Content
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("DELETE /api/goals/:goalId error:", error);

    // Handle specific service errors
    if (error instanceof Error) {
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

      if (error.message === "goal_has_progress") {
        return new Response(
          JSON.stringify({
            error: {
              code: "goal_has_progress",
              message: "Cannot delete goal with progress entries",
            },
          } satisfies ApiErrorDto<"goal_has_progress">),
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

    // Generic error
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

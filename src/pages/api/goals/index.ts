import type { APIContext } from "astro";
import { z } from "zod";
import type { CreateGoalCommand, CreateGoalResponseDto, ApiErrorDto } from "../../../types";
import { assertParentGoalAccessible, createGoal } from "../../../lib/services/goals.service";
import { SupabaseClient } from "@supabase/supabase-js";

export const prerender = false;

/**
 * Zod schema for CreateGoalCommand with domain validation
 *
 * Validates:
 * - name: 1-500 characters
 * - target_value: positive decimal string (e.g., "100", "42.5")
 * - deadline: YYYY-MM-DD format, must be in the future
 * - parent_goal_id: optional UUID or null
 */
const createGoalSchema = z.object({
  name: z.string().trim().min(1, "Goal name is required").max(500, "Goal name must not exceed 500 characters"),
  target_value: z
    .string()
    .min(1, "Target value is required")
    .regex(/^\d+(\.\d+)?$/, "Target value must be a valid decimal number")
    .refine((val) => parseFloat(val) > 0, "Target value must be greater than 0"),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be in YYYY-MM-DD format")
    .refine((dateStr) => {
      const deadline = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return deadline > today;
    }, "Deadline must be in the future"),
  parent_goal_id: z.string().uuid().nullable().optional(),
});

/**
 * POST /api/goals - Create a new goal
 *
 * Creates a new goal for the authenticated user. Can be a root goal
 * (parent_goal_id = null) or a new iteration of an existing goal.
 *
 * Test scenarios:
 * 1. Success (201):
 *    POST /api/goals
 *    Authorization: Bearer <valid_token>
 *    Body: { "name": "Run 100km", "target_value": "100", "deadline": "2026-06-30" }
 *
 * 2. Validation error - target_value = 0 (422):
 *    Body: { "name": "Test", "target_value": "0", "deadline": "2026-06-30" }
 *
 * 3. Validation error - deadline in past (422):
 *    Body: { "name": "Test", "target_value": "100", "deadline": "2024-01-01" }
 *
 * 4. Parent goal not found (404):
 *    Body: { "name": "Test", "target_value": "100", "deadline": "2026-06-30", "parent_goal_id": "00000000-0000-0000-0000-000000000000" }
 *
 * 5. Unauthenticated (401):
 *    No Authorization header or invalid token
 *
 * 6. Invalid JSON (400):
 *    Body: { invalid json }
 */
export async function POST(context: APIContext) {
  try {
    // Step 1: Authentication (disabled for development)
    const supabase = context.locals.supabase;

    // TODO: Remove hardcoded user ID before production deployment
    // For development, use a default user ID (create this user in Supabase first)
    const DEV_USER_ID = "";
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

    // Step 2: Parse and validate request body
    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_json",
            message: "Invalid JSON in request body",
          },
        } satisfies ApiErrorDto<"invalid_json">),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validation = createGoalSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Invalid input data",
            details: validation.error.format(),
          },
        } satisfies ApiErrorDto<"validation_error">),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const command: CreateGoalCommand = validation.data;

    // Step 3: Validate parent_goal_id if provided
    if (command.parent_goal_id) {
      try {
        await assertParentGoalAccessible(supabase, user.id, command.parent_goal_id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "parent_goal_not_found") {
            return new Response(
              JSON.stringify({
                error: {
                  code: "parent_goal_not_found",
                  message: "Parent goal not found or does not belong to user",
                },
              } satisfies ApiErrorDto<"parent_goal_not_found">),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
        throw error;
      }
    }

    // Step 4: Create goal in database
    const goal = await createGoal(supabase, user.id, command);

    const response: CreateGoalResponseDto = {
      data: { goal },
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/goals:", error);
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

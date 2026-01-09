import type { APIContext } from "astro";
import { z } from "zod";
import type {
  CreateGoalCommand,
  CreateGoalResponseDto,
  ApiErrorDto,
  GetGoalsQueryDto,
  GetGoalsResponseDto,
} from "../../../types";
import { assertParentGoalAccessible, createGoal, listGoals } from "../../../lib/services/goals.service";
import { validateIterationChainForNewGoal } from "../../../lib/services/goal-lifecycle.service";
import { getUserFromRequest } from "../../../lib/auth/getUserFromRequest";

export const prerender = false;

/**
 * Zod schema for GET /api/goals query parameters
 *
 * Validates and normalizes:
 * - status: enum value (active, completed_success, completed_failure, abandoned)
 * - q: search query string (1-200 chars, trimmed)
 * - parentGoalId: valid UUID
 * - root: boolean flag ("true" or "false")
 * - sort: created_at (default) or deadline
 * - order: asc or desc (default desc)
 * - page: integer >= 1 (default 1)
 * - pageSize: integer 1-100 (default 20)
 */
const getGoalsQuerySchema = z
  .object({
    status: z.enum(["active", "completed_success", "completed_failure", "abandoned"]).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    parentGoalId: z.string().uuid().optional(),
    root: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    sort: z.enum(["created_at", "deadline"]).default("created_at"),
    order: z.enum(["asc", "desc"]).default("desc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((data) => !(data.root && data.parentGoalId), {
    message: "Cannot use both 'root=true' and 'parentGoalId' filters simultaneously",
    path: ["root"],
  });

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
  name: z.string().trim().min(1, "Goal name is required").max(50, "Goal name must not exceed 50 characters"),
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
 * GET /api/goals - List goals for authenticated user
 *
 * Returns paginated list of goals with computed fields.
 * Supports filtering by status, parent goal, search query, and sorting.
 *
 * Test scenarios:
 * 1. Success (200):
 *    GET /api/goals?page=1&pageSize=20
 *    Authorization: Bearer <valid_token>
 *
 * 2. With filters (200):
 *    GET /api/goals?status=active&sort=deadline&order=asc
 *
 * 3. Search query (200):
 *    GET /api/goals?q=run
 *
 * 4. Root goals only (200):
 *    GET /api/goals?root=true
 *
 * 5. Validation error - conflicting filters (400):
 *    GET /api/goals?root=true&parentGoalId=<uuid>
 *
 * 6. Validation error - invalid page (400):
 *    GET /api/goals?page=0
 *
 * 7. Unauthenticated (401):
 *    No Authorization header or invalid token
 */
export async function GET(context: APIContext) {
  try {
    // Step 1: Parse and validate query parameters
    const url = new URL(context.request.url);
    const queryParams = Object.fromEntries(url.searchParams);

    const parseResult = getGoalsQuerySchema.safeParse(queryParams);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_query_params",
            message: "Invalid query parameters",
            details: parseResult.error.flatten(),
          },
        } satisfies ApiErrorDto<"invalid_query_params">),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const query: GetGoalsQueryDto = parseResult.data;

    // Step 2: Authentication
    const authResult = await getUserFromRequest(context);
    if (!authResult.success) {
      return authResult.response;
    }

    const supabase = context.locals.supabase;

    // Step 3: Call service to list goals
    const result = await listGoals(supabase, authResult.userId, query);

    // Step 4: Return success response
    return new Response(
      JSON.stringify({
        data: result,
      } satisfies GetGoalsResponseDto),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("GET /api/goals error:", error);

    // Handle specific service errors
    if (error instanceof Error) {
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
    // Step 1: Authentication
    const authResult = await getUserFromRequest(context);
    if (!authResult.success) {
      return authResult.response;
    }

    const supabase = context.locals.supabase;

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
        await assertParentGoalAccessible(supabase, authResult.userId, command.parent_goal_id);
        // Validate iteration chain constraints
        await validateIterationChainForNewGoal(supabase, command.parent_goal_id);
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
        }
        throw error;
      }
    }

    // Step 4: Create goal in database
    const goal = await createGoal(supabase, authResult.userId, command);

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

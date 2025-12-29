import type { APIContext } from "astro";
import { z } from "zod";
import type { ApiErrorDto, GetGoalProgressResponseDto, CreateGoalProgressResponseDto } from "../../../../types";
import { listGoalProgress, createGoalProgressEntry } from "../../../../lib/services/goal-progress.service";
import { getUserFromRequest } from "../../../../lib/auth/getUserFromRequest";

export const prerender = false;

/**
 * Zod schema for goalId path parameter validation
 */
const goalIdSchema = z.string().uuid("Goal ID must be a valid UUID");

/**
 * Zod schema for GET query parameters validation
 */
const getGoalProgressQuerySchema = z.object({
  sort: z.enum(["created_at"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z
    .string()
    .refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 1, {
      message: "Page must be a positive integer",
    })
    .transform((val) => parseInt(val, 10))
    .default("1"),
  pageSize: z
    .string()
    .refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 1 && parseInt(val, 10) <= 100, {
      message: "Page size must be between 1 and 100",
    })
    .transform((val) => parseInt(val, 10))
    .default("20"),
});

/**
 * Zod schema for POST request body validation
 */
const createGoalProgressSchema = z.object({
  value: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    {
      message: "Value must be a positive decimal number",
    }
  ),
  notes: z.string().trim().max(2000, "Notes must not exceed 2000 characters").optional(),
});

/**
 * GET /api/goals/:goalId/progress
 *
 * List progress entries for a specific goal with pagination and sorting.
 *
 * @param context.params.goalId - UUID of the goal
 * @param context.request.url - Query params: sort, order, page, pageSize
 * @returns 200 with paginated progress entries or error response
 */
export async function GET(context: APIContext): Promise<Response> {
  const supabase = context.locals.supabase;

  // =========================================================================
  // 1. Validate path parameters
  // =========================================================================
  const goalIdValidation = goalIdSchema.safeParse(context.params.goalId);
  if (!goalIdValidation.success) {
    const errorResponse: ApiErrorDto<"invalid_path_params"> = {
      error: {
        code: "invalid_path_params",
        message: "Invalid goal ID format",
        details: goalIdValidation.error.errors,
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const goalId = goalIdValidation.data;

  // =========================================================================
  // 2. Validate query parameters
  // =========================================================================
  const url = new URL(context.request.url);
  const queryParams = {
    sort: url.searchParams.get("sort") ?? undefined,
    order: url.searchParams.get("order") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  };

  const queryValidation = getGoalProgressQuerySchema.safeParse(queryParams);
  if (!queryValidation.success) {
    const errorResponse: ApiErrorDto<"invalid_query_params"> = {
      error: {
        code: "invalid_query_params",
        message: "Invalid query parameters",
        details: queryValidation.error.errors,
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const query = queryValidation.data;

  // =========================================================================
  // 3. Authentication (DEV MODE)
  // =========================================================================
  // TODO: Replace with production authentication using Bearer token
  // const authHeader = context.request.headers.get("Authorization");
  // if (!authHeader?.startsWith("Bearer ")) {
  //   const errorResponse: ApiErrorDto<"unauthenticated"> = {
  //     error: {
  //       code: "unauthenticated",
  //       message: "Missing or invalid authentication token",
  //     },
  //   };
  //   return new Response(JSON.stringify(errorResponse), {
  //     status: 401,
  //     headers: { "Content-Type": "application/json" },
  //   });
  // }
  //
  // const token = authHeader.substring(7);
  // const { data: userData, error: authError } = await supabase.auth.getUser(token);
  // if (authError || !userData?.user) {
  //   const errorResponse: ApiErrorDto<"unauthenticated"> = {
  //     error: {
  //       code: "unauthenticated",
  //       message: "Invalid authentication token",
  //     },
  //   };
  //   return new Response(JSON.stringify(errorResponse), {
  //     status: 401,
  //     headers: { "Content-Type": "application/json" },
  //   });
  // }
  // const userId = userData.user.id;

  // Authentication
  const authResult = await getUserFromRequest(context);
  if (!authResult.success) {
    return authResult.response;
  }

  // =========================================================================
  // 4. Service layer call
  // =========================================================================
  try {
    const result = await listGoalProgress(supabase, authResult.userId, goalId, query);

    const successResponse: GetGoalProgressResponseDto = {
      data: result,
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error listing goal progress:", error);

    // Map service errors to HTTP responses
    if (error instanceof Error) {
      if (error.message === "goal_not_found") {
        const errorResponse: ApiErrorDto<"goal_not_found"> = {
          error: {
            code: "goal_not_found",
            message: "Goal not found or access denied",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (error.message === "database_error") {
        const errorResponse: ApiErrorDto<"database_error"> = {
          error: {
            code: "database_error",
            message: "Database operation failed",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Unexpected error
    const errorResponse: ApiErrorDto<"internal_error"> = {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred",
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * POST /api/goals/:goalId/progress
 *
 * Create a new progress entry for a specific goal.
 * Only allowed for goals with status 'active'.
 *
 * @param context.params.goalId - UUID of the goal
 * @param context.request - JSON body with value (DecimalString) and optional notes
 * @returns 201 with created progress entry, goal info, and computed values
 */
export async function POST(context: APIContext): Promise<Response> {
  const supabase = context.locals.supabase;

  // =========================================================================
  // 1. Validate path parameters
  // =========================================================================
  const goalIdValidation = goalIdSchema.safeParse(context.params.goalId);
  if (!goalIdValidation.success) {
    const errorResponse: ApiErrorDto<"invalid_path_params"> = {
      error: {
        code: "invalid_path_params",
        message: "Invalid goal ID format",
        details: goalIdValidation.error.errors,
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const goalId = goalIdValidation.data;

  // =========================================================================
  // 2. Parse and validate request body
  // =========================================================================
  let requestBody: unknown;
  try {
    requestBody = await context.request.json();
  } catch (error) {
    const errorResponse: ApiErrorDto<"validation_error"> = {
      error: {
        code: "validation_error",
        message: "Invalid JSON in request body",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bodyValidation = createGoalProgressSchema.safeParse(requestBody);
  if (!bodyValidation.success) {
    const errorResponse: ApiErrorDto<"validation_error"> = {
      error: {
        code: "validation_error",
        message: "Invalid request body",
        details: bodyValidation.error.errors,
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const command = bodyValidation.data;

  // =========================================================================
  // 3. Authentication (DEV MODE)
  // =========================================================================
  // TODO: Replace with production authentication using Bearer token
  // const authHeader = context.request.headers.get("Authorization");
  // if (!authHeader?.startsWith("Bearer ")) {
  //   const errorResponse: ApiErrorDto<"unauthenticated"> = {
  //     error: {
  //       code: "unauthenticated",
  //       message: "Missing or invalid authentication token",
  //     },
  //   };
  //   return new Response(JSON.stringify(errorResponse), {
  //     status: 401,
  //     headers: { "Content-Type": "application/json" },
  //   });
  // }
  //
  // const token = authHeader.substring(7);
  // const { data: userData, error: authError } = await supabase.auth.getUser(token);
  // if (authError || !userData?.user) {
  //   const errorResponse: ApiErrorDto<"unauthenticated"> = {
  //     error: {
  //       code: "unauthenticated",
  //       message: "Invalid authentication token",
  //     },
  //   };
  //   return new Response(JSON.stringify(errorResponse), {
  //     status: 401,
  //     headers: { "Content-Type": "application/json" },
  //   });
  // }
  // const userId = userData.user.id;

  // Authentication
  const authResult = await getUserFromRequest(context);
  if (!authResult.success) {
    return authResult.response;
  }

  // =========================================================================
  // 4. Service layer call
  // =========================================================================
  try {
    const result = await createGoalProgressEntry(supabase, authResult.userId, goalId, command);

    const successResponse: CreateGoalProgressResponseDto = {
      data: result,
    };

    return new Response(JSON.stringify(successResponse), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error creating goal progress:", error);

    // Map service errors to HTTP responses
    if (error instanceof Error) {
      if (error.message === "goal_not_found") {
        const errorResponse: ApiErrorDto<"goal_not_found"> = {
          error: {
            code: "goal_not_found",
            message: "Goal not found or access denied",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (error.message === "goal_not_active") {
        const errorResponse: ApiErrorDto<"goal_not_active"> = {
          error: {
            code: "goal_not_active",
            message: "Cannot add progress to a goal that is not active",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (error.message === "database_error") {
        const errorResponse: ApiErrorDto<"database_error"> = {
          error: {
            code: "database_error",
            message: "Database operation failed",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Unexpected error
    const errorResponse: ApiErrorDto<"internal_error"> = {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred",
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

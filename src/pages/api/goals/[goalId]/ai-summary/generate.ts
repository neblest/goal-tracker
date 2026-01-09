import type { APIContext } from "astro";
import { z } from "zod";
import type { GenerateAiSummaryCommand, GenerateAiSummaryResponseDto, ApiErrorDto } from "../../../../../types";
import { generateAiSummary } from "../../../../../lib/services/ai-summary.service";
import { getUserFromRequest } from "../../../../../lib/auth/getUserFromRequest";
import { checkRateLimit, RateLimitPresets } from "../../../../../lib/middleware/rate-limiter";

export const prerender = false;

/**
 * Zod schema for goalId path parameter validation
 */
const goalIdSchema = z.string().uuid("Goal ID must be a valid UUID");

/**
 * Zod schema for GenerateAiSummaryCommand validation
 *
 * Validates:
 * - force: optional boolean, defaults to false
 */
const generateAiSummaryBodySchema = z.object({
  force: z.boolean().optional().default(false),
});

/**
 * POST /api/goals/:goalId/ai-summary/generate - Generate AI summary for completed or abandoned goal
 *
 * Synchronously generates an AI summary for a completed or abandoned goal
 * if it has at least 3 progress entries. The summary includes a suggested next goal
 * with justification embedded within the summary text.
 *
 * Business rules:
 * - Goal must exist and belong to the user
 * - Goal must be in 'completed_success', 'completed_failure', or 'abandoned' status (409 if active)
 * - Goal must have at least 3 progress entries (412 if less)
 * - If ai_summary already exists and force !== true, returns existing summary
 * - If force === true, regenerates summary even if it exists
 * - Calls Openrouter AI API to generate summary (can take 2-10 seconds)
 * - Saves generated summary to database
 *
 * Test scenarios:
 * 1. Success (200):
 *    POST /api/goals/<completed_goal_uuid>/ai-summary/generate
 *    Authorization: Bearer <valid_token>
 *    Body: {} or { "force": false }
 *
 * 2. Regeneration (200):
 *    POST /api/goals/<completed_goal_with_summary_uuid>/ai-summary/generate
 *    Body: { "force": true }
 *
 * 3. Invalid UUID (400):
 *    POST /api/goals/invalid-uuid/ai-summary/generate
 *
 * 4. Goal not found (404):
 *    POST /api/goals/00000000-0000-0000-0000-000000000000/ai-summary/generate
 *
 * 5. Goal is active (409):
 *    POST /api/goals/<active_goal_uuid>/ai-summary/generate
 *
 * 6. Not enough progress entries (412):
 *    POST /api/goals/<completed_goal_uuid>/ai-summary/generate
 *    (Goal has < 3 progress entries)
 *
 * 7. Invalid body (422):
 *    POST /api/goals/<completed_goal_uuid>/ai-summary/generate
 *    Body: { "force": "invalid" }
 *
 * 8. Unauthenticated (401):
 *    No Authorization header or invalid token
 *
 * 9. AI provider error (502):
 *    Openrouter API error or timeout
 *
 * 10. Rate limited (429):
 *    Too many requests (>10 per minute)
 *
 * HTTP responses:
 * - 200: Summary generated successfully with { data: { goal: { id, ai_summary } } }
 * - 400: Invalid UUID format
 * - 401: User not authenticated
 * - 404: Goal not found or not owned by user
 * - 409: Invalid goal state (active)
 * - 412: Not enough data (less than 3 progress entries)
 * - 422: Validation error (invalid body)
 * - 429: Rate limited (too many requests)
 * - 500: Server error during processing
 * - 502: AI provider error
 */
export async function POST(context: APIContext): Promise<Response> {
  // Step 1: Authentication
  const authResult = await getUserFromRequest(context);
  if (!authResult.success) {
    return authResult.response;
  }

  // Step 2: Rate limiting check
  const rateLimitResult = checkRateLimit(authResult.userId, RateLimitPresets.AI_GENERATION);

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: {
          code: "rate_limited",
          message: `Too many AI generation requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          details: {
            retryAfter: rateLimitResult.retryAfter,
            resetAt: rateLimitResult.resetAt.toISOString(),
          },
        },
      } satisfies ApiErrorDto<"rate_limited">),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateLimitResult.retryAfter),
          "X-RateLimit-Limit": String(RateLimitPresets.AI_GENERATION.maxRequests),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          "X-RateLimit-Reset": rateLimitResult.resetAt.toISOString(),
        },
      }
    );
  }

  // Step 3: Validate goalId path parameter
  const goalIdValidation = goalIdSchema.safeParse(context.params.goalId);

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

  // Step 4: Parse and validate request body (optional)
  let command: GenerateAiSummaryCommand = { force: false };

  // Try to parse JSON body if present
  const contentType = context.request.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    try {
      const requestBody = await context.request.json();
      const bodyValidation = generateAiSummaryBodySchema.safeParse(requestBody);

      if (!bodyValidation.success) {
        return new Response(
          JSON.stringify({
            error: {
              code: "validation_error",
              message: "Invalid request body",
              details: bodyValidation.error.flatten(),
            },
          } satisfies ApiErrorDto<"validation_error">),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      command = bodyValidation.data;
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
  }

  // Step 5: Generate AI summary via service layer
  try {
    const result = await generateAiSummary(context.locals.supabase, authResult.userId, goalId, command);

    const successResponse: GenerateAiSummaryResponseDto = {
      data: result,
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(RateLimitPresets.AI_GENERATION.maxRequests),
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        "X-RateLimit-Reset": rateLimitResult.resetAt.toISOString(),
      },
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
        case "invalid_goal_state": {
          return new Response(
            JSON.stringify({
              error: {
                code: "invalid_goal_state",
                message: "AI summary can only be generated for completed or abandoned goals (not active)",
              },
            } satisfies ApiErrorDto<"invalid_goal_state">),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        case "not_enough_data": {
          return new Response(
            JSON.stringify({
              error: {
                code: "not_enough_data",
                message: "Goal must have at least 3 progress entries to generate AI summary",
              },
            } satisfies ApiErrorDto<"not_enough_data">),
            {
              status: 412,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        case "ai_provider_error":
        case "ai_provider_timeout":
        case "missing_api_key": {
          return new Response(
            JSON.stringify({
              error: {
                code: "ai_provider_error",
                message: "AI service is temporarily unavailable. Please try again later.",
              },
            } satisfies ApiErrorDto<"ai_provider_error">),
            {
              status: 502,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        case "database_error": {
          return new Response(
            JSON.stringify({
              error: {
                code: "internal_error",
                message: "A database error occurred while generating AI summary",
              },
            } satisfies ApiErrorDto<"internal_error">),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        default: {
          console.error("Unexpected error generating AI summary:", error);
          return new Response(
            JSON.stringify({
              error: {
                code: "internal_error",
                message: "An error occurred while generating AI summary",
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

    console.error("Unknown error generating AI summary:", error);
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

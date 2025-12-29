import type { APIContext } from "astro";
import { z } from "zod";
import type { UpdateAiSummaryCommand, UpdateAiSummaryResponseDto, ApiErrorDto } from "../../../../../types";
import { updateAiSummary } from "../../../../../lib/services/ai-summary.service";
import { getUserFromRequest } from "../../../../../lib/auth/getUserFromRequest";

export const prerender = false;

/**
 * Zod schema for goalId path parameter validation
 */
const goalIdSchema = z.string().uuid("Goal ID must be a valid UUID");

/**
 * Zod schema for UpdateAiSummaryCommand validation
 *
 * Validates:
 * - ai_summary: required, non-empty string with max 5000 characters
 */
const updateAiSummaryBodySchema = z.object({
  ai_summary: z
    .string()
    .trim()
    .min(1, "AI summary is required and cannot be empty")
    .max(5000, "AI summary must not exceed 5000 characters"),
});

/**
 * PATCH /api/goals/:goalId/ai-summary - Edit AI summary for a goal
 *
 * Allows manual editing of the AI summary field. This can be used to:
 * - Edit an existing AI-generated summary
 * - Manually enter a summary after AI generation failures
 * - Replace an AI summary with a custom one
 *
 * Business rules:
 * - Goal must exist and belong to the user
 * - ai_summary must be a non-empty string (1-5000 characters)
 * - No status restrictions (can edit summary for any goal)
 *
 * Test scenarios:
 * 1. Success (200):
 *    PATCH /api/goals/<goal_uuid>/ai-summary
 *    Authorization: Bearer <valid_token>
 *    Body: { "ai_summary": "My custom summary..." }
 *
 * 2. Invalid UUID (400):
 *    PATCH /api/goals/invalid-uuid/ai-summary
 *
 * 3. Goal not found (404):
 *    PATCH /api/goals/00000000-0000-0000-0000-000000000000/ai-summary
 *
 * 4. Empty summary (422):
 *    PATCH /api/goals/<goal_uuid>/ai-summary
 *    Body: { "ai_summary": "" }
 *
 * 5. Missing summary (422):
 *    PATCH /api/goals/<goal_uuid>/ai-summary
 *    Body: {}
 *
 * 6. Summary too long (422):
 *    PATCH /api/goals/<goal_uuid>/ai-summary
 *    Body: { "ai_summary": "<string over 5000 chars>" }
 *
 * 7. Invalid JSON (422):
 *    PATCH /api/goals/<goal_uuid>/ai-summary
 *    Body: invalid json
 *
 * 8. Unauthenticated (401):
 *    No Authorization header or invalid token
 *
 * HTTP responses:
 * - 200: Summary updated successfully with { data: { goal: { id, ai_summary } } }
 * - 400: Invalid UUID format
 * - 401: User not authenticated
 * - 404: Goal not found or not owned by user
 * - 422: Validation error (empty, missing, or too long summary)
 * - 500: Server error during processing
 */
export async function PATCH(context: APIContext): Promise<Response> {
  // Step 1: Authentication
  const authResult = await getUserFromRequest(context);
  if (!authResult.success) {
    return authResult.response;
  }

  // Step 2: Validate goalId path parameter
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

  // Step 3: Parse and validate request body
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

  const bodyValidation = updateAiSummaryBodySchema.safeParse(requestBody);

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

  const command: UpdateAiSummaryCommand = bodyValidation.data;

  // Step 4: Update AI summary via service layer
  try {
    const result = await updateAiSummary(context.locals.supabase, authResult.userId, goalId, command.ai_summary);

    const successResponse: UpdateAiSummaryResponseDto = {
      data: {
        goal: result,
      },
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
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
        case "database_error": {
          return new Response(
            JSON.stringify({
              error: {
                code: "internal_error",
                message: "A database error occurred while updating AI summary",
              },
            } satisfies ApiErrorDto<"internal_error">),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        default: {
          // eslint-disable-next-line no-console
          console.error("Unexpected error updating AI summary:", error);
          return new Response(
            JSON.stringify({
              error: {
                code: "internal_error",
                message: "An error occurred while updating AI summary",
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
    // eslint-disable-next-line no-console
    console.error("Unknown error updating AI summary:", error);
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

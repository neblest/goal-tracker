import type { APIContext } from "astro";
import { z } from "zod";
import type { ApiErrorDto, UpdateProgressResponseDto, DeleteProgressResponseDto } from "../../../types";
import { updateProgressEntry, deleteProgressEntry } from "../../../lib/services/goal-progress.service";

export const prerender = false;

/**
 * Zod schema for progressId path parameter validation
 */
const progressIdSchema = z.string().uuid("Progress ID must be a valid UUID");

/**
 * Zod schema for PATCH request body validation
 * At least one field must be provided
 */
const updateProgressSchema = z
  .object({
    value: z
      .string()
      .refine(
        (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num > 0;
        },
        {
          message: "Value must be a positive decimal number",
        }
      )
      .optional(),
    notes: z.string().trim().max(2000, "Notes must not exceed 2000 characters").optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (value or notes) must be provided",
  });

/**
 * PATCH /api/progress/:progressId
 * Updates an existing progress entry
 *
 * Authentication: Required (Bearer token or DEV_USER_ID)
 * Authorization: Progress entry must belong to user's goal
 * Business rule: Associated goal must have status 'active'
 */
export async function PATCH(context: APIContext): Promise<Response> {
  // =========================================================================
  // 1. Validate progressId path parameter
  // =========================================================================
  const { progressId } = context.params;

  const progressIdValidation = progressIdSchema.safeParse(progressId);
  if (!progressIdValidation.success) {
    const errorResponse: ApiErrorDto = {
      error: {
        code: "invalid_path_params",
        message: "Invalid progress ID format",
        details: progressIdValidation.error.issues,
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // =========================================================================
  // 2. Parse and validate request body
  // =========================================================================
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    const errorResponse: ApiErrorDto = {
      error: {
        code: "validation_error",
        message: "Invalid JSON in request body",
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bodyValidation = updateProgressSchema.safeParse(body);
  if (!bodyValidation.success) {
    const errorResponse: ApiErrorDto = {
      error: {
        code: "validation_error",
        message: "Invalid request body",
        details: bodyValidation.error.issues,
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const command = bodyValidation.data;

  // =========================================================================
  // 3. Authenticate user
  // =========================================================================
  const supabase = context.locals.supabase;

  // Dev mode: use DEV_USER_ID if available
  const devUserId = "7e4b878a-8597-4b14-a9dd-4d198b79a2ab";
  const userId = { id: devUserId };

  //   if (devUserId) {
  //     userId = devUserId;
  //   } else {
  //     // Production mode: get user from session
  //     const {
  //       data: { user },
  //       error: authError,
  //     } = await supabase.auth.getUser();

  //     if (authError || !user) {
  //       const errorResponse: ApiErrorDto = {
  //         error: {
  //           code: "unauthenticated",
  //           message: "Authentication required",
  //         },
  //       };
  //       return new Response(JSON.stringify(errorResponse), {
  //         status: 401,
  //         headers: { "Content-Type": "application/json" },
  //       });
  //     }

  //     userId = user.id;
  //   }

  // =========================================================================
  // 4. Update progress entry via service
  // =========================================================================
  try {
    const updatedProgress = await updateProgressEntry(supabase, userId.id, progressIdValidation.data, command);

    const successResponse: UpdateProgressResponseDto = {
      data: {
        progress: updatedProgress,
      },
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error updating progress entry:", error);

    if (error instanceof Error) {
      if (error.message === "progress_not_found") {
        const errorResponse: ApiErrorDto = {
          error: {
            code: "progress_not_found",
            message: "Progress entry not found or access denied",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (error.message === "goal_not_active") {
        const errorResponse: ApiErrorDto = {
          error: {
            code: "goal_not_active",
            message: "Cannot update progress for a goal that is not active",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Generic database/server error
    const errorResponse: ApiErrorDto = {
      error: {
        code: "internal_error",
        message: "An internal error occurred while updating progress entry",
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * DELETE /api/progress/:progressId
 * Deletes an existing progress entry
 *
 * Authentication: Required (Bearer token or DEV_USER_ID)
 * Authorization: Progress entry must belong to user's goal
 * Business rule: Associated goal must have status 'active'
 *
 * Test scenarios:
 * 1. Success (204):
 *    DELETE /api/progress/:progressId
 *    Authorization: Bearer <valid_token>
 *
 * 2. Invalid progressId format (400):
 *    DELETE /api/progress/invalid-uuid
 *
 * 3. Progress entry not found (404):
 *    DELETE /api/progress/00000000-0000-0000-0000-000000000000
 *
 * 4. Goal not active (409):
 *    Try to delete progress for a goal with status != 'active'
 *
 * 5. Unauthenticated (401):
 *    No Authorization header or invalid token
 */
export async function DELETE(context: APIContext): Promise<Response> {
  // =========================================================================
  // 1. Validate progressId path parameter
  // =========================================================================
  const { progressId } = context.params;

  const progressIdValidation = progressIdSchema.safeParse(progressId);
  if (!progressIdValidation.success) {
    const errorResponse: ApiErrorDto = {
      error: {
        code: "invalid_path_params",
        message: "Invalid progress ID format",
        details: progressIdValidation.error.issues,
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // =========================================================================
  // 2. Authenticate user
  // =========================================================================
  const supabase = context.locals.supabase;

  // Dev mode: use DEV_USER_ID if available
  const devUserId = "7e4b878a-8597-4b14-a9dd-4d198b79a2ab";
  const userId = { id: devUserId };

  //   if (devUserId) {
  //     userId = devUserId;
  //   } else {
  //     // Production mode: get user from session
  //     const {
  //       data: { user },
  //       error: authError,
  //     } = await supabase.auth.getUser();

  //     if (authError || !user) {
  //       const errorResponse: ApiErrorDto = {
  //         error: {
  //           code: "unauthenticated",
  //           message: "Authentication required",
  //         },
  //       };
  //       return new Response(JSON.stringify(errorResponse), {
  //         status: 401,
  //         headers: { "Content-Type": "application/json" },
  //       });
  //     }

  //     userId = user.id;
  //   }

  // =========================================================================
  // 3. Delete progress entry via service
  // =========================================================================
  try {
    await deleteProgressEntry(supabase, userId.id, progressIdValidation.data);

    // Return 204 No Content on successful deletion
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error deleting progress entry:", error);

    if (error instanceof Error) {
      if (error.message === "progress_not_found") {
        const errorResponse: ApiErrorDto = {
          error: {
            code: "progress_not_found",
            message: "Progress entry not found or access denied",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (error.message === "goal_not_active") {
        const errorResponse: ApiErrorDto = {
          error: {
            code: "goal_not_active",
            message: "Cannot delete progress for a goal that is not active",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Generic database/server error
    const errorResponse: ApiErrorDto = {
      error: {
        code: "internal_error",
        message: "An internal error occurred while deleting progress entry",
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

import type { APIContext } from "astro";
import type { ApiErrorDto, MeResponseDto } from "../../../types";
import { getUserFromRequest } from "../../../lib/auth/getUserFromRequest";

export const prerender = false;

/**
 * GET /api/auth/me - Return current authenticated user identity
 *
 * Uses HttpOnly cookies for authentication.
 *
 * Test scenarios:
 * 1. Success (200):
 *    GET /api/auth/me
 *    (with valid access_token cookie)
 *
 * 2. No cookie (401):
 *    GET /api/auth/me
 *    (no access_token cookie)
 *
 * 3. Expired/invalid token (401):
 *    GET /api/auth/me
 *    (with expired or invalid access_token cookie)
 */
export async function GET(context: APIContext) {
  try {
    // Step 1: Authenticate user from HttpOnly cookie
    const authResult = await getUserFromRequest(context);

    if (!authResult.success) {
      return authResult.response;
    }

    // Step 2: Get user data
    const supabase = context.locals.supabase;
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_token",
            message: "Invalid or expired authentication token",
          },
        } satisfies ApiErrorDto<"invalid_token">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 3: Return success response
    const response: MeResponseDto = {
      data: {
        user: {
          id: data.user.id,
          email: data.user.email ?? null,
        },
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/auth/me:", error);

    return new Response(
      JSON.stringify({
        error: {
          code: "internal_server_error",
          message: "An unexpected error occurred",
        },
      } satisfies ApiErrorDto<"internal_server_error">),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

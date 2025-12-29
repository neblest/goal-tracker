import type { APIContext } from "astro";
import type { ApiErrorDto, MeResponseDto } from "../../../types";

export const prerender = false;

/**
 * GET /api/auth/me - Return current authenticated user identity
 *
 * Test scenarios:
 * 1. Success (200):
 *    GET /api/auth/me
 *    Headers: Authorization: Bearer <valid_token>
 *
 * 2. No authorization header (401):
 *    GET /api/auth/me
 *    (no Authorization header)
 *
 * 3. Invalid token format (401):
 *    Headers: Authorization: InvalidFormat
 *
 * 4. Expired/invalid token (401):
 *    Headers: Authorization: Bearer <expired_or_invalid_token>
 */
export async function GET(context: APIContext) {
  try {
    // Step 1: Extract and validate Authorization header
    const authHeader = context.request.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: {
            code: "unauthorized",
            message: "Authentication required",
          },
        } satisfies ApiErrorDto<"unauthorized">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: {
            code: "unauthorized",
            message: "Invalid authorization header format",
          },
        } satisfies ApiErrorDto<"unauthorized">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    if (!token) {
      return new Response(
        JSON.stringify({
          error: {
            code: "unauthorized",
            message: "Authentication token is required",
          },
        } satisfies ApiErrorDto<"unauthorized">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Verify token with Supabase Auth
    const supabase = context.locals.supabase;

    const { data, error } = await supabase.auth.getUser(token);

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

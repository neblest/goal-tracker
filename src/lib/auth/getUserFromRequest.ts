import type { APIContext } from "astro";
import type { ApiErrorDto } from "../../types";

/**
 * Extract and validate user from Authorization header
 *
 * Returns user ID if authentication is successful.
 * Returns error Response if authentication fails.
 */
export async function getUserFromRequest(
  context: APIContext
): Promise<{ success: true; userId: string } | { success: false; response: Response }> {
  const supabase = context.locals.supabase;

  // Step 1: Extract Authorization header
  const authHeader = context.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          error: {
            code: "not_authenticated",
            message: "Authentication required",
          },
        } satisfies ApiErrorDto<"not_authenticated">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  if (!token) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          error: {
            code: "not_authenticated",
            message: "Authentication required",
          },
        } satisfies ApiErrorDto<"not_authenticated">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  // Step 2: Verify token with Supabase Auth
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          error: {
            code: "not_authenticated",
            message: "Authentication required",
          },
        } satisfies ApiErrorDto<"not_authenticated">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  return {
    success: true,
    userId: user.id,
  };
}

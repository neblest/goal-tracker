import type { APIContext } from "astro";
import type { ApiErrorDto } from "../../types";

/**
 * Extract and validate user from HttpOnly cookie
 *
 * Returns user ID if authentication is successful.
 * Returns error Response if authentication fails.
 */
export async function getUserFromRequest(
  context: APIContext
): Promise<{ success: true; userId: string } | { success: false; response: Response }> {
  const supabase = context.locals.supabase;

  // Step 1: Extract access token from cookie
  const cookieHeader = context.request.headers.get("Cookie");
  let accessToken: string | null = null;

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const accessTokenCookie = cookies.find((c) => c.startsWith("access_token="));
    if (accessTokenCookie) {
      accessToken = accessTokenCookie.split("=")[1];
    }
  }

  if (!accessToken) {
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
  } = await supabase.auth.getUser(accessToken);

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

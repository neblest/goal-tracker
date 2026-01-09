import type { APIContext } from "astro";
import type { ApiErrorDto } from "../../../types";

export const prerender = false;

/**
 * POST /api/auth/logout - Logout the current user
 *
 * Test scenarios:
 * 1. Success (204):
 *    POST /api/auth/logout
 *    Header: Authorization: Bearer <valid_token>
 *
 * 2. Not authenticated (401):
 *    POST /api/auth/logout
 *    (no Authorization header)
 */
export async function POST(context: APIContext) {
  try {
    const supabase = context.locals.supabase;

    // Krok 1: Get access token from cookie
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
      return new Response(
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
      );
    }

    // Krok 2: Weryfikacja uwierzytelnienia
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return new Response(
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
      );
    }

    // Krok 3: Wylogowanie
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error("Error during sign out:", signOutError);
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

    // Krok 4: Clear cookies and return 204 No Content
    const headers = new Headers();

    // Determine if we should use Secure flag (only when using HTTPS)
    const isSecure = context.request.url.startsWith("https://");
    const secureFlag = isSecure ? "Secure; " : "";

    // Clear access token cookie
    headers.append("Set-Cookie", `access_token=; HttpOnly; ${secureFlag}SameSite=Strict; Path=/; Max-Age=0`);

    // Clear refresh token cookie
    headers.append("Set-Cookie", `refresh_token=; HttpOnly; ${secureFlag}SameSite=Strict; Path=/; Max-Age=0`);

    return new Response(null, { status: 204, headers });
  } catch (error) {
    // Obsługa nieoczekiwanych błędów
    console.error("Unexpected error in POST /api/auth/logout:", error);

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

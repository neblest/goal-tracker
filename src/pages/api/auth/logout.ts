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

    // Krok 1: Ekstrakcja i walidacja nagłówka Authorization
    const authHeader = context.request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
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

    const token = authHeader.substring(7); // Remove "Bearer "

    if (!token) {
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
    } = await supabase.auth.getUser(token);

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

    // Krok 4: Zwrócenie odpowiedzi 204 No Content
    return new Response(null, { status: 204 });
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

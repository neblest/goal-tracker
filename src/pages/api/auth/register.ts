import type { APIContext } from "astro";
import { z } from "zod";
import type { ApiErrorDto, RegisterCommand, RegisterResponseDto } from "../../../types";

export const prerender = false;

/**
 * Zod schema for RegisterCommand validation
 *
 * Validates:
 * - email: valid email format
 * - password: minimum 8 characters (as per API plan)
 */
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * POST /api/auth/register - Register a new user
 *
 * Test scenarios:
 * 1. Success (201):
 *    POST /api/auth/register
 *    Body: { "email": "newuser@example.com", "password": "securepass123" }
 *
 * 2. Validation error - invalid email (400):
 *    Body: { "email": "invalid", "password": "securepass123" }
 *
 * 3. Validation error - short password (400):
 *    Body: { "email": "user@example.com", "password": "short" }
 *
 * 4. Email already in use (409):
 *    Body: { "email": "existing@example.com", "password": "securepass123" }
 */
export async function POST(context: APIContext) {
  try {
    // Step 1: Parse and validate request body
    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_json",
            message: "Request body must be valid JSON",
          },
        } satisfies ApiErrorDto<"invalid_json">),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_payload",
            message: "Invalid request payload",
            details: parseResult.error.flatten(),
          },
        } satisfies ApiErrorDto<"invalid_payload">),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const command: RegisterCommand = parseResult.data;

    // Step 2: Register user with Supabase Auth
    const supabase = context.locals.supabase;

    const { data, error } = await supabase.auth.signUp({
      email: command.email,
      password: command.password,
    });

    if (error) {
      // Handle Supabase Auth errors
      if (error.message.includes("already registered") || error.message.includes("already exists")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "email_already_in_use",
              message: "Email address is already registered",
            },
          } satisfies ApiErrorDto<"email_already_in_use">),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Rate limiting or other errors
      if (error.status === 429) {
        return new Response(
          JSON.stringify({
            error: {
              code: "rate_limited",
              message: "Too many registration attempts. Please try again later.",
            },
          } satisfies ApiErrorDto<"rate_limited">),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Other auth errors
      return new Response(
        JSON.stringify({
          error: {
            code: "auth_error",
            message: error.message,
          },
        } satisfies ApiErrorDto<"auth_error">),
        {
          status: error.status || 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!data.user) {
      return new Response(
        JSON.stringify({
          error: {
            code: "registration_failed",
            message: "User registration failed",
          },
        } satisfies ApiErrorDto<"registration_failed">),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 3: Return success response and set cookies if session exists
    const response: RegisterResponseDto = {
      data: {
        user: {
          id: data.user.id,
          email: data.user.email ?? null,
        },
      },
    };

    const headers = new Headers({
      "Content-Type": "application/json",
    });

    // If session exists (auto-login after registration), set HttpOnly cookies
    if (data.session) {
      const accessTokenMaxAge = 60 * 60; // 1 hour in seconds
      const refreshTokenMaxAge = 60 * 60 * 24 * 7; // 7 days in seconds

      // Determine if we should use Secure flag (only when using HTTPS)
      const isSecure = context.request.url.startsWith('https://');
      const secureFlag = isSecure ? "Secure; " : "";

      // Access token cookie
      headers.append(
        "Set-Cookie",
        `access_token=${data.session.access_token}; HttpOnly; ${secureFlag}SameSite=Strict; Path=/; Max-Age=${accessTokenMaxAge}`
      );

      // Refresh token cookie
      headers.append(
        "Set-Cookie",
        `refresh_token=${data.session.refresh_token}; HttpOnly; ${secureFlag}SameSite=Strict; Path=/; Max-Age=${refreshTokenMaxAge}`
      );
    }

    return new Response(JSON.stringify(response), {
      status: 201,
      headers,
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/auth/register:", error);

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

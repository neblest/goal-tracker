import type { APIContext } from "astro";
import { z } from "zod";
import type { ApiErrorDto, LoginCommand, LoginResponseDto } from "../../../types";

export const prerender = false;

/**
 * Zod schema for LoginCommand validation
 *
 * Validates:
 * - email: valid email format
 * - password: minimum 6 characters
 */
const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * POST /api/auth/login - Authenticate user with email and password
 *
 * Test scenarios:
 * 1. Success (200):
 *    POST /api/auth/login
 *    Body: { "email": "user@example.com", "password": "validpass" }
 *
 * 2. Validation error - invalid email (400):
 *    Body: { "email": "invalid", "password": "validpass" }
 *
 * 3. Validation error - short password (400):
 *    Body: { "email": "user@example.com", "password": "123" }
 *
 * 4. Invalid credentials (401):
 *    Body: { "email": "user@example.com", "password": "wrongpass" }
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

    const parseResult = loginSchema.safeParse(body);

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

    const command: LoginCommand = parseResult.data;

    // Step 2: Authenticate with Supabase Auth
    const supabase = context.locals.supabase;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: command.email,
      password: command.password,
    });

    if (error) {
      // Handle Supabase Auth errors
      if (error.message.includes("Invalid login credentials")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "invalid_credentials",
              message: "Invalid email or password",
            },
          } satisfies ApiErrorDto<"invalid_credentials">),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Other auth errors (rate limiting, etc.)
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

    if (!data.session || !data.user) {
      return new Response(
        JSON.stringify({
          error: {
            code: "auth_failed",
            message: "Authentication failed",
          },
        } satisfies ApiErrorDto<"auth_failed">),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 3: Set HttpOnly cookies and return success response
    const response: LoginResponseDto = {
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email ?? null,
        },
      },
    };

    // Calculate cookie expiration (access token typically expires in 1 hour)
    const accessTokenMaxAge = 60 * 60; // 1 hour in seconds
    const refreshTokenMaxAge = 60 * 60 * 24 * 7; // 7 days in seconds

    // Set HttpOnly cookies for tokens
    const headers = new Headers({
      "Content-Type": "application/json",
    });

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

    return new Response(JSON.stringify(response), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/auth/login:", error);

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

/**
 * Authentication tokens management
 *
 * Handles storage and retrieval of access_token and refresh_token
 * in localStorage for client-side authentication.
 */

const ACCESS_TOKEN_KEY = "auth_access_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

/**
 * Save authentication tokens to localStorage
 */
export function setAuthTokens(tokens: AuthTokens): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  } catch (error) {
    console.error("Failed to save auth tokens:", error);
  }
}

/**
 * Get access token from localStorage
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error("Failed to get access token:", error);
    return null;
  }
}

/**
 * Get refresh token from localStorage
 */
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error("Failed to get refresh token:", error);
    return null;
  }
}

/**
 * Get both tokens from localStorage
 */
export function getAuthTokens(): AuthTokens | null {
  const access_token = getAccessToken();
  const refresh_token = getRefreshToken();

  if (!access_token || !refresh_token) {
    return null;
  }

  return { access_token, refresh_token };
}

/**
 * Remove authentication tokens from localStorage
 */
export function clearAuthTokens(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error("Failed to clear auth tokens:", error);
  }
}

/**
 * Check if user has valid tokens (doesn't verify expiration)
 */
export function hasAuthTokens(): boolean {
  return getAccessToken() !== null && getRefreshToken() !== null;
}

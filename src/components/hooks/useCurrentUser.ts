import { useEffect, useState } from "react";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type { MeResponseDto, AuthUserDto } from "@/types";

export interface UseCurrentUserResult {
  user: AuthUserDto | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for fetching current authenticated user from /api/auth/me
 *
 * Automatically fetches user data on mount using HttpOnly cookies.
 * Returns loading state, user data, and error information.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiFetchJson<MeResponseDto>("/api/auth/me", {
          method: "GET",
        });

        if (isMounted) {
          setUser(response.data.user);
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiError) {
            // 401 errors are handled by apiFetchJson (redirect to login)
            // Other errors should be displayed
            if (err.status !== 401) {
              setError("Failed to fetch user data");
            }
          } else {
            setError("Server connection error");
          }
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, []);

  return { user, isLoading, error };
}

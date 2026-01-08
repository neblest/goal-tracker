export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
}

function buildHeaders(init?: RequestInit): HeadersInit {
  const baseHeaders: HeadersInit = {
    Accept: "application/json",
  };

  // No need to add Authorization header - cookies are sent automatically
  // with credentials: 'include'

  if (init?.body && !(init.headers as HeadersInit)?.["Content-Type"]) {
    return { ...baseHeaders, "Content-Type": "application/json", ...init?.headers };
  }

  return { ...baseHeaders, ...init?.headers };
}

export async function apiFetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: buildHeaders(init),
    credentials: "include", // Important: send cookies with request
  });

  const text = await response.text();
  let parsedBody: unknown = null;

  if (text.length > 0) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text;
    }
  }

  if (response.status === 401 && typeof window !== "undefined") {
    // Redirect to login on 401 (unauthorized/expired token)
    // No need to clear cookies - they are HttpOnly and managed by server
    // Skip redirect if user is already on login/register page
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath === "/login" || currentPath === "/register";

    if (!isAuthPage) {
      window.location.href = "/login";
    }
  }

  if (!response.ok) {
    const messageFromBody =
      typeof parsedBody === "object" && parsedBody && "error" in parsedBody
        ? (parsedBody as { error?: { message?: string } }).error?.message
        : undefined;

    const message = messageFromBody ?? `Request failed with status ${response.status}`;

    throw new ApiError(response.status, message, parsedBody);
  }

  return parsedBody as T;
}

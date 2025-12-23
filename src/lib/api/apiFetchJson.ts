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

  if (init?.body && !(init.headers as HeadersInit)?.["Content-Type"]) {
    return { ...baseHeaders, "Content-Type": "application/json", ...init?.headers };
  }

  return { ...baseHeaders, ...init?.headers };
}

export async function apiFetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: buildHeaders(init),
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
    window.location.href = "/login";
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

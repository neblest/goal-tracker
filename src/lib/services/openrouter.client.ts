/**
 * Openrouter API Client
 *
 * Provides a lightweight interface to the Openrouter API for AI chat completions.
 * Used for generating AI summaries for completed goals.
 *
 * @see https://openrouter.ai/docs
 */

interface OpenrouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenrouterChatCompletionRequest {
  model: string;
  messages: OpenrouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

interface OpenrouterChatCompletionResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generates a chat completion using Openrouter API
 *
 * @param messages - Array of messages for the conversation
 * @param options - Optional configuration (model, temperature, etc.)
 * @returns The generated response content
 * @throws Error with code:
 *   - "missing_api_key": OPENROUTER_API_KEY not configured
 *   - "ai_provider_timeout": Request timed out
 *   - "ai_provider_error": API returned error or invalid response
 */
export async function generateChatCompletion(
  messages: OpenrouterMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "json";
  }
): Promise<string> {
  const apiKey = import.meta.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.error("OPENROUTER_API_KEY is not configured");
    throw new Error("missing_api_key");
  }

  const model = options?.model || import.meta.env.OPENROUTER_MODEL || "anthropic/claude-3-haiku-20240307";

  const requestBody: OpenrouterChatCompletionRequest = {
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2000,
  };

  // Enable JSON mode if requested
  if (options?.responseFormat === "json") {
    requestBody.response_format = { type: "json_object" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://goal-tracker.app", // Optional: for Openrouter analytics
        "X-Title": "Goal Tracker", // Optional: for Openrouter analytics
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      // eslint-disable-next-line no-console
      console.error(`Openrouter API error (${response.status}):`, errorText);
      throw new Error("ai_provider_error");
    }

    const data = (await response.json()) as OpenrouterChatCompletionResponse;

    if (!data.choices || data.choices.length === 0 || !data.choices[0]?.message?.content) {
      // eslint-disable-next-line no-console
      console.error("Invalid Openrouter API response:", data);
      throw new Error("ai_provider_error");
    }

    return data.choices[0].message.content;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        // eslint-disable-next-line no-console
        console.error("Openrouter API request timed out");
        throw new Error("ai_provider_timeout");
      }

      // Re-throw our custom errors
      if (error.message === "missing_api_key" || error.message === "ai_provider_error") {
        throw error;
      }
    }

    // Network or other unexpected errors
    // eslint-disable-next-line no-console
    console.error("Unexpected error calling Openrouter API:", error);
    throw new Error("ai_provider_error");
  }
}

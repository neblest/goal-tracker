/**
 * AI Summary API Client
 *
 * Client functions for interacting with AI summary endpoints.
 */

import { apiFetchJson } from "./apiFetchJson";
import type { GenerateAiSummaryResponseDto, UpdateAiSummaryResponseDto } from "@/types";

/**
 * Generates AI summary for a completed goal
 *
 * @param goalId - UUID of the goal
 * @param force - If true, regenerates summary even if it exists
 * @returns Generated summary (includes next goal suggestion with justification)
 * @throws ApiError with specific status codes:
 *   - 400: Invalid goal ID format
 *   - 401: Not authenticated
 *   - 404: Goal not found
 *   - 409: Invalid goal state (active or abandoned)
 *   - 412: Not enough data (less than 3 progress entries)
 *   - 422: Validation error
 *   - 429: Rate limited (too many requests)
 *   - 500: Internal server error
 *   - 502: AI provider error
 */
export async function generateAiSummary(goalId: string, force = false): Promise<GenerateAiSummaryResponseDto> {
  return apiFetchJson<GenerateAiSummaryResponseDto>(`/api/goals/${goalId}/ai-summary/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ force }),
  });
}

/**
 * Updates (edits) the AI summary for a goal
 *
 * @param goalId - UUID of the goal
 * @param aiSummary - New summary text (1-5000 characters)
 * @returns Updated goal with new summary
 * @throws ApiError with specific status codes:
 *   - 400: Invalid goal ID format
 *   - 401: Not authenticated
 *   - 404: Goal not found
 *   - 422: Validation error (empty or too long)
 *   - 500: Internal server error
 */
export async function updateAiSummary(goalId: string, aiSummary: string): Promise<UpdateAiSummaryResponseDto> {
  return apiFetchJson<UpdateAiSummaryResponseDto>(`/api/goals/${goalId}/ai-summary`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ai_summary: aiSummary }),
  });
}

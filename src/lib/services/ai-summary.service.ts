import type { SupabaseClient } from "../../db/supabase.client";
import type {
  GenerateAiSummaryCommand,
  AiSummaryNextGoalSuggestionDto,
  GoalPublicFieldsDto,
  DbGoalRow,
} from "../../types";
import { generateChatCompletion } from "./openrouter.client";

/**
 * Result of AI summary generation
 */
interface GenerateAiSummaryResult {
  goal: Pick<GoalPublicFieldsDto, "id"> & {
    ai_summary: NonNullable<DbGoalRow["ai_summary"]>;
  };
  suggestions: {
    next_goal: AiSummaryNextGoalSuggestionDto;
  };
}

/**
 * Parsed AI response structure
 */
interface AiResponseJson {
  summary: string;
  next_goal: {
    name: string;
    target_value: string;
    deadline_hint_days: number;
  };
}

/**
 * Goal data needed for AI prompt
 */
interface GoalForPrompt {
  name: string;
  target_value: number;
  deadline: string;
  status: string;
}

/**
 * Progress entry for AI context
 */
interface ProgressEntryForPrompt {
  value: number;
  notes: string | null;
  created_at: string;
}

/**
 * Builds the AI prompt for goal summary generation
 *
 * @param goal - Goal data
 * @param progressEntries - Progress entries for context
 * @param totalProgress - Sum of all progress values
 * @returns Array of messages for the AI chat completion
 */
function buildAiPrompt(
  goal: GoalForPrompt,
  progressEntries: ProgressEntryForPrompt[],
  totalProgress: number
): { role: "system" | "user"; content: string }[] {
  const isSuccess = goal.status === "completed_success";

  const systemMessage = `You are an AI assistant that analyzes goal progress and provides constructive feedback.

Your task:
1. Provide a brief summary (2-3 paragraphs) of the user's journey toward this goal
2. Highlight what went well and areas for improvement
3. Suggest a next goal that builds on this experience

Respond in JSON format:
{
  "summary": "Your summary here...",
  "next_goal": {
    "name": "Suggested goal name",
    "target_value": "number as string",
    "deadline_hint_days": number
  }
}`;

  const progressEntriesText = progressEntries
    .map((e) => {
      const date = new Date(e.created_at).toLocaleDateString();
      const notes = e.notes ? ` (${e.notes})` : "";
      return `- ${date}: ${e.value}${notes}`;
    })
    .join("\n");

  const userMessage = `## Goal Information
- Name: ${goal.name}
- Target: ${goal.target_value}
- Deadline: ${goal.deadline}
- Final Status: ${isSuccess ? "Successfully completed" : "Not completed (deadline passed)"}
- Total Progress: ${totalProgress} / ${goal.target_value}

## Progress Entries
${progressEntriesText}

## Your Task
Analyze this goal and provide:
1. A brief summary (2-3 paragraphs) of the user's journey
2. What went well and areas for improvement
3. A suggested next goal that builds on this experience`;

  return [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage },
  ];
}

/**
 * Parses AI response JSON and validates the structure
 *
 * @param responseContent - Raw AI response string
 * @returns Parsed and validated AI response
 * @throws Error with code "ai_provider_error" if parsing fails or structure is invalid
 */
function parseAiResponse(responseContent: string): AiResponseJson {
  try {
    const parsed = JSON.parse(responseContent) as AiResponseJson;

    // Validate required fields
    if (
      !parsed.summary ||
      typeof parsed.summary !== "string" ||
      !parsed.next_goal ||
      !parsed.next_goal.name ||
      !parsed.next_goal.target_value ||
      typeof parsed.next_goal.deadline_hint_days !== "number"
    ) {
      // eslint-disable-next-line no-console
      console.error("Invalid AI response structure:", parsed);
      throw new Error("ai_provider_error");
    }

    return parsed;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to parse AI response:", error);
    throw new Error("ai_provider_error");
  }
}

/**
 * Generates an AI summary for a completed goal
 *
 * Business rules:
 * - Goal must exist and belong to the user
 * - Goal must be in 'completed_success' or 'completed_failure' status
 * - Goal must have at least 3 progress entries
 * - If ai_summary already exists and force !== true, returns existing summary
 * - Calls Openrouter API to generate summary and next goal suggestion
 * - Saves ai_summary to database
 *
 * @param supabase - Supabase client instance
 * @param userId - Authenticated user's ID
 * @param goalId - Goal UUID to generate summary for
 * @param command - GenerateAiSummaryCommand with optional force flag
 * @returns Generated summary and suggestions
 * @throws Error with specific code for proper HTTP error mapping:
 *   - "goal_not_found": Goal doesn't exist or user lacks access (404)
 *   - "invalid_goal_state": Goal is not completed (active or abandoned) (409)
 *   - "not_enough_data": Less than 3 progress entries (412)
 *   - "ai_provider_error": AI API error or invalid response (502)
 *   - "ai_provider_timeout": AI API timeout (502)
 *   - "database_error": Database operation failed (500)
 */
export async function generateAiSummary(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  command: GenerateAiSummaryCommand
): Promise<GenerateAiSummaryResult> {
  // Step 1: Fetch the goal
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, name, target_value, deadline, status, ai_summary")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal for AI summary:", goalError);
    throw new Error("database_error");
  }

  if (!goal) {
    throw new Error("goal_not_found");
  }

  // Step 2: Validate goal status
  if (goal.status === "active") {
    throw new Error("invalid_goal_state");
  }

  if (goal.status === "abandoned") {
    throw new Error("invalid_goal_state");
  }

  // Step 3: Check if ai_summary already exists and force !== true
  if (goal.ai_summary && !command.force) {
    // Return existing summary without regeneration
    // Note: We don't have the original next_goal suggestion, so we'll create a default one
    return {
      goal: {
        id: goal.id,
        ai_summary: goal.ai_summary,
      },
      suggestions: {
        next_goal: {
          name: goal.name,
          target_value: goal.target_value.toString(),
          deadline_hint_days: 30,
        },
      },
    };
  }

  // Step 4: Count progress entries
  const { count, error: countError } = await supabase
    .from("goal_progress")
    .select("*", { count: "exact", head: true })
    .eq("goal_id", goalId);

  if (countError) {
    // eslint-disable-next-line no-console
    console.error("Error counting progress entries:", countError);
    throw new Error("database_error");
  }

  if (count === null || count < 3) {
    throw new Error("not_enough_data");
  }

  // Step 5: Fetch progress entries for AI context
  const { data: progressEntries, error: progressError } = await supabase
    .from("goal_progress")
    .select("value, notes, created_at")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });

  if (progressError || !progressEntries) {
    // eslint-disable-next-line no-console
    console.error("Error fetching progress entries:", progressError);
    throw new Error("database_error");
  }

  // Step 6: Calculate total progress
  const totalProgress = progressEntries.reduce((sum, entry) => sum + Number(entry.value), 0);

  // Step 7: Build AI prompt
  const messages = buildAiPrompt(goal, progressEntries, totalProgress);

  // Step 8: Call Openrouter API
  let aiResponse: string;
  try {
    aiResponse = await generateChatCompletion(messages, {
      responseFormat: "json",
      temperature: 0.7,
      maxTokens: 2000,
    });
  } catch (error) {
    // Re-throw AI provider errors (already properly coded)
    if (error instanceof Error) {
      if (
        error.message === "ai_provider_error" ||
        error.message === "ai_provider_timeout" ||
        error.message === "missing_api_key"
      ) {
        throw error;
      }
    }
    // Unexpected error
    // eslint-disable-next-line no-console
    console.error("Unexpected error during AI generation:", error);
    throw new Error("ai_provider_error");
  }

  // Step 9: Parse AI response
  const parsedResponse = parseAiResponse(aiResponse);

  // Step 10: Save ai_summary to database
  const { error: updateError } = await supabase
    .from("goals")
    .update({ ai_summary: parsedResponse.summary })
    .eq("id", goalId)
    .eq("user_id", userId);

  if (updateError) {
    // eslint-disable-next-line no-console
    console.error("Error saving AI summary to database:", updateError);
    throw new Error("database_error");
  }

  // Step 11: Return result
  return {
    goal: {
      id: goal.id,
      ai_summary: parsedResponse.summary,
    },
    suggestions: {
      next_goal: {
        name: parsedResponse.next_goal.name,
        target_value: parsedResponse.next_goal.target_value,
        deadline_hint_days: parsedResponse.next_goal.deadline_hint_days,
      },
    },
  };
}

/**
 * Updates the AI summary for a goal
 *
 * Business rules:
 * - Goal must exist and belong to the user
 * - Allows manual editing of ai_summary field
 *
 * @param supabase - Supabase client instance
 * @param userId - Authenticated user's ID
 * @param goalId - Goal UUID to update
 * @param aiSummary - New AI summary text
 * @returns Updated goal with id and ai_summary
 * @throws Error with specific code for proper HTTP error mapping:
 *   - "goal_not_found": Goal doesn't exist or user lacks access (404)
 *   - "database_error": Database operation failed (500)
 */
export async function updateAiSummary(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  aiSummary: string
): Promise<Pick<GoalPublicFieldsDto, "id" | "ai_summary">> {
  // Step 1: Check if goal exists and belongs to user
  const { data: goal, error: checkError } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (checkError) {
    // eslint-disable-next-line no-console
    console.error("Error checking goal existence:", checkError);
    throw new Error("database_error");
  }

  if (!goal) {
    throw new Error("goal_not_found");
  }

  // Step 2: Update ai_summary
  const { data: updatedGoal, error: updateError } = await supabase
    .from("goals")
    .update({ ai_summary: aiSummary })
    .eq("id", goalId)
    .eq("user_id", userId)
    .select("id, ai_summary")
    .single();

  if (updateError || !updatedGoal) {
    // eslint-disable-next-line no-console
    console.error("Error updating AI summary:", updateError);
    throw new Error("database_error");
  }

  return {
    id: updatedGoal.id,
    ai_summary: updatedGoal.ai_summary,
  };
}

import type { SupabaseClient } from "../../db/supabase.client";
import type { GenerateAiSummaryCommand, GoalPublicFieldsDto, DbGoalRow } from "../../types";
import { generateChatCompletion } from "./openrouter.client";

/**
 * Result of AI summary generation
 */
interface GenerateAiSummaryResult {
  goal: Pick<GoalPublicFieldsDto, "id"> & {
    ai_summary: NonNullable<DbGoalRow["ai_summary"]>;
  };
}

/**
 * Parsed AI response structure
 */
interface AiResponseJson {
  summary: string;
}

/**
 * Goal data needed for AI prompt
 */
interface GoalForPrompt {
  name: string;
  target_value: number;
  deadline: string;
  status: string;
  reflection_notes: string | null;
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
 * Historical goal context for AI
 */
interface HistoricalGoalContext {
  name: string;
  target_value: number;
  status: string;
  reflection_notes: string | null;
  progress_entries: ProgressEntryForPrompt[];
}

/**
 * Builds the AI prompt for goal summary generation
 *
 * @param goal - Goal data
 * @param progressEntries - Progress entries for context
 * @param totalProgress - Sum of all progress values
 * @param historicalGoals - Up to 3 newest previous goals for context
 * @returns Array of messages for the AI chat completion
 */
function buildAiPrompt(
  goal: GoalForPrompt,
  progressEntries: ProgressEntryForPrompt[],
  totalProgress: number,
  historicalGoals: HistoricalGoalContext[]
): { role: "system" | "user"; content: string }[] {
  const isSuccess = goal.status === "completed_success";
  const isAbandoned = goal.status === "abandoned";

  const progressEntriesText = progressEntries
    .map((e) => {
      const date = new Date(e.created_at).toLocaleDateString();
      const notes = e.notes ? ` (${e.notes})` : "";
      return `- ${date}: ${e.value}${notes}`;
    })
    .join("\n");

  // Build historical goals context
  let historicalContext = "";
  if (historicalGoals.length > 0) {
    historicalContext = "\n## Previous Goals (for context)\n";
    historicalGoals.forEach((hGoal, index) => {
      const totalHistoricalProgress = hGoal.progress_entries.reduce((sum, entry) => sum + Number(entry.value), 0);

      historicalContext += `\n### Goal ${index + 1}: ${hGoal.name}\n`;
      historicalContext += `- Target: ${hGoal.target_value}\n`;
      historicalContext += `- Status: ${hGoal.status}\n`;
      historicalContext += `- Total Progress: ${totalHistoricalProgress} / ${hGoal.target_value}\n`;

      if (hGoal.reflection_notes) {
        historicalContext += `- Reflection Notes: ${hGoal.reflection_notes}\n`;
      }

      if (hGoal.progress_entries.length > 0) {
        historicalContext += "- Progress Entries:\n";
        hGoal.progress_entries.forEach((entry) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          const notes = entry.notes ? ` (${entry.notes})` : "";
          historicalContext += `  - ${date}: ${entry.value}${notes}\n`;
        });
      }
    });
  }

  let reflectionNotesSection = "";
  if (goal.reflection_notes) {
    reflectionNotesSection = `\n## Reflection Notes\n${goal.reflection_notes}\n`;
  }

  const userMessage = `You are an AI assistant that analyzes goal progress and provides constructive feedback.

Your task:
1. Provide a comprehensive summary (3-4 paragraphs) of the person's journey toward this goal, written in second-person (addressing them as "you")
2. Highlight what went well and areas for improvement
3. Include a suggestion for a next goal at the end of the summary with clear justification for why this next goal makes sense based on their journey and patterns

You will receive:
- The current goal being analyzed with its progress entries
- Up to 3 previous goals with their reflection notes and progress entries for context

Important instructions:
- Write in second-person perspective (use "you" and "your" instead of "the user")
- Respond in the SAME LANGUAGE as the goal information and progress notes provided by the user
- Make it conversational and personal
- Use insights from previous goals to identify patterns and provide more personalized recommendations
- The next goal suggestion should be embedded naturally within the summary text, not as a separate field
- Explain WHY the suggested next goal is appropriate based on their history, patterns, and progress

Respond in JSON format:
{
  "summary": "Your complete summary here, including the next goal suggestion with justification at the end..."
}

---

## Current Goal Being Analyzed
- Name: ${goal.name}
- Target: ${goal.target_value}
- Deadline: ${goal.deadline}
- Final Status: ${isAbandoned ? "Abandoned" : isSuccess ? "Successfully completed" : "Not completed (deadline passed)"}
- Total Progress: ${totalProgress} / ${goal.target_value}
${reflectionNotesSection}
## Progress Entries
${progressEntriesText}
${historicalContext}
## Your Task
Analyze this goal and provide:
1. A comprehensive summary (3-4 paragraphs) of their journey, written directly to them using "you" and "your"
2. Highlight what went well and areas for improvement
3. A suggested next goal embedded naturally at the end of the summary with clear justification

Remember:
- Write in the same language as the goal name and progress notes above
- Address the person directly using second-person perspective
- Use the previous goals context to provide more personalized insights about their goal-setting patterns and progress
- Include the next goal suggestion within the summary text itself, explaining WHY it's a good next step based on their history and patterns`;

  return [{ role: "user", content: userMessage }];
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
    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    let cleanedContent = responseContent.trim();

    // Remove opening code fence
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.slice(7); // Remove ```json
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.slice(3); // Remove ```
    }

    // Remove closing code fence
    if (cleanedContent.endsWith("```")) {
      cleanedContent = cleanedContent.slice(0, -3); // Remove ```
    }

    cleanedContent = cleanedContent.trim();

    const parsed = JSON.parse(cleanedContent) as AiResponseJson;

    // Validate required fields
    if (!parsed.summary || typeof parsed.summary !== "string") {
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
 * Generates an AI summary for a completed or abandoned goal
 *
 * Business rules:
 * - Goal must exist and belong to the user
 * - Goal must be in 'completed_success', 'completed_failure', or 'abandoned' status
 * - Goal must have at least 3 progress entries
 * - If ai_summary already exists and force !== true, returns existing summary
 * - Fetches up to 3 newest previous goals with their reflection notes and progress for context
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
 *   - "invalid_goal_state": Goal is still active (409)
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
    .select("id, name, target_value, deadline, status, ai_summary, reflection_notes")
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

  // Step 2: Validate goal status (only active goals cannot generate summaries)
  if (goal.status === "active") {
    throw new Error("invalid_goal_state");
  }

  // Step 3: Check if ai_summary already exists and force !== true
  if (goal.ai_summary && !command.force) {
    // Return existing summary without regeneration
    return {
      goal: {
        id: goal.id,
        ai_summary: goal.ai_summary,
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

  // Step 7: Fetch up to 3 newest goals for context (excluding current goal)
  const { data: historicalGoalsData, error: historicalGoalsError } = await supabase
    .from("goals")
    .select("id, name, target_value, status, reflection_notes, created_at")
    .eq("user_id", userId)
    .neq("id", goalId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (historicalGoalsError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching historical goals:", historicalGoalsError);
    // Non-critical error, continue without historical context
  }

  // Step 8: Fetch progress entries for historical goals
  const historicalGoals: HistoricalGoalContext[] = [];
  if (historicalGoalsData && historicalGoalsData.length > 0) {
    for (const hGoal of historicalGoalsData) {
      const { data: hProgressEntries, error: hProgressError } = await supabase
        .from("goal_progress")
        .select("value, notes, created_at")
        .eq("goal_id", hGoal.id)
        .order("created_at", { ascending: true });

      if (hProgressError) {
        // eslint-disable-next-line no-console
        console.error(`Error fetching progress for goal ${hGoal.id}:`, hProgressError);
        // Continue with empty progress entries
      }

      historicalGoals.push({
        name: hGoal.name,
        target_value: hGoal.target_value,
        status: hGoal.status,
        reflection_notes: hGoal.reflection_notes,
        progress_entries: hProgressEntries || [],
      });
    }
  }

  // Step 9: Build AI prompt
  const messages = buildAiPrompt(goal, progressEntries, totalProgress, historicalGoals);

  // Step 10: Call Openrouter API
  let aiResponse: string;
  try {
    aiResponse = await generateChatCompletion(messages, {
      responseFormat: "json",
      temperature: 0.7,
      maxTokens: 5000,
    });
    console.log(aiResponse);
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

  // Step 11: Parse AI response
  const parsedResponse = parseAiResponse(aiResponse);

  // Step 12: Save ai_summary to database
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

  // Step 13: Return result
  return {
    goal: {
      id: goal.id,
      ai_summary: parsedResponse.summary,
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

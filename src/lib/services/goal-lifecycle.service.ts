import type { SupabaseClient } from "../../db/supabase.client";
import type {
  AbandonGoalCommand,
  ContinueGoalCommand,
  RetryGoalCommand,
  GoalPublicFieldsDto,
  GoalStatus,
  SyncStatusesCommand,
} from "../../types";
import { generateAiSummary } from "./ai-summary.service";

/**
 * Result of syncing a single goal's status
 */
interface StatusTransition {
  id: string;
  from: GoalStatus;
  to: GoalStatus;
}

/**
 * Result of syncStatuses operation
 */
interface SyncStatusesResult {
  updated: StatusTransition[];
}

/**
 * Validates iteration chain constraints before creating a new goal iteration
 *
 * Business rules:
 * - Only one active goal can exist in an iteration chain at a time
 * - Retry/continue can only be performed from the youngest goal (most recent created_at)
 *
 * @param supabase - Supabase client instance
 * @param goalId - Goal ID to validate
 * @returns void if validation passes
 * @throws Error with specific code:
 *   - "active_goal_exists": An active goal already exists in the iteration chain (409)
 *   - "goal_not_youngest": The goal is not the youngest in the iteration chain (409)
 *   - "database_error": Database operation failed (500)
 */
export async function validateIterationChainForNewGoal(supabase: SupabaseClient, goalId: string): Promise<void> {
  // Step 1: Get all goals in the iteration chain using the RPC function
  const { data: historyData, error: historyError } = await supabase.rpc("get_goal_history", {
    p_goal_id: goalId,
  });

  if (historyError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal history for validation:", historyError);
    throw new Error("database_error");
  }

  if (!historyData || historyData.length === 0) {
    // If no history found, validation passes (shouldn't happen for existing goals)
    return;
  }

  // Step 2: Check if any goal in the chain is active
  const hasActiveGoal = historyData.some((goal: { status: GoalStatus }) => goal.status === "active");

  if (hasActiveGoal) {
    throw new Error("active_goal_exists");
  }

  // Step 3: Check if the current goal is the youngest (most recent created_at)
  // History is sorted by created_at ascending, so the last item is the youngest
  const youngestGoal = historyData[historyData.length - 1];

  if (youngestGoal.id !== goalId) {
    throw new Error("goal_not_youngest");
  }
}

/**
 * Abandons an active goal with a reason
 *
 * Business rules:
 * - Goal must exist and belong to the user
 * - Goal must be in 'active' status
 * - Sets status to 'abandoned' and stores the abandonment reason
 *
 * @param supabase - Supabase client instance
 * @param userId - Authenticated user's ID
 * @param goalId - Goal UUID to abandon
 * @param command - AbandonGoalCommand with reason
 * @returns Goal data with id, status, and abandonment_reason
 * @throws Error with specific code for proper HTTP error mapping:
 *   - "goal_not_found": Goal doesn't exist or user lacks access (404)
 *   - "goal_not_active": Goal is not in active status (409)
 *   - "database_error": Database operation failed (500)
 */
export async function abandonGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  command: AbandonGoalCommand
): Promise<Pick<GoalPublicFieldsDto, "id" | "status" | "abandonment_reason">> {
  // Step 1: Fetch the goal to verify ownership and current status
  const { data: goal, error: fetchError } = await supabase
    .from("goals")
    .select("id, status")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal for abandon:", fetchError);
    throw new Error("database_error");
  }

  if (!goal) {
    throw new Error("goal_not_found");
  }

  // Step 2: Verify goal is in active status
  if (goal.status !== "active") {
    throw new Error("goal_not_active");
  }

  // Step 3: Update goal to abandoned status with reason
  const { data: updatedGoal, error: updateError } = await supabase
    .from("goals")
    .update({
      status: "abandoned",
      abandonment_reason: command.reason,
    })
    .eq("id", goalId)
    .eq("user_id", userId)
    .select("id, status, abandonment_reason")
    .single();

  if (updateError || !updatedGoal) {
    // eslint-disable-next-line no-console
    console.error("Error updating goal to abandoned:", updateError);
    throw new Error("database_error");
  }

  return {
    id: updatedGoal.id,
    status: updatedGoal.status,
    abandonment_reason: updatedGoal.abandonment_reason,
  };
}

/**
 * Creates a new goal as continuation after completing a goal successfully
 *
 * Business rules:
 * - Source goal must exist and belong to the user
 * - Source goal must be in 'completed_success' status
 * - Source goal must be the youngest in its iteration chain
 * - No active goal can exist in the iteration chain
 * - Creates new goal with status 'active' and parent_goal_id set to source goal
 * - Name, target_value, and deadline are taken from the command
 *
 * @param supabase - Supabase client instance
 * @param userId - Authenticated user's ID
 * @param goalId - Source goal UUID (must be completed_success)
 * @param command - ContinueGoalCommand with name, target_value, deadline
 * @returns New goal data with id, parent_goal_id, and status
 * @throws Error with specific code for proper HTTP error mapping:
 *   - "goal_not_found": Goal doesn't exist or user lacks access (404)
 *   - "goal_not_continuable": Goal is not in completed_success status (409)
 *   - "active_goal_exists": An active goal already exists in the iteration chain (409)
 *   - "goal_not_youngest": Goal is not the youngest in the iteration chain (409)
 *   - "database_error": Database operation failed (500)
 */
export async function continueGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  command: ContinueGoalCommand
): Promise<Pick<GoalPublicFieldsDto, "id" | "parent_goal_id" | "status">> {
  // Step 1: Fetch the source goal to verify ownership and status
  const { data: sourceGoal, error: fetchError } = await supabase
    .from("goals")
    .select("id, status")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching source goal for continue:", fetchError);
    throw new Error("database_error");
  }

  if (!sourceGoal) {
    throw new Error("goal_not_found");
  }

  // Step 2: Verify source goal is in completed_success status
  if (sourceGoal.status !== "completed_success") {
    throw new Error("goal_not_continuable");
  }

  // Step 3: Validate iteration chain constraints
  await validateIterationChainForNewGoal(supabase, goalId);

  // Step 4: Create new goal as continuation
  const { data: newGoal, error: insertError } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      parent_goal_id: sourceGoal.id,
      name: command.name,
      target_value: parseFloat(command.target_value),
      deadline: command.deadline,
      status: "active",
    })
    .select("id, parent_goal_id, status")
    .single();

  if (insertError || !newGoal) {
    // eslint-disable-next-line no-console
    console.error("Error creating continuation goal:", insertError);
    throw new Error("database_error");
  }

  return {
    id: newGoal.id,
    parent_goal_id: newGoal.parent_goal_id,
    status: newGoal.status,
  };
}

/**
 * Creates a new goal as retry after a failed or abandoned goal
 *
 * Business rules:
 * - Source goal must exist and belong to the user
 * - Source goal must be in 'completed_failure' or 'abandoned' status
 * - Source goal must be the youngest in its iteration chain
 * - No active goal can exist in the iteration chain
 * - Creates new goal with status 'active' and parent_goal_id set to source goal
 * - Name is copied from source goal by default, unless overridden in command
 * - target_value and deadline are taken from the command
 *
 * @param supabase - Supabase client instance
 * @param userId - Authenticated user's ID
 * @param goalId - Source goal UUID (must be completed_failure or abandoned)
 * @param command - RetryGoalCommand with target_value, deadline, and optional name
 * @returns New goal data with id, parent_goal_id, and status
 * @throws Error with specific code for proper HTTP error mapping:
 *   - "goal_not_found": Goal doesn't exist or user lacks access (404)
 *   - "goal_not_retryable": Goal is not in completed_failure or abandoned status (409)
 *   - "active_goal_exists": An active goal already exists in the iteration chain (409)
 *   - "goal_not_youngest": Goal is not the youngest in the iteration chain (409)
 *   - "database_error": Database operation failed (500)
 */
export async function retryGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  command: RetryGoalCommand
): Promise<Pick<GoalPublicFieldsDto, "id" | "parent_goal_id" | "status">> {
  // Step 1: Fetch the source goal to verify ownership, status, and name
  const { data: sourceGoal, error: fetchError } = await supabase
    .from("goals")
    .select("id, status, name")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching source goal for retry:", fetchError);
    throw new Error("database_error");
  }

  if (!sourceGoal) {
    throw new Error("goal_not_found");
  }

  // Step 2: Verify source goal is in completed_failure or abandoned status
  if (sourceGoal.status !== "completed_failure" && sourceGoal.status !== "abandoned") {
    throw new Error("goal_not_retryable");
  }

  // Step 3: Validate iteration chain constraints
  await validateIterationChainForNewGoal(supabase, goalId);

  // Step 4: Determine the name for the new goal (use command.name if provided, otherwise copy from source)
  const newName = command.name ?? sourceGoal.name;

  // Step 5: Create new goal as retry
  const { data: newGoal, error: insertError } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      parent_goal_id: sourceGoal.id,
      name: newName,
      target_value: parseFloat(command.target_value),
      deadline: command.deadline,
      status: "active",
    })
    .select("id, parent_goal_id, status")
    .single();

  if (insertError || !newGoal) {
    // eslint-disable-next-line no-console
    console.error("Error creating retry goal:", insertError);
    throw new Error("database_error");
  }

  return {
    id: newGoal.id,
    parent_goal_id: newGoal.parent_goal_id,
    status: newGoal.status,
  };
}

/**
 * Manually completes an active goal with success status
 *
 * Business rules:
 * - Goal must exist and belong to the user
 * - Goal must be in 'active' status
 * - Current value (sum of progress entries) must be >= target value
 * - Sets status to 'completed_success'
 * - AI summary generation is triggered if conditions are met (≥3 progress entries)
 *
 * @param supabase - Supabase client instance
 * @param userId - Authenticated user's ID
 * @param goalId - Goal UUID to complete
 * @returns Goal data with id, status, ai_summary, and ai_generation_attempts
 * @throws Error with specific code for proper HTTP error mapping:
 *   - "goal_not_found": Goal doesn't exist or user lacks access (404)
 *   - "goal_not_active": Goal is not in active status (409)
 *   - "target_not_reached": Current value is less than target value (409)
 *   - "database_error": Database operation failed (500)
 */
export async function completeGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string
): Promise<Pick<GoalPublicFieldsDto, "id" | "status" | "ai_summary" | "ai_generation_attempts">> {
  // Step 1: Fetch the goal to verify ownership and current status
  const { data: goal, error: fetchError } = await supabase
    .from("goals")
    .select("id, status, target_value")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal for completion:", fetchError);
    throw new Error("database_error");
  }

  if (!goal) {
    throw new Error("goal_not_found");
  }

  // Step 2: Verify goal is in active status
  if (goal.status !== "active") {
    throw new Error("goal_not_active");
  }

  // Step 3: Calculate current value from progress entries
  const { data: progressEntries, error: progressError } = await supabase
    .from("goal_progress")
    .select("value")
    .eq("goal_id", goalId);

  if (progressError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching progress for completion:", progressError);
    throw new Error("database_error");
  }

  const currentValue = progressEntries ? progressEntries.reduce((sum, entry) => sum + Number(entry.value), 0) : 0;

  // Step 4: Verify target value has been reached
  if (currentValue < goal.target_value) {
    throw new Error("target_not_reached");
  }

  // Step 5: Update goal to completed_success status
  const { data: updatedGoal, error: updateError } = await supabase
    .from("goals")
    .update({
      status: "completed_success",
    })
    .eq("id", goalId)
    .eq("user_id", userId)
    .select("id, status, ai_summary, ai_generation_attempts")
    .single();

  if (updateError || !updatedGoal) {
    // eslint-disable-next-line no-console
    console.error("Error updating goal to completed_success:", updateError);
    throw new Error("database_error");
  }

  // Step 6: Attempt to auto-generate AI summary
  // Note: This runs after goal status is updated
  // Errors are logged but do not affect the completion response
  await tryGenerateAiSummary(supabase, userId, goalId);

  // Refetch goal to get potentially updated ai_summary
  const { data: finalGoal, error: finalFetchError } = await supabase
    .from("goals")
    .select("id, status, ai_summary, ai_generation_attempts")
    .eq("id", goalId)
    .eq("user_id", userId)
    .single();

  if (finalFetchError || !finalGoal) {
    // Fallback to previously fetched data if final fetch fails
    return {
      id: updatedGoal.id,
      status: updatedGoal.status,
      ai_summary: updatedGoal.ai_summary,
      ai_generation_attempts: updatedGoal.ai_generation_attempts,
    };
  }

  return {
    id: finalGoal.id,
    status: finalGoal.status,
    ai_summary: finalGoal.ai_summary,
    ai_generation_attempts: finalGoal.ai_generation_attempts,
  };
}

/**
 * Attempts to auto-generate AI summary for a completed goal
 *
 * This function is called automatically when a goal transitions to
 * completed_success or completed_failure status.
 *
 * Preconditions checked before calling AI API:
 * - ai_summary must not already exist
 * - entries_count must be >= 3
 *
 * Error handling:
 * - Fails silently - logs errors but never throws
 * - Goal completion succeeds regardless of AI generation outcome
 *
 * @param supabase - Supabase client instance
 * @param userId - User ID who owns the goal
 * @param goalId - Goal UUID that was just completed/failed
 * @returns void - never throws errors
 */
async function tryGenerateAiSummary(supabase: SupabaseClient, userId: string, goalId: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[AI Auto-Gen] Starting AI summary generation for goal ${goalId}`);

  // Step 1: Fetch goal data with ai_summary
  const { data: goal, error: fetchError } = await supabase
    .from("goals")
    .select("id, ai_summary")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    // eslint-disable-next-line no-console
    console.error(`[AI Auto-Gen] Failed to fetch goal ${goalId}:`, fetchError);
    return;
  }

  if (!goal) {
    // eslint-disable-next-line no-console
    console.error(`[AI Auto-Gen] Goal ${goalId} not found`);
    return;
  }

  // Step 2: Early exit if ai_summary already exists
  if (goal.ai_summary) {
    // eslint-disable-next-line no-console
    console.log(`[AI Auto-Gen] Goal ${goalId} already has AI summary, skipping`);
    return;
  }

  // Step 3: Count progress entries
  const { count, error: countError } = await supabase
    .from("goal_progress")
    .select("*", { count: "exact", head: true })
    .eq("goal_id", goalId);

  if (countError) {
    // eslint-disable-next-line no-console
    console.error(`[AI Auto-Gen] Failed to count progress entries for goal ${goalId}:`, countError);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[AI Auto-Gen] Goal ${goalId} has ${count} progress entries`);

  // Step 4: Early exit if not enough progress entries
  if (count === null || count < 3) {
    // eslint-disable-next-line no-console
    console.log(`[AI Auto-Gen] Goal ${goalId} has insufficient entries (${count}), skipping`);
    return;
  }

  // Step 5: Call AI summary service
  // eslint-disable-next-line no-console
  console.log(`[AI Auto-Gen] Calling generateAiSummary for goal ${goalId}`);

  try {
    await generateAiSummary(supabase, userId, goalId, { force: false });
    // eslint-disable-next-line no-console
    console.log(`[AI Auto-Gen] Successfully generated AI summary for goal ${goalId}`);
  } catch (error) {
    // Log error but don't throw - goal completion must succeed
    // eslint-disable-next-line no-console
    console.error(`[AI Auto-Gen] Failed to auto-generate AI summary for goal ${goalId}:`, error);
    if (error instanceof Error) {
      // eslint-disable-next-line no-console
      console.error(`[AI Auto-Gen] Error message: ${error.message}`);
    }
  }
}

/**
 * Helper: Get end of day (23:59:59.999) for a given YYYY-MM-DD date string
 * Uses local timezone of the server process
 */
function getEndOfDeadlineDay(deadlineStr: string): Date {
  // Parse date string as local date (YYYY-MM-DD format)
  // Using Date constructor with separate components ensures local timezone interpretation
  const [year, month, day] = deadlineStr.split("-").map(Number);
  // Month is 0-indexed in Date constructor
  const deadline = new Date(year, month - 1, day, 23, 59, 59, 999);
  return deadline;
}

/**
 * Determines the new status for a goal based on business rules
 *
 * Rules:
 * - If current_value >= target_value → completed_success
 * - If now is after deadline end (23:59:59) AND current_value < target_value → completed_failure
 * - If status is abandoned → never change
 * - Otherwise → keep current status
 *
 * @returns New status if transition should occur, or null if no change needed
 */
function determineNewStatus(
  currentStatus: GoalStatus,
  currentValue: number,
  targetValue: number,
  deadline: string
): GoalStatus | null {
  // Rule: Never auto-change abandoned goals
  if (currentStatus === "abandoned") {
    return null;
  }

  // Rule: Don't change already completed goals (idempotency)
  if (currentStatus === "completed_success" || currentStatus === "completed_failure") {
    return null;
  }

  // Note: Success is no longer applied automatically when target is reached.
  // Manual completion is required by the user per updated product requirements.
  // Therefore we do NOT transition to "completed_success" here.

  // Rule: Failure if deadline passed and target not reached
  const now = new Date();
  const endOfDeadline = getEndOfDeadlineDay(deadline);

  if (now > endOfDeadline && currentValue < targetValue) {
    return "completed_failure";
  }

  // No transition needed
  return null;
}

/**
 * Applies automatic status transitions for user's goals
 *
 * Business logic:
 * - Fetches active goals for the user (optionally filtered by goal_ids)
 * - Calculates current_value for each goal (sum of goal_progress.value)
 * - Applies status transition rules
 * - Updates only goals that require status change (idempotent)
 *
 * @param supabase - Supabase client from context.locals
 * @param userId - ID of authenticated user
 * @param command - Optional filters (goal_ids to limit scope)
 * @returns List of goals that were updated with before/after statuses
 * @throws Error with message 'database_error' on database failures
 */
export async function syncStatuses(
  supabase: SupabaseClient,
  userId: string,
  command: SyncStatusesCommand
): Promise<SyncStatusesResult> {
  // Step A: Build query to fetch goals that might need status updates
  let goalsQuery = supabase
    .from("goals")
    .select("id, status, target_value, deadline")
    .eq("user_id", userId)
    // Only fetch active goals (abandoned and completed don't need auto-updates)
    .eq("status", "active");

  // Apply optional goal_ids filter
  if (command.goal_ids && command.goal_ids.length > 0) {
    goalsQuery = goalsQuery.in("id", command.goal_ids);
  }

  const { data: goals, error: goalsError } = await goalsQuery;

  if (goalsError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goals for sync:", goalsError);
    throw new Error("database_error");
  }

  // No goals to process
  if (!goals || goals.length === 0) {
    return { updated: [] };
  }

  // Step B: Fetch progress data for all goals in scope
  const goalIds = goals.map((g) => g.id);
  const { data: progressEntries, error: progressError } = await supabase
    .from("goal_progress")
    .select("goal_id, value")
    .in("goal_id", goalIds);

  if (progressError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching progress for sync:", progressError);
    throw new Error("database_error");
  }

  // Aggregate progress by goal_id
  const progressByGoalId = new Map<string, number>();
  for (const entry of progressEntries || []) {
    const currentSum = progressByGoalId.get(entry.goal_id) || 0;
    progressByGoalId.set(entry.goal_id, currentSum + Number(entry.value));
  }

  // Step C: Determine which goals need status updates
  const updates: StatusTransition[] = [];

  for (const goal of goals) {
    const currentValue = progressByGoalId.get(goal.id) || 0;
    const newStatus = determineNewStatus(goal.status, currentValue, goal.target_value, goal.deadline);

    if (newStatus && newStatus !== goal.status) {
      updates.push({
        id: goal.id,
        from: goal.status,
        to: newStatus,
      });
    }
  }

  // Step D: Apply updates (batch update for efficiency)
  if (updates.length === 0) {
    return { updated: [] };
  }

  // Supabase doesn't support batch updates with different values per row easily,
  // so we'll do individual updates. For MVP this is acceptable for ~200 goals max.
  // Future optimization: use a single SQL function or stored procedure.
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("goals")
      .update({ status: update.to })
      .eq("id", update.id)
      .eq("user_id", userId); // Defense-in-depth: ensure we only update user's goals

    if (updateError) {
      // eslint-disable-next-line no-console
      console.error(`Error updating goal ${update.id} status:`, updateError);
      throw new Error("database_error");
    }
  }

  // Step E: Auto-generate AI summaries for goals that transitioned to completed_failure
  // Note: Only failed goals can be auto-transitioned by syncStatuses (success requires manual)
  // Run sequentially to avoid rate limiting and reduce server load
  for (const update of updates) {
    if (update.to === "completed_failure") {
      await tryGenerateAiSummary(supabase, userId, update.id);
    }
  }

  return { updated: updates };
}

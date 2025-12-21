import type { SupabaseClient } from "../../db/supabase.client";
import type {
  AbandonGoalCommand,
  ContinueGoalCommand,
  RetryGoalCommand,
  GoalPublicFieldsDto,
  GoalStatus,
  SyncStatusesCommand,
} from "../../types";

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

  // Step 3: Create new goal as continuation
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

  // Step 3: Determine the name for the new goal (use command.name if provided, otherwise copy from source)
  const newName = command.name ?? sourceGoal.name;

  // Step 4: Create new goal as retry
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
 * Helper: Get end of day (23:59:59.999) for a given YYYY-MM-DD date string
 * Uses local timezone of the server process
 */
function getEndOfDeadlineDay(deadlineStr: string): Date {
  const deadline = new Date(deadlineStr);
  // Set to end of day in local timezone
  deadline.setHours(23, 59, 59, 999);
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

  // Rule: Success if target reached
  if (currentValue >= targetValue) {
    return "completed_success";
  }

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

  return { updated: updates };
}

import type { SupabaseClient } from "../../db/supabase.client";
import type {
  CreateGoalCommand,
  DbGoalRow,
  DecimalString,
  GetGoalsQueryDto,
  OffsetPaginatedDto,
  GoalListItemDto,
  GoalDetailsDto,
  UpdateGoalCommand,
} from "../../types";

/**
 * Validates that a parent goal exists and belongs to the user
 * @throws Error with specific code for 404 responses
 */
export async function assertParentGoalAccessible(
  supabase: SupabaseClient,
  userId: string,
  parentGoalId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("goals")
    .select("id")
    .eq("id", parentGoalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Error checking parent goal:", error);
    throw new Error("database_error");
  }

  if (!data) {
    throw new Error("parent_goal_not_found");
  }
}

/**
 * Creates a new goal in the database
 * @returns Goal data with target_value as DecimalString
 */
export async function createGoal(
  supabase: SupabaseClient,
  userId: string,
  command: CreateGoalCommand
): Promise<{
  id: string;
  status: DbGoalRow["status"];
  name: string;
  target_value: DecimalString;
  deadline: string;
  parent_goal_id: string | null;
}> {
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      parent_goal_id: command.parent_goal_id ?? null,
      name: command.name,
      target_value: parseFloat(command.target_value),
      deadline: command.deadline,
    })
    .select("id, status, name, target_value, deadline, parent_goal_id")
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Error creating goal:", error);
    throw new Error("database_error");
  }

  // Convert target_value from DB (number) to DecimalString for API response
  return {
    id: data.id,
    status: data.status,
    name: data.name,
    target_value: String(data.target_value),
    deadline: data.deadline,
    parent_goal_id: data.parent_goal_id,
  };
}

/**
 * Lists goals for a user with filtering, sorting, and pagination
 * @returns Paginated list of goals with computed fields
 */
export async function listGoals(
  supabase: SupabaseClient,
  userId: string,
  query: GetGoalsQueryDto
): Promise<OffsetPaginatedDto<GoalListItemDto>> {
  // Step A: Build and execute query to fetch goals with total count
  let goalsQuery = supabase
    .from("goals")
    .select(
      "id, parent_goal_id, name, target_value, deadline, status, reflection_notes, ai_summary, abandonment_reason, created_at, updated_at",
      { count: "exact" }
    )
    .eq("user_id", userId);

  // Apply filters
  if (query.status) {
    goalsQuery = goalsQuery.eq("status", query.status);
  }

  if (query.q) {
    goalsQuery = goalsQuery.ilike("name", `%${query.q}%`);
  }

  if (query.parentGoalId) {
    goalsQuery = goalsQuery.eq("parent_goal_id", query.parentGoalId);
  }

  if (query.root) {
    goalsQuery = goalsQuery.is("parent_goal_id", null);
  }

  // Apply sorting
  const sortColumn = query.sort || "created_at";
  const isAscending = query.order === "asc";
  goalsQuery = goalsQuery.order(sortColumn, { ascending: isAscending });

  // Apply pagination
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  goalsQuery = goalsQuery.range(from, to);

  const { data: goals, error: goalsError, count } = await goalsQuery;

  if (goalsError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goals:", goalsError);
    throw new Error("database_error");
  }

  if (!goals || goals.length === 0) {
    return {
      items: [],
      page,
      pageSize,
      total: count || 0,
    };
  }

  // Step B: Fetch goal_progress data for all goals in current page
  const goalIds = goals.map((g) => g.id);
  const { data: progressEntries, error: progressError } = await supabase
    .from("goal_progress")
    .select("goal_id, value")
    .in("goal_id", goalIds);

  if (progressError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal progress:", progressError);
    throw new Error("database_error");
  }

  // Group progress entries by goal_id and compute aggregates
  const progressByGoalId = new Map<string, { currentValue: number; entriesCount: number }>();

  for (const entry of progressEntries || []) {
    const existing = progressByGoalId.get(entry.goal_id) || {
      currentValue: 0,
      entriesCount: 0,
    };
    // Convert decimal to number explicitly
    existing.currentValue += Number(entry.value);
    existing.entriesCount += 1;
    progressByGoalId.set(entry.goal_id, existing);
  }

  // Step C: Build response with computed fields
  const items: GoalListItemDto[] = goals.map((goal) => {
    const progress = progressByGoalId.get(goal.id) || {
      currentValue: 0,
      entriesCount: 0,
    };

    const currentValue = progress.currentValue;
    const targetValue = goal.target_value;
    const progressRatio = targetValue > 0 ? currentValue / targetValue : 0;
    const progressPercent = Math.round(progressRatio * 100);
    const isLocked = progress.entriesCount >= 1;

    // Calculate days_remaining
    const deadlineDate = new Date(goal.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    const daysRemaining = Math.floor((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: goal.id,
      parent_goal_id: goal.parent_goal_id,
      name: goal.name,
      target_value: String(goal.target_value),
      deadline: goal.deadline,
      status: goal.status,
      reflection_notes: goal.reflection_notes,
      ai_summary: goal.ai_summary,
      abandonment_reason: goal.abandonment_reason,
      created_at: goal.created_at,
      updated_at: goal.updated_at,
      computed: {
        current_value: String(currentValue),
        progress_ratio: progressRatio,
        progress_percent: progressPercent,
        is_locked: isLocked,
        days_remaining: daysRemaining,
      },
    };
  });

  return {
    items,
    page,
    pageSize,
    total: count || 0,
  };
}

/**
 * Gets detailed information about a single goal
 * @returns Goal details with computed fields including entries_count
 * @throws Error with code 'goal_not_found' if goal doesn't exist or doesn't belong to user
 * @throws Error with code 'database_error' for database errors
 */
export async function getGoalDetails(
  supabase: SupabaseClient,
  userId: string,
  goalId: string
): Promise<GoalDetailsDto> {
  // Step A: Fetch goal from database
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select(
      "id, parent_goal_id, name, target_value, deadline, status, reflection_notes, ai_summary, abandonment_reason, created_at, updated_at"
    )
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal:", goalError);
    throw new Error("database_error");
  }

  if (!goal) {
    throw new Error("goal_not_found");
  }

  // Step B: Fetch progress entries for this goal
  const { data: progressEntries, error: progressError } = await supabase
    .from("goal_progress")
    .select("value")
    .eq("goal_id", goalId);

  if (progressError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal progress:", progressError);
    throw new Error("database_error");
  }

  // Step C: Calculate aggregates
  const entriesCount = progressEntries?.length || 0;
  const currentValue = progressEntries?.reduce((sum, entry) => sum + entry.value, 0) || 0;

  // Step D: Calculate computed fields
  const targetValue = goal.target_value;
  const progressRatio = targetValue > 0 ? currentValue / targetValue : 0;
  const progressPercent = Math.round(progressRatio * 100);
  const isLocked = entriesCount >= 1;

  // Calculate days_remaining
  const deadlineDate = new Date(goal.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);
  const daysRemaining = Math.floor((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Step E: Build and return DTO
  return {
    id: goal.id,
    parent_goal_id: goal.parent_goal_id,
    name: goal.name,
    target_value: String(goal.target_value),
    deadline: goal.deadline,
    status: goal.status,
    reflection_notes: goal.reflection_notes,
    ai_summary: goal.ai_summary,
    abandonment_reason: goal.abandonment_reason,
    created_at: goal.created_at,
    updated_at: goal.updated_at,
    computed: {
      current_value: String(currentValue),
      progress_ratio: progressRatio,
      progress_percent: progressPercent,
      is_locked: isLocked,
      days_remaining: daysRemaining,
      entries_count: entriesCount,
    },
  };
}

/**
 * Updates editable fields of a goal
 *
 * Business rules:
 * - reflection_notes and ai_summary are always editable
 * - name, target_value, deadline can only be edited when goal is not locked
 *   (i.e., has no progress entries)
 *
 * @param supabase - Supabase client
 * @param userId - User ID from authentication
 * @param goalId - Goal ID to update
 * @param command - Fields to update (at least one required)
 * @returns Updated goal with id and updated_at
 * @throws Error with code 'goal_not_found' if goal doesn't exist or doesn't belong to user
 * @throws Error with code 'goal_locked' if trying to update immutable fields when goal has progress
 * @throws Error with code 'database_error' for database errors
 */
export async function updateGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  command: UpdateGoalCommand
): Promise<{ id: string; updated_at: string }> {
  // Step 1: Fetch current goal to verify ownership and access current values
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, user_id, name, target_value, deadline, updated_at")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal for update:", goalError);
    throw new Error("database_error");
  }

  if (!goal) {
    throw new Error("goal_not_found");
  }

  // Step 2: Check if goal is locked by counting progress entries
  const { count, error: countError } = await supabase
    .from("goal_progress")
    .select("*", { count: "exact", head: true })
    .eq("goal_id", goalId);

  if (countError) {
    // eslint-disable-next-line no-console
    console.error("Error counting progress entries:", countError);
    throw new Error("database_error");
  }

  const entriesCount = count || 0;
  const isLocked = entriesCount >= 1;

  // Step 3: Check if trying to update immutable fields when locked
  if (isLocked) {
    const hasImmutableFieldUpdate =
      command.name !== undefined || command.target_value !== undefined || command.deadline !== undefined;

    if (hasImmutableFieldUpdate) {
      throw new Error("goal_locked");
    }
  }

  // Step 4: Build update payload with whitelisted fields only
  interface UpdatePayload {
    name?: string;
    target_value?: number;
    deadline?: string;
    reflection_notes?: string | null;
    ai_summary?: string | null;
  }

  const updatePayload: UpdatePayload = {};

  if (command.name !== undefined) {
    updatePayload.name = command.name;
  }

  if (command.target_value !== undefined) {
    updatePayload.target_value = parseFloat(command.target_value);
  }

  if (command.deadline !== undefined) {
    updatePayload.deadline = command.deadline;
  }

  if (command.reflection_notes !== undefined) {
    updatePayload.reflection_notes = command.reflection_notes;
  }

  if (command.ai_summary !== undefined) {
    updatePayload.ai_summary = command.ai_summary;
  }

  // Step 5: Execute update
  const { data: updatedGoal, error: updateError } = await supabase
    .from("goals")
    .update(updatePayload)
    .eq("id", goalId)
    .eq("user_id", userId)
    .select("id, updated_at")
    .single();

  if (updateError) {
    // eslint-disable-next-line no-console
    console.error("Error updating goal:", updateError);
    throw new Error("database_error");
  }

  return {
    id: updatedGoal.id,
    updated_at: updatedGoal.updated_at,
  };
}

/**
 * Deletes a goal from the database
 *
 * MVP restriction: Only allows deletion when there are no progress entries yet.
 *
 * @throws Error with specific code:
 * - "goal_not_found" - goal doesn't exist or doesn't belong to user
 * - "goal_has_progress" - goal has progress entries and cannot be deleted (409)
 * - "database_error" - database operation failed
 */
export async function deleteGoal(supabase: SupabaseClient, userId: string, goalId: string): Promise<void> {
  // Step 1: Check if goal exists and belongs to user
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError) {
    // eslint-disable-next-line no-console
    console.error("Error checking goal:", goalError);
    throw new Error("database_error");
  }

  if (!goal) {
    throw new Error("goal_not_found");
  }

  // Step 2: Check if goal has any progress entries (MVP restriction)
  const { count, error: countError } = await supabase
    .from("goal_progress")
    .select("*", { count: "exact", head: true })
    .eq("goal_id", goalId);

  if (countError) {
    // eslint-disable-next-line no-console
    console.error("Error counting progress entries:", countError);
    throw new Error("database_error");
  }

  if (count !== null && count >= 1) {
    throw new Error("goal_has_progress");
  }

  // Step 3: Delete the goal
  const { error: deleteError } = await supabase.from("goals").delete().eq("id", goalId).eq("user_id", userId);

  if (deleteError) {
    // eslint-disable-next-line no-console
    console.error("Error deleting goal:", deleteError);
    throw new Error("database_error");
  }
}

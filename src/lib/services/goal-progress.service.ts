import type { SupabaseClient } from "../../db/supabase.client";
import type {
  GoalProgressEntryDto,
  OffsetPaginatedDto,
  GetGoalProgressQueryDto,
  CreateGoalProgressCommand,
  UpdateProgressCommand,
  DecimalString,
  GoalStatus,
} from "../../types";

/**
 * Validates that a goal exists and belongs to the user
 * @throws Error with specific code for 404 responses
 */
export async function assertGoalAccessible(supabase: SupabaseClient, userId: string, goalId: string): Promise<void> {
  const { data, error } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Error checking goal access:", error);
    throw new Error("database_error");
  }

  if (!data) {
    throw new Error("goal_not_found");
  }
}

/**
 * Lists progress entries for a specific goal with pagination and sorting
 *
 * @param supabase - Supabase client from context.locals
 * @param userId - Authenticated user ID
 * @param goalId - UUID of the goal
 * @param query - Query parameters (sort, order, page, pageSize)
 * @returns Paginated list of progress entries with DecimalString for value
 * @throws Error with specific codes: "goal_not_found", "database_error"
 */
export async function listGoalProgress(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  query: GetGoalProgressQueryDto
): Promise<OffsetPaginatedDto<GoalProgressEntryDto>> {
  // =========================================================================
  // 1. Verify goal access (user owns the goal)
  // =========================================================================
  await assertGoalAccessible(supabase, userId, goalId);

  // =========================================================================
  // 2. Prepare pagination
  // =========================================================================
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // =========================================================================
  // 3. Query goal_progress with pagination, sorting, and count
  // =========================================================================
  const { data, error, count } = await supabase
    .from("goal_progress")
    .select("id, goal_id, value, notes, created_at, updated_at", {
      count: "exact",
    })
    .eq("goal_id", goalId)
    .order(query.sort ?? "created_at", {
      ascending: query.order === "asc",
    })
    .range(from, to);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal progress:", error);
    throw new Error("database_error");
  }

  // =========================================================================
  // 4. Map database rows to DTO (convert decimal to DecimalString)
  // =========================================================================
  const items: GoalProgressEntryDto[] = (data ?? []).map((row) => ({
    id: row.id,
    goal_id: row.goal_id,
    value: String(row.value), // Convert decimal to string
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  // =========================================================================
  // 5. Return paginated response
  // =========================================================================
  return {
    items,
    page,
    pageSize,
    total: count ?? 0,
  };
}

/**
 * Creates a new progress entry for a specific goal
 * Only allowed for goals with status 'active'
 *
 * @param supabase - Supabase client from context.locals
 * @param userId - Authenticated user ID
 * @param goalId - UUID of the goal
 * @param command - Command with value (DecimalString) and optional notes
 * @returns Created progress entry metadata, goal info, and computed values
 * @throws Error with specific codes: "goal_not_found", "goal_not_active", "database_error"
 */
export async function createGoalProgressEntry(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  command: CreateGoalProgressCommand
): Promise<{
  progress: {
    id: string;
    goal_id: string;
    value: DecimalString;
    notes: string | null;
  };
  goal: {
    id: string;
    status: GoalStatus;
  };
  computed: {
    current_value: DecimalString;
    progress_percent: number;
  };
}> {
  // =========================================================================
  // 1. Verify goal exists, belongs to user, and is active
  // =========================================================================
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, status, target_value")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (goalError) {
    // eslint-disable-next-line no-console
    console.error("Error checking goal access:", goalError);
    throw new Error("database_error");
  }

  if (!goal) {
    throw new Error("goal_not_found");
  }

  if (goal.status !== "active") {
    throw new Error("goal_not_active");
  }

  // =========================================================================
  // 2. Insert progress entry
  // =========================================================================
  const valueAsNumber = parseFloat(command.value);

  const { data: progressEntry, error: insertError } = await supabase
    .from("goal_progress")
    .insert({
      goal_id: goalId,
      value: valueAsNumber,
      notes: command.notes ?? null,
    })
    .select("id, goal_id, value, notes")
    .single();

  if (insertError || !progressEntry) {
    // eslint-disable-next-line no-console
    console.error("Error inserting progress entry:", insertError);
    throw new Error("database_error");
  }

  // =========================================================================
  // 3. Calculate current_value (sum of all progress entries for this goal)
  // =========================================================================
  const { data: allProgressEntries, error: progressError } = await supabase
    .from("goal_progress")
    .select("value")
    .eq("goal_id", goalId);

  if (progressError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching progress entries for calculation:", progressError);
    throw new Error("database_error");
  }

  const currentValue = (allProgressEntries || []).reduce((sum, entry) => sum + Number(entry.value), 0);

  // =========================================================================
  // 4. Calculate progress_percent
  // =========================================================================
  const targetValue = Number(goal.target_value);
  const progressPercent = targetValue > 0 ? Math.round((currentValue / targetValue) * 100) : 0;

  // =========================================================================
  // 5. Return response
  // =========================================================================
  return {
    progress: {
      id: progressEntry.id,
      goal_id: progressEntry.goal_id,
      value: String(progressEntry.value),
      notes: progressEntry.notes,
    },
    goal: {
      id: goal.id,
      status: goal.status,
    },
    computed: {
      current_value: String(currentValue),
      progress_percent: progressPercent,
    },
  };
}

/**
 * Updates an existing progress entry
 * Only allowed for goals with status 'active'
 *
 * @param supabase - Supabase client from context.locals
 * @param userId - Authenticated user ID
 * @param progressId - UUID of the progress entry to update
 * @param command - Command with optional value (DecimalString) and notes
 * @returns Updated progress entry metadata
 * @throws Error with specific codes: "progress_not_found", "goal_not_active", "database_error"
 */
export async function updateProgressEntry(
  supabase: SupabaseClient,
  userId: string,
  progressId: string,
  command: UpdateProgressCommand
): Promise<{
  id: string;
  goal_id: string;
  value: DecimalString;
  notes: string | null;
  updated_at: string;
}> {
  // =========================================================================
  // 1. Fetch progress entry and associated goal to verify ownership and status
  // =========================================================================
  const { data: progressEntry, error: progressError } = await supabase
    .from("goal_progress")
    .select("id, goal_id, value, notes, updated_at")
    .eq("id", progressId)
    .maybeSingle();

  if (progressError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching progress entry:", progressError);
    throw new Error("database_error");
  }

  if (!progressEntry) {
    throw new Error("progress_not_found");
  }

  // Verify that the goal belongs to the user
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, user_id, status")
    .eq("id", progressEntry.goal_id)
    .maybeSingle();

  if (goalError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal:", goalError);
    throw new Error("database_error");
  }

  if (!goal || goal.user_id !== userId) {
    // Entry exists but doesn't belong to user - return not_found for security
    throw new Error("progress_not_found");
  }

  // =========================================================================
  // 2. Verify goal is active
  // =========================================================================
  if (goal.status !== "active") {
    throw new Error("goal_not_active");
  }

  // =========================================================================
  // 3. Prepare update data
  // =========================================================================
  const updateData: {
    value?: number;
    notes?: string | null;
    updated_at?: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (command.value !== undefined) {
    updateData.value = parseFloat(command.value);
  }

  if (command.notes !== undefined) {
    updateData.notes = command.notes;
  }

  // =========================================================================
  // 4. Update progress entry
  // =========================================================================
  const { data: updatedProgress, error: updateError } = await supabase
    .from("goal_progress")
    .update(updateData)
    .eq("id", progressId)
    .select("id, goal_id, value, notes, updated_at")
    .single();

  if (updateError || !updatedProgress) {
    // eslint-disable-next-line no-console
    console.error("Error updating progress entry:", updateError);
    throw new Error("database_error");
  }

  // =========================================================================
  // 5. Return response with DecimalString for value
  // =========================================================================
  return {
    id: updatedProgress.id,
    goal_id: updatedProgress.goal_id,
    value: String(updatedProgress.value),
    notes: updatedProgress.notes,
    updated_at: updatedProgress.updated_at,
  };
}

/**
 * Deletes an existing progress entry
 * Only allowed for goals with status 'active'
 *
 * @param supabase - Supabase client from context.locals
 * @param userId - Authenticated user ID
 * @param progressId - UUID of the progress entry to delete
 * @throws Error with specific codes: "progress_not_found", "goal_not_active", "database_error"
 */
export async function deleteProgressEntry(
  supabase: SupabaseClient,
  userId: string,
  progressId: string
): Promise<void> {
  // =========================================================================
  // 1. Fetch progress entry and associated goal to verify ownership and status
  // =========================================================================
  const { data: progressEntry, error: progressError } = await supabase
    .from("goal_progress")
    .select("id, goal_id")
    .eq("id", progressId)
    .maybeSingle();

  if (progressError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching progress entry:", progressError);
    throw new Error("database_error");
  }

  if (!progressEntry) {
    throw new Error("progress_not_found");
  }

  // Verify that the goal belongs to the user and check its status
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, user_id, status")
    .eq("id", progressEntry.goal_id)
    .maybeSingle();

  if (goalError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal:", goalError);
    throw new Error("database_error");
  }

  if (!goal || goal.user_id !== userId) {
    // Entry exists but doesn't belong to user - return not_found for security
    throw new Error("progress_not_found");
  }

  // =========================================================================
  // 2. Verify goal is active
  // =========================================================================
  if (goal.status !== "active") {
    throw new Error("goal_not_active");
  }

  // =========================================================================
  // 3. Delete progress entry
  // =========================================================================
  const { error: deleteError } = await supabase.from("goal_progress").delete().eq("id", progressId);

  if (deleteError) {
    // eslint-disable-next-line no-console
    console.error("Error deleting progress entry:", deleteError);
    throw new Error("database_error");
  }
}

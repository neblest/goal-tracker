import type { SupabaseClient } from "../../db/supabase.client";
import type { DecimalString, GetGoalHistoryQueryDto, GoalHistoryItemDto } from "../../types";

/**
 * Lists all goal iterations in the history chain for a given goal.
 *
 * The history chain is defined by the self-referencing `parent_goal_id` relationship:
 * - Find the root goal (parent_goal_id IS NULL) by traversing up from goalId
 * - Collect all descendants from the root recursively
 * - Return them sorted by created_at (chronologically)
 *
 * @param supabase - Supabase client from context.locals
 * @param userId - Authenticated user ID
 * @param goalId - The goal ID to get history for
 * @param query - Query parameters for sorting
 * @returns Object with items array containing goal history
 * @throws Error with "goal_not_found" if goal doesn't exist or doesn't belong to user
 * @throws Error with "database_error" if database operation fails
 */
export async function listGoalHistory(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  query: GetGoalHistoryQueryDto
): Promise<{ items: GoalHistoryItemDto[] }> {
  // Step 1: Verify access to the goal
  const { data: goalAccess, error: accessError } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (accessError) {
    // eslint-disable-next-line no-console
    console.error("Error checking goal access:", accessError);
    throw new Error("database_error");
  }

  if (!goalAccess) {
    throw new Error("goal_not_found");
  }

  // Step 2: Get history chain using RPC function
  const { data: historyData, error: historyError } = await supabase.rpc("get_goal_history", {
    p_goal_id: goalId,
  });

  if (historyError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal history:", historyError);
    throw new Error("database_error");
  }

  // If no history found (shouldn't happen since we verified access), return empty
  if (!historyData || historyData.length === 0) {
    return { items: [] };
  }

  // Step 3: Get all goal IDs from history
  const goalIds = historyData.map((goal: { id: string }) => goal.id);

  // Step 4: Fetch progress data for all goals in the chain
  const { data: progressData, error: progressError } = await supabase
    .from("goal_progress")
    .select("goal_id, value")
    .in("goal_id", goalIds);

  if (progressError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching goal progress:", progressError);
    throw new Error("database_error");
  }

  // Step 5: Calculate current_value for each goal
  const progressByGoalId = new Map<string, number>();

  if (progressData) {
    for (const entry of progressData) {
      const currentSum = progressByGoalId.get(entry.goal_id) ?? 0;
      progressByGoalId.set(entry.goal_id, currentSum + entry.value);
    }
  }

  // Step 6: Map to GoalHistoryItemDto with computed current_value
  // Ensure explicit ordering based on query.order (default handled by caller)
  const orderedHistory = Array.isArray(historyData) ? historyData.slice() : [];
  orderedHistory.sort((a: any, b: any) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    // If query.order === 'desc' -> newest first
    if (query.order === "desc") return tb - ta;
    return ta - tb;
  });

  const items: GoalHistoryItemDto[] = orderedHistory.map(
    (goal: {
      id: string;
      parent_goal_id: string | null;
      name: string;
      status: string;
      deadline: string;
      created_at: string;
      updated_at: string;
      ai_summary: string | null;
    }) => ({
      id: goal.id,
      parent_goal_id: goal.parent_goal_id,
      name: goal.name,
      status: goal.status as GoalHistoryItemDto["status"],
      deadline: goal.deadline,
      created_at: goal.created_at,
      updated_at: goal.updated_at,
      computed: {
        current_value: String(progressByGoalId.get(goal.id) ?? 0) as DecimalString,
      },
      ai_summary: goal.ai_summary,
    })
  );

  return { items };
}

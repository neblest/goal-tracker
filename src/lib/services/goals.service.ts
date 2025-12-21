import type { SupabaseClient } from "../../db/supabase.client";
import type { CreateGoalCommand, DbGoalRow, DecimalString } from "../../types";

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

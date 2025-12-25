-- Migration: Add updated_at to Goal History Function
-- Description: Updates get_goal_history function to include updated_at field
-- Author: AI Assistant
-- Date: 2025-12-25

-- ============================================================================
-- Function: get_goal_history (Updated)
-- ============================================================================

-- Drop the existing function first
drop function if exists public.get_goal_history(uuid);

-- Recreate the function with updated_at field
create or replace function public.get_goal_history(p_goal_id uuid)
returns table (
  id uuid,
  parent_goal_id uuid,
  name text,
  status public.goal_status,
  deadline date,
  ai_summary text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
as $$
declare
  v_root_id uuid;
  v_user_id uuid;
begin
  -- Step 1: Get the user_id from the original goal for consistency checks
  -- This respects RLS - if user doesn't have access, this will return NULL
  select g.user_id into v_user_id
  from public.goals g
  where g.id = p_goal_id;

  -- If goal not found or no access, return empty set
  if v_user_id is null then
    return;
  end if;

  -- Step 2: Find the root goal by traversing up the parent_goal_id chain
  -- Uses recursive CTE to handle any depth of nesting
  with recursive ancestors as (
    -- Base case: start with the given goal
    select
      g.id,
      g.parent_goal_id,
      g.user_id,
      array[g.id] as path  -- Track path to detect cycles
    from public.goals g
    where g.id = p_goal_id
      and g.user_id = v_user_id  -- Ensure we stay within same user

    union all

    -- Recursive case: traverse up to parent goals
    select
      g.id,
      g.parent_goal_id,
      g.user_id,
      a.path || g.id  -- Append to path
    from public.goals g
    inner join ancestors a on g.id = a.parent_goal_id
    where not (g.id = any(a.path))  -- Prevent infinite loops from cycles
      and array_length(a.path, 1) < 100  -- Safety limit: max 100 levels deep
  )
  select a.id into v_root_id
  from ancestors a
  where a.parent_goal_id is null
  limit 1;

  -- If no root found (shouldn't happen with valid data), use the original goal as root
  if v_root_id is null then
    v_root_id := p_goal_id;
  end if;

  -- Step 3: Collect all descendants from the root recursively
  -- This builds the complete history chain starting from the root
  return query
  with recursive descendants as (
    -- Base case: start with the root goal
    select
      g.id,
      g.parent_goal_id,
      g.name,
      g.status,
      g.deadline,
      g.ai_summary,
      g.created_at,
      g.updated_at,
      array[g.id] as path,  -- Track path to detect cycles
      g.created_at as sort_key  -- For consistent ordering
    from public.goals g
    where g.id = v_root_id
      and g.user_id = v_user_id  -- Ensure we stay within same user

    union all

    -- Recursive case: traverse down to child goals
    select
      g.id,
      g.parent_goal_id,
      g.name,
      g.status,
      g.deadline,
      g.ai_summary,
      g.created_at,
      g.updated_at,
      d.path || g.id,  -- Append to path
      g.created_at as sort_key
    from public.goals g
    inner join descendants d on g.parent_goal_id = d.id
    where not (g.id = any(d.path))  -- Prevent infinite loops from cycles
      and array_length(d.path, 1) < 100  -- Safety limit: max 100 levels deep
      and g.user_id = v_user_id  -- Ensure we stay within same user
  )
  select
    d.id,
    d.parent_goal_id,
    d.name,
    d.status,
    d.deadline,
    d.ai_summary,
    d.created_at,
    d.updated_at
  from descendants d
  order by d.created_at asc;  -- Return chronologically (oldest first)
end;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================

-- Grant execute permission to authenticated users
-- RLS on the goals table will still apply within the function
grant execute on function public.get_goal_history(uuid) to authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

comment on function public.get_goal_history(uuid) is
'Returns all goal iterations in the history chain for a given goal ID. The chain includes the root goal (where parent_goal_id IS NULL) and all its descendants. Results are sorted chronologically by created_at. Access is controlled by RLS policies on the goals table.';

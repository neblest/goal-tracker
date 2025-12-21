-- Migration: Create Goal History Function
-- Description: Creates a recursive function to retrieve all goal iterations in a history chain
-- Function: get_goal_history(p_goal_id uuid)
-- Author: AI Assistant
-- Date: 2025-12-21

-- ============================================================================
-- Function: get_goal_history
-- ============================================================================

-- Creates a function to retrieve all goal iterations that belong to the same
-- "history chain" as the given goal ID. The chain is defined by the 
-- self-referencing parent_goal_id relationship:
-- 1. Find the root goal (where parent_goal_id IS NULL) by traversing up
-- 2. Collect all descendant goals from the root recursively
-- 3. Return them sorted by created_at (chronologically)
--
-- Security: Uses SECURITY INVOKER (default) so RLS policies on goals table apply
-- This ensures users can only access goal histories they own
--
-- Returns: Set of goal records (id, parent_goal_id, name, status, deadline, ai_summary, created_at)
-- Throws: No explicit errors - returns empty set if goal doesn't exist or access denied by RLS

create or replace function public.get_goal_history(p_goal_id uuid)
returns table (
  id uuid,
  parent_goal_id uuid,
  name text,
  status public.goal_status,
  deadline date,
  ai_summary text,
  created_at timestamptz
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
    d.created_at
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

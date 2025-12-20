-- Migration: Create Initial Schema for GoalTracker
-- Description: Creates core tables (goals, goal_progress), custom types, and relationships
-- Tables: goals, goal_progress
-- Types: goal_status enum
-- Author: AI Assistant
-- Date: 2025-12-20

-- ============================================================================
-- Custom Types
-- ============================================================================

-- Create enum type for goal status
-- Represents the lifecycle states of a goal
create type public.goal_status as enum (
  'active',
  'completed_success',
  'completed_failure',
  'abandoned'
);

-- ============================================================================
-- Tables
-- ============================================================================

-- Create goals table
-- Central table for storing goal definitions, progress tracking, and outcomes
-- Supports goal iterations through self-referencing parent_goal_id
-- References auth.users directly for user ownership
create table public.goals (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_goal_id uuid references public.goals(id) on delete set null,
  name text not null,
  target_value decimal not null check (target_value > 0),
  deadline date not null,
  status public.goal_status not null default 'active',
  reflection_notes text,
  ai_summary text,
  abandonment_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  primary key (id)
);

-- Create goal_progress table
-- Stores individual progress entries for each goal
-- Multiple entries per goal to track progress over time
create table public.goal_progress (
  id uuid not null default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  value decimal not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  primary key (id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Index for finding all goals by user
create index goals_user_id_idx on public.goals(user_id);

-- Index for finding child goals (iterations) of a parent goal
create index goals_parent_goal_id_idx on public.goals(parent_goal_id);

-- Composite index for filtering goals by user and status (e.g., active goals)
create index goals_user_id_status_idx on public.goals(user_id, status);

-- Composite index for retrieving goals by user sorted by creation date (most recent first)
create index goals_user_id_created_at_idx on public.goals(user_id, created_at desc);

-- Index for finding all progress entries for a specific goal
create index goal_progress_goal_id_idx on public.goal_progress(goal_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
alter table public.goals enable row level security;
alter table public.goal_progress enable row level security;

-- ----------------------------------------------------------------------------
-- Goals Table Policies
-- ----------------------------------------------------------------------------

-- Policy: Authenticated users can view their own goals
create policy "authenticated users can select own goals"
on public.goals for select
to authenticated
using (auth.uid() = user_id);

-- Policy: Authenticated users can create their own goals
create policy "authenticated users can insert own goals"
on public.goals for insert
to authenticated
with check (auth.uid() = user_id);

-- Policy: Authenticated users can update their own goals
create policy "authenticated users can update own goals"
on public.goals for update
to authenticated
using (auth.uid() = user_id);

-- Policy: Authenticated users can delete their own goals
create policy "authenticated users can delete own goals"
on public.goals for delete
to authenticated
using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Goal Progress Table Policies
-- ----------------------------------------------------------------------------

-- Policy: Authenticated users can view progress for their own goals
create policy "authenticated users can select own goal progress"
on public.goal_progress for select
to authenticated
using (
  exists (
    select 1
    from public.goals
    where goals.id = goal_progress.goal_id
      and goals.user_id = auth.uid()
  )
);

-- Policy: Authenticated users can create progress entries for their own goals
create policy "authenticated users can insert own goal progress"
on public.goal_progress for insert
to authenticated
with check (
  exists (
    select 1
    from public.goals
    where goals.id = goal_progress.goal_id
      and goals.user_id = auth.uid()
  )
);

-- Policy: Authenticated users can update progress entries for their own goals
create policy "authenticated users can update own goal progress"
on public.goal_progress for update
to authenticated
using (
  exists (
    select 1
    from public.goals
    where goals.id = goal_progress.goal_id
      and goals.user_id = auth.uid()
  )
);

-- Policy: Authenticated users can delete progress entries for their own goals
create policy "authenticated users can delete own goal progress"
on public.goal_progress for delete
to authenticated
using (
  exists (
    select 1
    from public.goals
    where goals.id = goal_progress.goal_id
      and goals.user_id = auth.uid()
  )
);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Function to automatically update the updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger: Update updated_at on goals table
create trigger handle_goals_updated_at
before update on public.goals
for each row
execute function public.handle_updated_at();

-- Trigger: Update updated_at on goal_progress table
create trigger handle_goal_progress_updated_at
before update on public.goal_progress
for each row
execute function public.handle_updated_at();

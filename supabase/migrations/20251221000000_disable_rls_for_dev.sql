-- Migration: Disable RLS for Development
-- Description: Temporarily disables RLS policies for local development
-- ⚠️ WARNING: DO NOT deploy this migration to production!
-- Author: Developer
-- Date: 2025-12-21

-- Disable RLS on tables
alter table public.goals disable row level security;
alter table public.goal_progress disable row level security;

-- Migration: Add ai_generation_attempts column to goals
-- Description: Adds an integer column to track AI generation attempts for goal summaries
-- Date: 2025-12-25

alter table public.goals
  add column ai_generation_attempts integer not null default 0;

-- Add CHECK constraints for text field lengths
-- This migration adds database-level validation for character limits

-- Goals table constraints
ALTER TABLE public.goals
  ADD CONSTRAINT check_name_length
    CHECK (char_length(name) <= 50),
  ADD CONSTRAINT check_reflection_notes_length
    CHECK (reflection_notes IS NULL OR char_length(reflection_notes) <= 1000),
  ADD CONSTRAINT check_ai_summary_length
    CHECK (ai_summary IS NULL OR char_length(ai_summary) <= 5000);

-- Goal progress table constraints
ALTER TABLE public.goal_progress
  ADD CONSTRAINT check_notes_length
    CHECK (notes IS NULL OR char_length(notes) <= 150);

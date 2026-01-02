import React, { useCallback, useState } from "react";

import { Textarea } from "@/components/ui/textarea";

interface GoalReflectionNotesSectionProps {
  value: string | null;
  onSave: (value: string | null) => Promise<void>;
}

export function GoalReflectionNotesSection({ value, onSave }: GoalReflectionNotesSectionProps) {
  const [draft, setDraft] = useState(value ?? "");

  const handleBlur = useCallback(async () => {
    const trimmedDraft = draft.trim();
    const originalValue = value ?? "";
    if (trimmedDraft !== originalValue) {
      try {
        await onSave(trimmedDraft === "" ? null : trimmedDraft);
      } catch (error) {
        // Optionally handle error, but since no UI feedback, maybe log or ignore
        console.error("Failed to save reflection notes:", error);
      }
    }
  }, [draft, value, onSave]);

  return (
    <section className="rounded-xl border border-[#E5DDD5] bg-white px-6 py-5 shadow-sm" aria-label="Reflection note">
      <header className="flex items-center justify-between pb-3">
        <div>
          <h3 className="text-base font-semibold text-[#4A3F35]">Reflection note</h3>
          <p className="text-sm text-[#8B7E74]">Any note summarizing the progress of the goal.</p>
        </div>
        <span className="text-[11px] text-[#8B7E74]">{draft.length}/1000</span>
      </header>
      <div className="space-y-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={handleBlur}
          maxLength={1000}
          rows={6}
          className="resize-none"
          aria-label="Reflection note"
        />
      </div>
    </section>
  );
}

export default GoalReflectionNotesSection;

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import type { GoalStatus } from "@/types";

interface GoalAiSummarySectionProps {
  status: GoalStatus;
  aiSummary: string | null;
  entriesCount: number;
  reflectionNotes: string | null;
  onSave: (value: string | null) => Promise<void>;
}

export function GoalAiSummarySection({
  status,
  aiSummary,
  entriesCount,
  reflectionNotes,
  onSave,
}: GoalAiSummarySectionProps) {
  const [draft, setDraft] = useState("");

  const canEdit = useMemo(() => status !== "active", [status]);
  const hasEnoughDataForAI = useMemo(
    () => entriesCount >= 3 && reflectionNotes?.trim(),
    [entriesCount, reflectionNotes]
  );

  useEffect(() => {
    setDraft(hasEnoughDataForAI ? "Test data" : (aiSummary ?? ""));
  }, [hasEnoughDataForAI, aiSummary]);

  const handleBlur = useCallback(async () => {
    if (!canEdit) return;
    const trimmedDraft = draft.trim();
    const originalValue = aiSummary ?? "";
    if (trimmedDraft !== originalValue) {
      try {
        await onSave(trimmedDraft === "" ? null : trimmedDraft);
      } catch (error) {
        console.error("Failed to save summary:", error);
      }
    }
  }, [canEdit, draft, aiSummary, onSave]);

  return (
    <section className="rounded-xl border border-border/70 bg-card px-6 py-5 shadow-sm" aria-label="Podsumowanie">
      <header className="flex items-center justify-between pb-3">
        <div>
          <h3 className="text-base font-semibold">Podsumowanie</h3>
          <p className="text-sm text-muted-foreground">
            Dostępne po zakończeniu celu. Automatyczne podsumowanie dostępne przy min. 3 wpisach postępu i uzupełnionej
            notatce refleksyjnej.
          </p>
        </div>
        {!canEdit ? (
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Tylko po zakończeniu</span>
        ) : null}
      </header>

      {canEdit ? (
        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={handleBlur}
            rows={4}
            className="resize-none"
            aria-label="Podsumowanie"
          />
        </div>
      ) : null}
    </section>
  );
}

export default GoalAiSummarySection;

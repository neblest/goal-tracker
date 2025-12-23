import React, { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GoalStatus } from "@/types";

interface GoalAiSummarySectionProps {
  status: GoalStatus;
  aiSummary: string | null;
  entriesCount: number;
  onSave: (value: string | null) => Promise<void>;
}

export function GoalAiSummarySection({ status, aiSummary, entriesCount, onSave }: GoalAiSummarySectionProps) {
  const [draft, setDraft] = useState(aiSummary ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canEdit = useMemo(() => status !== "active", [status]);
  const hasEnoughData = useMemo(() => entriesCount >= 3, [entriesCount]);

  const handleSave = useCallback(async () => {
    if (!canEdit || !hasEnoughData) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await onSave(draft.trim() === "" ? null : draft.trim());
      setSuccess("Zapisano podsumowanie.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się zapisać podsumowania.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [canEdit, draft, hasEnoughData, onSave]);

  return (
    <section className="rounded-xl border border-border/70 bg-card px-6 py-5 shadow-sm" aria-label="AI podsumowanie">
      <header className="flex items-center justify-between pb-3">
        <div>
          <h3 className="text-base font-semibold">AI podsumowanie</h3>
          <p className="text-sm text-muted-foreground">Dostępne po zakończeniu celu.</p>
        </div>
        {!canEdit ? (
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Tylko po zakończeniu</span>
        ) : null}
      </header>

      {!hasEnoughData ? <p className="text-sm text-muted-foreground">Za mało danych (min. 3 wpisy progresu).</p> : null}

      {hasEnoughData ? (
        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            aria-label="AI podsumowanie"
            disabled={!canEdit}
          />
          {error ? (
            <p className="text-sm text-destructive" aria-live="polite">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-sm text-emerald-700" aria-live="polite">
              {success}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!canEdit || saving}>
              {saving ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default GoalAiSummarySection;

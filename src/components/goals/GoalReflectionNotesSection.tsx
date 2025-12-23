import React, { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface GoalReflectionNotesSectionProps {
  value: string | null;
  onSave: (value: string | null) => Promise<void>;
}

export function GoalReflectionNotesSection({ value, onSave }: GoalReflectionNotesSectionProps) {
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await onSave(draft.trim() === "" ? null : draft.trim());
      setSuccess("Zapisano notatkę.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się zapisać notatki.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [draft, onSave]);

  return (
    <section
      className="rounded-xl border border-border/70 bg-card px-6 py-5 shadow-sm"
      aria-label="Notatka refleksyjna"
    >
      <header className="flex items-center justify-between pb-3">
        <div>
          <h3 className="text-base font-semibold">Notatka refleksyjna</h3>
          <p className="text-sm text-muted-foreground">Dowolna notatka podsumowująca przebieg celu.</p>
        </div>
      </header>
      <div className="space-y-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          aria-label="Notatka refleksyjna"
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default GoalReflectionNotesSection;

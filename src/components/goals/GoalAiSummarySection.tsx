import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { GoalStatus } from "@/types";
import { generateAiSummary } from "@/lib/api/aiSummary";

interface GoalAiSummarySectionProps {
  goalId: string;
  status: GoalStatus;
  aiSummary: string | null;
  entriesCount: number;
  reflectionNotes: string | null;
  onSave: (value: string | null) => Promise<void>;
  onAiGenerated?: (summary: string) => void;
}

export function GoalAiSummarySection({
  goalId,
  status,
  aiSummary,
  entriesCount,
  reflectionNotes,
  onSave,
  onAiGenerated,
}: GoalAiSummarySectionProps) {
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const canEdit = useMemo(() => status !== "active", [status]);
  const hasEnoughDataForAI = useMemo(() => entriesCount >= 3, [entriesCount]);

  useEffect(() => {
    setDraft(aiSummary ?? "");
  }, [aiSummary]);

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

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await generateAiSummary(goalId, Boolean(aiSummary));
      const generatedSummary = response.data.goal.ai_summary;
      setDraft(generatedSummary);

      // Notify parent component
      if (onAiGenerated) {
        onAiGenerated(generatedSummary);
      }
    } catch (error) {
      console.error("Failed to generate AI summary:", error);
      setGenerationError(error instanceof Error ? error.message : "Failed to generate AI summary. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [goalId, aiSummary, onAiGenerated]);

  return (
    <section className="rounded-xl border border-border/70 bg-card px-6 py-5 shadow-sm" aria-label="Summary">
      <header className="flex items-center justify-between pb-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold">Summary</h3>
          <p className="text-sm text-muted-foreground">
            Available after goal completion or abandonment. AI summary can be generated when you have at least 3
            progress entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <>
              {hasEnoughDataForAI && !aiSummary && (
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate
                    </>
                  )}
                </Button>
              )}
              <span className="text-[11px] text-[#8B7E74]">{draft.length}/5000</span>
            </>
          ) : (
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              After completion/abandonment
            </span>
          )}
        </div>
      </header>

      {canEdit ? (
        <div className="space-y-3">
          {generationError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {generationError}
            </div>
          )}
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={handleBlur}
            maxLength={5000}
            rows={4}
            className="resize-none"
            aria-label="Summary"
            placeholder={
              hasEnoughDataForAI
                ? "Click 'Generate' to create an AI summary..."
                : "Complete or abandon your goal with at least 3 progress entries to generate an AI summary"
            }
          />
        </div>
      ) : null}
    </section>
  );
}

export default GoalAiSummarySection;

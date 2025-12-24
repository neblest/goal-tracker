import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import GoalActionsSection from "@/components/goals/GoalActionsSection";
import GoalAiSummarySection from "@/components/goals/GoalAiSummarySection";
import GoalDetailsHeader from "@/components/goals/GoalDetailsHeader";
import GoalEditableFieldsSection from "@/components/goals/GoalEditableFieldsSection";
import GoalHistorySection from "@/components/goals/GoalHistorySection";
import GoalMetricsSection from "@/components/goals/GoalMetricsSection";
import GoalProgressSection from "@/components/goals/GoalProgressSection";
import GoalReflectionNotesSection from "@/components/goals/GoalReflectionNotesSection";
import { Button } from "@/components/ui/button";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type { GetGoalResponseDto, GoalDetailsDto, GoalStatus, UpdateGoalCommand, UpdateGoalResponseDto } from "@/types";

interface GoalDetailsPageProps {
  goalId: string;
}

type GoalDetailsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-found" }
  | { status: "success"; goal: GoalDetailsDto };

export default function GoalDetailsPage({ goalId }: GoalDetailsPageProps) {
  const [state, setState] = useState<GoalDetailsState>({ status: "loading" });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleBack = useCallback(() => {
    window.history.back();
  }, []);

  const fetchGoal = useCallback(
    async (options?: { keepData?: boolean }) => {
      if (!options?.keepData) {
        setState({ status: "loading" });
      } else {
        setIsRefreshing(true);
      }
      try {
        const response = await apiFetchJson<GetGoalResponseDto>(`/api/goals/${goalId}`);
        setState({ status: "success", goal: response.data.goal });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: "not-found" });
          setIsRefreshing(false);
          return;
        }

        const message = error instanceof Error ? error.message : "Nie udało się pobrać danych.";
        setState({ status: "error", message });
        setIsRefreshing(false);
        return;
      }
      setIsRefreshing(false);
    },
    [goalId]
  );

  useEffect(() => {
    void fetchGoal();
  }, [fetchGoal]);

  const metrics = useMemo(() => {
    if (state.status !== "success") {
      return null;
    }

    const { goal } = state;
    return {
      goalName: goal.name,
      deadline: goal.deadline,
      targetValue: goal.target_value,
      currentValueText: goal.computed.current_value,
      targetValueText: goal.target_value,
      progressPercent: goal.computed.progress_percent,
      daysRemaining: goal.computed.days_remaining,
      showDaysRemaining: goal.status === "active",
      goalStatus: goal.status,
      isLocked: goal.computed.is_locked,
      onSubmit: handleUpdateGoal,
      onAbandon: handleAbandon,
    };
  }, [state, handleUpdateGoal, handleAbandon]);

  const handleUpdateGoal = useCallback(
    async (command: UpdateGoalCommand) => {
      if (state.status !== "success") return;
      const currentGoal = state.goal;
      await apiFetchJson<UpdateGoalResponseDto>(`/api/goals/${goalId}`, {
        method: "PATCH",
        body: JSON.stringify(command),
      });

      setState({
        status: "success",
        goal: {
          ...currentGoal,
          ...command,
          updated_at: new Date().toISOString(),
          name: command.name ?? currentGoal.name,
          target_value: command.target_value ?? currentGoal.target_value,
          deadline: command.deadline ?? currentGoal.deadline,
        },
      });

      await fetchGoal({ keepData: true });
    },
    [fetchGoal, goalId, state]
  );

  const refreshGoal = useCallback(async () => {
    if (state.status !== "success") return;
    await fetchGoal({ keepData: true });
  }, [fetchGoal, state]);

  const handleToggleEditing = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  const handleAbandon = useCallback(async (reason: string) => {
    // Modal doesn't support abandoning - redirect to full page or show message
    console.warn("Abandon functionality not available in modal view");
  }, []);

  const handleStatusChanged = useCallback(
    (status: GoalStatus) => {
      if (state.status !== "success") return;
      setState({ status: "success", goal: { ...state.goal, status } });
      void fetchGoal({ keepData: true });
    },
    [fetchGoal, state]
  );

  const handleGoalCreated = useCallback((newGoalId: string) => {
    window.location.href = `/app/goals/${newGoalId}`;
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#4A3F35]">
      <header className="sticky top-0 z-20 bg-[#FAF8F5]/95 backdrop-blur-xl border-b border-[#E5DDD5]/60">
        {state.status === "success" ? (
          <GoalDetailsHeader name={state.goal.name} status={state.goal.status} onClose={handleBack} />
        ) : (
          <div className="flex items-center justify-between gap-4 px-8 py-4">
            <div>
              <p className="text-lg font-semibold">Szczegóły celu</p>
              <p className="text-sm text-muted-foreground">Ładowanie danych...</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Zamknij" onClick={handleBack}>
              ×
            </Button>
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-8 pb-16 pt-6">
        {isRefreshing ? (
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Odświeżanie danych...
          </div>
        ) : null}

        {state.status === "loading" ? (
          <div className="flex flex-col gap-4">
            <LoadingSection />
            <SkeletonSection />
            <SkeletonSection />
            <SkeletonSection />
          </div>
        ) : null}

        {state.status === "not-found" ? <NotFoundSection onClose={handleBack} /> : null}

        {state.status === "error" ? <ErrorSection message={state.message} onRetry={fetchGoal} /> : null}

        {state.status === "success" && metrics ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <GoalMetricsSection {...metrics} />
              <GoalReflectionNotesSection
                value={state.goal.reflection_notes}
                onSave={(value) => handleUpdateGoal({ reflection_notes: value })}
              />
            </div>
            <GoalEditableFieldsSection
              name={state.goal.name}
              targetValue={state.goal.target_value}
              deadline={state.goal.deadline}
              goalStatus={state.goal.status}
              isLocked={state.goal.computed.is_locked}
              isEditing={isEditing}
              onToggleEditing={handleToggleEditing}
              onSubmit={handleUpdateGoal}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <GoalProgressSection goalId={goalId} goalStatus={state.goal.status} onProgressChanged={refreshGoal} />
              <GoalHistorySection goalId={goalId} activeGoalId={state.goal.id} />
            </div>
            <GoalAiSummarySection
              status={state.goal.status}
              aiSummary={state.goal.ai_summary}
              entriesCount={state.goal.computed.entries_count}
              onSave={(value) => handleUpdateGoal({ ai_summary: value })}
            />
            <GoalActionsSection
              goalId={goalId}
              status={state.goal.status}
              defaultName={state.goal.name}
              defaultTargetValue={state.goal.target_value}
              defaultDeadline={state.goal.deadline}
              onStatusChanged={handleStatusChanged}
              onGoalCreated={handleGoalCreated}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LoadingSection() {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Ładowanie celu...
    </div>
  );
}

function SkeletonSection({ title }: { title?: string }) {
  return (
    <div className="animate-pulse rounded-xl border border-border/70 bg-card px-6 py-5 shadow-sm">
      {title ? <div className="mb-3 h-4 w-32 rounded bg-muted" aria-hidden="true" /> : null}
      <div className="grid gap-3 md:grid-cols-2" aria-hidden="true">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

function NotFoundSection({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-4 text-sm text-muted-foreground">
      <p className="font-semibold text-foreground">Nie znaleziono celu.</p>
      <p>Cel mógł zostać usunięty lub nie masz do niego dostępu.</p>
      <div>
        <Button onClick={onClose}>Wróć do listy</Button>
      </div>
    </div>
  );
}

function ErrorSection({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      role="status"
      aria-live="polite"
    >
      <AlertCircle className="size-4" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold text-foreground">Błąd wczytywania danych</p>
        <p className="text-destructive">{message}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Spróbuj ponownie
      </Button>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, TimerReset } from "lucide-react";

import { CongratulationsAnimation } from "@/components/goals/CongratulationsAnimation";
import GoalAiSummarySection from "@/components/goals/GoalAiSummarySection";
import GoalDetailsHeader from "@/components/goals/GoalDetailsHeader";
import GoalHistorySection from "@/components/goals/GoalHistorySection";
import GoalMetricsSection from "@/components/goals/GoalMetricsSection";
import GoalProgressSection from "@/components/goals/GoalProgressSection";
import GoalReflectionNotesSection from "@/components/goals/GoalReflectionNotesSection";
import GoalCreateModalPage from "@/components/goals/GoalCreateModalPage";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/button";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type { GetGoalHistoryResponseDto, GetGoalResponseDto, GoalDetailsDto, GoalStatus, UpdateGoalCommand, UpdateGoalResponseDto } from "@/types";

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
  const [showCongratulations, setShowCongratulations] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalInitialValues, setModalInitialValues] = useState<any>({});
  const [isYoungestInChain, setIsYoungestInChain] = useState(true);

  const handleBack = useCallback(() => {
    window.history.back();
  }, []);

  const handleLogout = useCallback(() => {
    window.location.href = "/login";
  }, []);

  const handleCreateGoal = useCallback((initialValues: any = {}) => {
    setModalInitialValues(initialValues);
    setIsCreateModalOpen(true);
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
    (async () => {
      try {
        await apiFetchJson(`/api/goals/sync-statuses`, {
          method: "POST",
          body: JSON.stringify({ goal_ids: [goalId] }),
        });
      } catch (e) {
        // Silent by design; we don't block rendering on sync-statuses
        // It only applies failure transitions after deadline now.
        // eslint-disable-next-line no-console
        console.warn("sync-statuses failed for goal details", e);
      }

      void fetchGoal();

      // Check if this goal is the youngest in its iteration chain AND no active goal exists
      try {
        const historyResponse = await apiFetchJson<GetGoalHistoryResponseDto>(`/api/goals/${goalId}/history`);
        const items = historyResponse.data.items;
        if (items.length > 0) {
          // Check if any goal in the chain is active
          const hasActiveGoal = items.some((item) => item.status === "active");
          // Items are sorted by created_at DESC (newest first), so items[0] is the youngest
          const youngestId = items[0].id;
          const isYoungest = youngestId === goalId;
          // Show buttons only if this is the youngest AND no active goal exists in chain
          setIsYoungestInChain(isYoungest && !hasActiveGoal);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Failed to fetch goal history for youngest check", e);
        // Default to true to avoid hiding buttons if fetch fails
        setIsYoungestInChain(true);
      }
    })();
  }, [fetchGoal, goalId]);

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

  const handleAbandon = useCallback(
    async (reason: string) => {
      if (state.status !== "success") return;
      await apiFetchJson(`/api/goals/${goalId}/abandon`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await fetchGoal({ keepData: true });

      // Recalculate isYoungestInChain after abandoning the goal
      try {
        const historyResponse = await apiFetchJson<GetGoalHistoryResponseDto>(`/api/goals/${goalId}/history`);
        const items = historyResponse.data.items;
        if (items.length > 0) {
          const hasActiveGoal = items.some((item) => item.status === "active");
          const youngestId = items[0].id;
          const isYoungest = youngestId === goalId;
          setIsYoungestInChain(isYoungest && !hasActiveGoal);
        }
      } catch (e) {
        console.warn("Failed to recalculate isYoungestInChain after abandoning", e);
      }
    },
    [fetchGoal, goalId, state]
  );

  const handleComplete = useCallback(async () => {
    if (state.status !== "success") return;
    await apiFetchJson(`/api/goals/${goalId}/complete`, {
      method: "PATCH",
    });
    setShowCongratulations(true);
    await fetchGoal({ keepData: true });

    // Recalculate isYoungestInChain after completing the goal
    try {
      const historyResponse = await apiFetchJson<GetGoalHistoryResponseDto>(`/api/goals/${goalId}/history`);
      const items = historyResponse.data.items;
      if (items.length > 0) {
        const hasActiveGoal = items.some((item) => item.status === "active");
        const youngestId = items[0].id;
        const isYoungest = youngestId === goalId;
        setIsYoungestInChain(isYoungest && !hasActiveGoal);
      }
    } catch (e) {
      console.warn("Failed to recalculate isYoungestInChain after completion", e);
    }
  }, [fetchGoal, goalId, state]);

  const handleModalSuccess = useCallback(async () => {
    await fetchGoal({ keepData: true });
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
      goalId: goal.id,
      updatedAt: goal.updated_at,
      isYoungestInChain,
      onSubmit: handleUpdateGoal,
      onAbandon: handleAbandon,
      onComplete: handleComplete,
      onCreateGoal: handleCreateGoal,
    };
  }, [state, isYoungestInChain, handleUpdateGoal, handleAbandon, handleComplete, handleCreateGoal]);

  const refreshGoal = useCallback(async () => {
    if (state.status !== "success") return;
    await fetchGoal({ keepData: true });
  }, [fetchGoal, state]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#4A3F35]">
      <CongratulationsAnimation
        isOpen={showCongratulations}
        onClose={() => setShowCongratulations(false)}
        userName="Użytkowniku"
      />

      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-[#E5DDD5] shadow-sm">
        <AppHeader title="Szczegóły celu" userDisplayName="Użytkowniku" onLogout={handleLogout} />
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <GoalProgressSection goalId={goalId} goalStatus={state.goal.status} onProgressChanged={refreshGoal} />
              <GoalHistorySection
                key={`${state.goal.status}-${state.goal.updated_at}`}
                goalId={goalId}
                activeGoalId={state.goal.id}
              />
            </div>
            <GoalAiSummarySection
              status={state.goal.status}
              aiSummary={state.goal.ai_summary}
              entriesCount={state.goal.computed.entries_count}
              reflectionNotes={state.goal.reflection_notes}
              onSave={(value) => handleUpdateGoal({ ai_summary: value })}
            />
          </div>
        ) : null}
      </div>

      <GoalCreateModalPage
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        initialValues={modalInitialValues}
        onSuccess={handleModalSuccess}
      />
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

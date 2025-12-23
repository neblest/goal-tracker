import React, { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetchJson } from "@/lib/api/apiFetchJson";
import type { GetGoalHistoryResponseDto, GoalHistoryItemDto, GoalStatus } from "@/types";

interface GoalHistorySectionProps {
  goalId: string;
  activeGoalId: string;
}

const statusLabels: Record<GoalStatus, string> = {
  active: "Aktywne",
  completed_success: "Zakończone (sukces)",
  completed_failure: "Zakończone (porażka)",
  abandoned: "Porzucone",
};

export function GoalHistorySection({ goalId, activeGoalId }: GoalHistorySectionProps) {
  const [items, setItems] = useState<GoalHistoryItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetchJson<GetGoalHistoryResponseDto>(`/api/goals/${goalId}/history`);
      setItems(response.data.items);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nie udało się wczytać historii.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return (
    <section
      className="rounded-xl border border-border/70 bg-card px-6 py-5 shadow-sm"
      aria-label="Historia iteracji celu"
    >
      <header className="flex items-center justify-between pb-4">
        <div>
          <h3 className="text-base font-semibold">Historia iteracji</h3>
          <p className="text-sm text-muted-foreground">Łańcuch powiązanych celów tworzony przy retry/continue.</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchHistory} disabled={loading}>
          Odśwież
        </Button>
      </header>

      {loading ? <p className="text-sm text-muted-foreground">Ładowanie historii...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak historii.</p>
      ) : null}

      <div className="grid gap-3">
        {items.map((item) => {
          const isActive = item.id === activeGoalId;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                if (isActive) return;
                window.location.href = `/app/goals/${item.id}`;
              }}
              className="flex w-full flex-col gap-1 rounded-lg border border-border/70 bg-background/50 px-4 py-3 text-left transition hover:border-primary"
              aria-current={isActive ? "true" : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{item.name}</span>
                <Badge variant={isActive ? "default" : "outline"}>{statusLabels[item.status]}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Deadline: {item.deadline}</div>
              <div className="text-xs text-muted-foreground">Aktualna wartość: {item.computed.current_value}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default GoalHistorySection;

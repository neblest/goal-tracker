import React, { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetchJson } from "@/lib/api/apiFetchJson";
import { formatDate, formatDateTime } from "@/lib/utils/dateFormat";
import type { GetGoalHistoryResponseDto, GoalHistoryItemDto, GoalStatus } from "@/types";

interface GoalHistorySectionProps {
  goalId: string;
  activeGoalId: string;
}

const statusLabels: Record<GoalStatus, string> = {
  active: "Active",
  completed_success: "Completed (success)",
  completed_failure: "Completed (failure)",
  abandoned: "Abandoned",
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
      const items = response.data.items.slice().sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        return tb - ta; // newest first
      });
      setItems(items);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load history.";
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
      className="rounded-xl border border-[#E5DDD5] bg-white px-6 py-5 shadow-sm"
      aria-label="Goal iteration history"
    >
      <header className="flex items-center justify-between pb-4">
        <div>
          <h3 className="text-base font-semibold text-[#4A3F35]">Iteration history</h3>
          <p className="text-sm text-[#8B7E74]">Chain of related goals.</p>
        </div>
      </header>

      {loading ? <p className="text-sm text-[#8B7E74]">Loading history...</p> : null}
      {error ? <p className="text-sm text-[#C17A6F]">{error}</p> : null}
      {!loading && !error && items.length === 0 ? <p className="text-sm text-[#8B7E74]">No history.</p> : null}

      <div className="max-h-55 overflow-y-auto grid gap-3">
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
              className="flex w-full items-center justify-between rounded-lg border border-[#E5DDD5] bg-[#FAF8F5] px-4 py-3 text-left transition hover:border-[#D4A574] hover:bg-white"
              aria-current={isActive ? "true" : undefined}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <span className="font-semibold text-[#4A3F35] flex-shrink-0 truncate">{item.name}</span>
                <span className="text-sm text-[#8B7E74] flex-shrink-0">Progress {item.computed.current_value}</span>
                <span className="text-sm text-[#8B7E74] flex-shrink-0">
                  {item.status === "active" ? (
                    <>Deadline: {item.deadline}</>
                  ) : (
                    <>
                      Completion date:{" "}
                      {item.updated_at ? formatDate(item.updated_at) : item.deadline}
                    </>
                  )}
                </span>
              </div>
              <Badge variant={isActive ? "default" : "outline"} className="flex-shrink-0 ml-4">
                {statusLabels[item.status]}
              </Badge>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default GoalHistorySection;

import React, { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type {
  AbandonGoalCommand,
  AbandonGoalResponseDto,
  ContinueGoalCommand,
  ContinueGoalResponseDto,
  GoalStatus,
  RetryGoalCommand,
  RetryGoalResponseDto,
} from "@/types";

interface GoalActionsSectionProps {
  goalId: string;
  status: GoalStatus;
  defaultName: string;
  defaultTargetValue: string;
  defaultDeadline: string;
  onStatusChanged?: (status: GoalStatus) => void;
  onGoalCreated?: (newGoalId: string) => void;
}

export function GoalActionsSection({
  goalId,
  status,
  defaultName,
  defaultTargetValue,
  defaultDeadline,
  onStatusChanged,
  onGoalCreated,
}: GoalActionsSectionProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [abandonReason, setAbandonReason] = useState("");
  const [restartDraft, setRestartDraft] = useState({
    name: defaultName,
    target_value: defaultTargetValue,
    deadline: defaultDeadline,
  });

  const handleAbandon = useCallback(async () => {
    setFormError(null);
    if (abandonReason.trim().length === 0) {
      setFormError("Reason is required.");
      return;
    }
    setPending(true);
    try {
      const command: AbandonGoalCommand = { reason: abandonReason.trim() as AbandonGoalCommand["reason"] };
      const response = await apiFetchJson<AbandonGoalResponseDto>(`/api/goals/${goalId}/abandon`, {
        method: "POST",
        body: JSON.stringify(command),
      });
      if (onStatusChanged) {
        onStatusChanged(response.data.goal.status);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError("Failed to abandon goal.");
      }
    } finally {
      setPending(false);
    }
  }, [abandonReason, goalId, onStatusChanged]);

  const handleRestart = useCallback(
    async (mode: "retry" | "continue") => {
      setFormError(null);
      const commandBase = {
        target_value: restartDraft.target_value.trim(),
        deadline: restartDraft.deadline.trim(),
        name: restartDraft.name.trim(),
      };

      if (!commandBase.target_value || Number.parseFloat(commandBase.target_value) <= 0) {
        setFormError("Enter a positive target value.");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(commandBase.deadline)) {
        setFormError("Enter deadline in YYYY-MM-DD format.");
        return;
      }

      setPending(true);
      try {
        if (mode === "retry") {
          const command: RetryGoalCommand = {
            target_value: commandBase.target_value,
            deadline: commandBase.deadline,
            name: commandBase.name || undefined,
          };
          const response = await apiFetchJson<RetryGoalResponseDto>(`/api/goals/${goalId}/retry`, {
            method: "POST",
            body: JSON.stringify(command),
          });
          if (onGoalCreated) {
            onGoalCreated(response.data.goal.id);
          }
        } else {
          const command: ContinueGoalCommand = {
            target_value: commandBase.target_value,
            deadline: commandBase.deadline,
            name: commandBase.name || defaultName,
          };
          const response = await apiFetchJson<ContinueGoalResponseDto>(`/api/goals/${goalId}/continue`, {
            method: "POST",
            body: JSON.stringify(command),
          });
          if (onGoalCreated) {
            onGoalCreated(response.data.goal.id);
          }
        }
      } catch (error) {
        if (error instanceof ApiError) {
          setFormError(error.message);
        } else if (error instanceof Error) {
          setFormError(error.message);
        } else {
          setFormError("Failed to perform action.");
        }
      } finally {
        setPending(false);
      }
    },
    [defaultName, goalId, onGoalCreated, restartDraft.deadline, restartDraft.name, restartDraft.target_value]
  );

  if (status === "active") {
    return (
      <section className="rounded-xl border border-[#E5DDD5] bg-white px-6 py-5 shadow-sm" aria-label="Goal actions">
        <header className="flex items-center justify-between pb-3">
          <div>
            <h3 className="text-base font-semibold text-[#4A3F35]">Actions</h3>
            <p className="text-sm text-[#8B7E74]">Abandon the goal if it is no longer relevant.</p>
          </div>
        </header>
        {formError ? <p className="mb-2 text-sm text-[#C17A6F]">{formError}</p> : null}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#4A3F35]" htmlFor="abandon-reason">
            Reason for abandonment
          </label>
          <Textarea
            id="abandon-reason"
            value={abandonReason}
            onChange={(event) => setAbandonReason(event.target.value)}
            rows={3}
            aria-invalid={Boolean(formError)}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            variant="destructive"
            onClick={handleAbandon}
            disabled={pending}
            className="bg-[#C17A6F] hover:bg-[#B0685D] text-white"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Abandon goal"}
          </Button>
        </div>
      </section>
    );
  }

  if (status === "completed_success" || status === "completed_failure") {
    const actionLabel = status === "completed_success" ? "Continue" : "Try again";
    const mode = status === "completed_success" ? "continue" : "retry";

    return (
      <section className="rounded-xl border border-[#E5DDD5] bg-white px-6 py-5 shadow-sm" aria-label="Goal actions">
        <header className="flex items-center justify-between pb-3">
          <div>
            <h3 className="text-base font-semibold text-[#4A3F35]">Actions</h3>
            <p className="text-sm text-[#8B7E74]">Create another iteration of the goal.</p>
          </div>
        </header>
        {formError ? <p className="mb-2 text-sm text-[#C17A6F]">{formError}</p> : null}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#4A3F35]" htmlFor="restart-name">
              Name
            </label>
            <Input
              id="restart-name"
              value={restartDraft.name}
              onChange={(event) => setRestartDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#4A3F35]" htmlFor="restart-target">
              Target value
            </label>
            <Input
              id="restart-target"
              value={restartDraft.target_value}
              onChange={(event) => setRestartDraft((prev) => ({ ...prev, target_value: event.target.value }))}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#4A3F35]" htmlFor="restart-deadline">
              Deadline (dd.MM.yyyy)
            </label>
            <Input
              id="restart-deadline"
              type="text"
              value={restartDraft.deadline}
              onChange={(event) => setRestartDraft((prev) => ({ ...prev, deadline: event.target.value }))}
              placeholder="31.12.2024"
              maxLength={10}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            onClick={() => handleRestart(mode)}
            disabled={pending}
            className="bg-[#D4A574] hover:bg-[#C9965E] text-white"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : actionLabel}
          </Button>
        </div>
      </section>
    );
  }

  return null;
}

export default GoalActionsSection;

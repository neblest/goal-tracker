import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/apiFetchJson";
import { normalizeTrim, validateDeadlineFuture, validateGoalName, validateTargetValue } from "@/lib/goals/validation";
import type { GoalStatus, UpdateGoalCommand } from "@/types";

interface GoalMetricsSectionProps {
  goalName: string;
  deadline: string;
  targetValue: string;
  currentValueText: string;
  targetValueText: string;
  progressPercent: number;
  daysRemaining: number;
  showDaysRemaining: boolean;
  goalStatus: GoalStatus;
  isLocked: boolean;
  goalId?: string;
  onSubmit: (command: UpdateGoalCommand) => Promise<void>;
  onAbandon: (reason: string) => Promise<void>;
  onComplete?: () => Promise<void>;
}

export function GoalMetricsSection({
  goalName,
  deadline,
  targetValue,
  currentValueText,
  targetValueText,
  progressPercent,
  daysRemaining,
  showDaysRemaining,
  goalStatus,
  isLocked,
  goalId,
  onSubmit,
  onAbandon,
  onComplete,
}: GoalMetricsSectionProps) {
  const baseId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [isAbandonModalOpen, setIsAbandonModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [formState, setFormState] = useState({ name: goalName, target_value: targetValue, deadline });
  const [errors, setErrors] = useState<{ name?: string; target_value?: string; deadline?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setFormState({ name: goalName, target_value: targetValue, deadline });
    setErrors({});
  }, [goalName, targetValue, deadline]);

  const handleChange = useCallback(<K extends keyof typeof formState>(field: K, value: (typeof formState)[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const hasChanges = useMemo(() => {
    return formState.name !== goalName || formState.target_value !== targetValue || formState.deadline !== deadline;
  }, [formState, goalName, targetValue, deadline]);

  const validate = useCallback(() => {
    const newErrors: typeof errors = {};
    const nameError = validateGoalName(formState.name);
    if (nameError) newErrors.name = nameError;
    const targetError = validateTargetValue(formState.target_value);
    if (targetError) newErrors.target_value = targetError;
    const deadlineError = validateDeadlineFuture(formState.deadline);
    if (deadlineError) newErrors.deadline = deadlineError;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formState]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!validate()) return;
      setSubmitting(true);
      try {
        const command: UpdateGoalCommand = {};
        if (formState.name !== goalName) command.name = normalizeTrim(formState.name);
        if (formState.target_value !== targetValue) command.target_value = formState.target_value;
        if (formState.deadline !== deadline) command.deadline = formState.deadline;
        await onSubmit(command);
        setSuccessMessage("Zapisano zmiany");
        setTimeout(() => setSuccessMessage(null), 3000);
        setIsEditing(false);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrors({ form: error.message });
        } else {
          setErrors({ form: "Wystąpił błąd podczas zapisywania." });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [validate, formState, goalName, targetValue, deadline, onSubmit]
  );

  const handleCancel = useCallback(() => {
    setFormState({ name: goalName, target_value: targetValue, deadline });
    setErrors({});
    setIsEditing(false);
  }, [goalName, targetValue, deadline]);

  const handleAbandon = useCallback(async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      await onAbandon(selectedReason);
      setIsAbandonModalOpen(false);
      setSelectedReason("");
    } catch (error) {
      // Error handling can be added if needed
    } finally {
      setSubmitting(false);
    }
  }, [selectedReason, onAbandon]);

  const clampedPercent = useMemo(() => Math.min(Math.max(progressPercent, 0), 100), [progressPercent]);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedPercent / 100) * circumference;
  const [completing, setCompleting] = useState(false);

  const canShowCompleteButton = goalStatus === "active" && clampedPercent >= 100;

  return (
    <>
      <section aria-label="Postęp celu" className="rounded-xl border border-[#E5DDD5] bg-white px-6 py-5 shadow-sm">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <header className="pb-4">
              <h3 className="text-base font-semibold text-[#4A3F35]">Edytuj szczegóły celu</h3>
            </header>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`${baseId}-name`} className="text-[#4A3F35]">
                  Nazwa
                </Label>
                <Input
                  id={`${baseId}-name`}
                  value={formState.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${baseId}-name-error` : undefined}
                  maxLength={500}
                />
                {errors.name ? (
                  <p id={`${baseId}-name-error`} className="text-sm text-[#C17A6F]">
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${baseId}-target`} className="text-[#4A3F35]">
                  Wartość docelowa
                </Label>
                <Input
                  id={`${baseId}-target`}
                  value={formState.target_value}
                  onChange={(event) => handleChange("target_value", event.target.value)}
                  inputMode="decimal"
                  aria-invalid={Boolean(errors.target_value)}
                  aria-describedby={errors.target_value ? `${baseId}-target-error` : undefined}
                />
                {errors.target_value ? (
                  <p id={`${baseId}-target-error`} className="text-sm text-[#C17A6F]">
                    {errors.target_value}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${baseId}-deadline`} className="text-[#4A3F35]">
                  Termin
                </Label>
                <Input
                  id={`${baseId}-deadline`}
                  type="date"
                  value={formState.deadline}
                  onChange={(event) => handleChange("deadline", event.target.value)}
                  aria-invalid={Boolean(errors.deadline)}
                  aria-describedby={errors.deadline ? `${baseId}-deadline-error` : undefined}
                />
                {errors.deadline ? (
                  <p id={`${baseId}-deadline-error`} className="text-sm text-[#C17A6F]">
                    {errors.deadline}
                  </p>
                ) : null}
              </div>
            </div>

            {errors.form ? <p className="text-sm text-[#C17A6F]">{errors.form}</p> : null}

            {successMessage ? <p className="text-sm text-[#9CAA7F]">{successMessage}</p> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting}>
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={submitting || !hasChanges}
                className="bg-[#D4A574] hover:bg-[#C9965E] text-white"
              >
                {submitting ? "Zapisywanie..." : "Zapisz"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <header className="flex items-center justify-between pb-4">
              <h3 className="text-base font-semibold text-[#4A3F35]">{goalName}</h3>
              <div className="flex items-center gap-4">
                <div className="text-sm text-[#8B7E74]">
                  Data zakończenia: {new Date(deadline).toLocaleDateString("pl-PL")}
                </div>
                {goalStatus === "active" ? (
                  <>
                    <Button
                      disabled={isLocked}
                      onClick={() => setIsEditing(true)}
                      variant="outline"
                      size="sm"
                      title={isLocked ? "Edycja jest zablokowana z powodu trwającego progresu" : undefined}
                    >
                      Edytuj
                    </Button>
                    <Button
                      onClick={() => setIsAbandonModalOpen(true)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Porzuć
                    </Button>
                  </>
                ) : goalStatus === "completed_success" ? (
                  <>
                    <Button
                      onClick={() => {
                        const params = new URLSearchParams();
                        if (goalId) params.set("parent_goal_id", goalId);
                        if (goalName) params.set("name", goalName);
                        if (targetValue) params.set("target_value", targetValue);
                        // Do not prefill deadline for continued or retried goals
                        window.location.href = `/app/goals/new?${params.toString()}`;
                      }}
                      variant="outline"
                      size="sm"
                      className="text-[#D4A574] hover:text-[#C9965E]"
                    >
                      Kontynuuj
                    </Button>
                  </>
                ) : goalStatus === "completed_failure" ? (
                  // For failed goals allow retry by creating a linked goal
                  <>
                    <Button
                      onClick={() => {
                        const params = new URLSearchParams();
                        if (goalId) params.set("parent_goal_id", goalId);
                        if (goalName) params.set("name", goalName);
                        if (targetValue) params.set("target_value", targetValue);
                        // Do not prefill deadline for continued or retried goals
                        // mark that this is a retry
                        params.set("retry", "1");
                        window.location.href = `/app/goals/new?${params.toString()}`;
                      }}
                      variant="outline"
                      size="sm"
                      className="text-[#C17A6F] hover:text-[#A85B50]"
                    >
                      Ponów
                    </Button>
                  </>
                ) : null}
              </div>
            </header>

            <div className="grid items-center gap-6 md:grid-cols-[180px_1fr]">
              <div className="relative flex items-center justify-center">
                {canShowCompleteButton ? (
                  <Button
                    onClick={async () => {
                      if (!onComplete || completing) return;
                      try {
                        setCompleting(true);
                        await onComplete();
                      } finally {
                        setCompleting(false);
                      }
                    }}
                    aria-label="Zakończ cel"
                    disabled={completing}
                    className={`size-36 flex flex-col items-center justify-center rounded-full gap-0 bg-[#D4A574] hover:bg-[#C9965E] text-white font-semibold`}
                  >
                    {completing ? (
                      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                    ) : (
                      <>
                        <span className="text-lg">Zakończ!</span>
                        <span className="text-xs font-normal">Cel osiągnięty</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <svg className="size-36" viewBox="0 0 160 160" role="img" aria-label={`Postęp ${clampedPercent}%`}>
                      <circle
                        className="text-[#E5DDD5]"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        r={radius}
                        cx="80"
                        cy="80"
                        opacity={0.5}
                      />
                      <circle
                        className="text-[#D4A574]"
                        stroke="currentColor"
                        strokeWidth="12"
                        strokeLinecap="round"
                        fill="transparent"
                        r={radius}
                        cx="80"
                        cy="80"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        transform="rotate(-90 80 80)"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-lg font-semibold text-[#4A3F35]">
                      <span>{Math.round(clampedPercent)}%</span>
                      <span className="text-xs text-[#8B7E74]">postępu</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="text-lg font-semibold text-[#4A3F35]">
                  {currentValueText} / {targetValueText}
                </div>
                {showDaysRemaining ? (
                  <div className="inline-flex w-fit items-center gap-2 rounded-md bg-[#D4A574]/10 px-3 py-1.5 text-sm font-medium text-[#4A3F35]">
                    <CalendarClock className="size-4 text-[#D4A574]" aria-hidden="true" />
                    Pozostało {daysRemaining} dni
                  </div>
                ) : goalStatus !== "active" ? (
                  <div
                    className={`inline-flex w-fit items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${
                      goalStatus === "completed_success"
                        ? "bg-[#9CAA7F]/10 text-[#9CAA7F]"
                        : goalStatus === "completed_failure"
                          ? "bg-[#C17A6F]/10 text-[#C17A6F]"
                          : "bg-[#8B7E74]/10 text-[#8B7E74]"
                    }`}
                  >
                    {goalStatus === "completed_success"
                      ? "Ukończony pomyślnie"
                      : goalStatus === "completed_failure"
                        ? "Ukończony niepowodzeniem"
                        : "Porzucony"}
                  </div>
                ) : null}
                <p className="text-sm text-[#8B7E74]">
                  Postęp jest obliczany na podstawie sumy wpisów progresu względem wartości docelowej.
                </p>
              </div>
            </div>
          </>
        )}
      </section>

      <Dialog open={isAbandonModalOpen} onOpenChange={setIsAbandonModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Porzuć cel</DialogTitle>
            <DialogDescription>Czy na pewno chcesz porzucić cel? Wybierz powód:</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="abandon-reason">Powód</Label>
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger id="abandon-reason">
                  <SelectValue placeholder="Wybierz powód" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Brak czasu">Brak czasu</SelectItem>
                  <SelectItem value="Nierealistyczny cel">Nierealistyczny cel</SelectItem>
                  <SelectItem value="Zmiana priorytetu">Zmiana priorytetu</SelectItem>
                  <SelectItem value="Inne">Inne</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAbandonModalOpen(false)} disabled={submitting}>
                Anuluj
              </Button>
              <Button
                onClick={handleAbandon}
                disabled={submitting || !selectedReason}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {submitting ? "Porzucanie..." : "Porzuć"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default GoalMetricsSection;

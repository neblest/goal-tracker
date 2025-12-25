import React, { useCallback, useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/apiFetchJson";
import { normalizeTrim, validateDeadlineFuture, validateGoalName, validateTargetValue } from "@/lib/goals/validation";
import type { GoalStatus, UpdateGoalCommand } from "@/types";

interface GoalEditableFieldsSectionProps {
  name: string;
  targetValue: string;
  deadline: string;
  goalStatus: GoalStatus;
  isLocked: boolean;
  isEditing: boolean;
  onToggleEditing: () => void;
  onSubmit: (command: UpdateGoalCommand) => Promise<void>;
}

interface FormErrors {
  name?: string;
  target_value?: string;
  deadline?: string;
  form?: string;
}

export function GoalEditableFieldsSection({
  name,
  targetValue,
  deadline,
  goalStatus,
  isLocked,
  isEditing,
  onToggleEditing,
  onSubmit,
}: GoalEditableFieldsSectionProps) {
  const baseId = useId();
  const [formState, setFormState] = useState({ name, target_value: targetValue, deadline });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setFormState({ name, target_value: targetValue, deadline });
    setErrors({});
    setFormError(null);
  }, [name, targetValue, deadline]);

  const handleChange = useCallback(<K extends keyof typeof formState>(field: K, value: (typeof formState)[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete (next as Record<string, string | undefined>)[field];
      return next;
    });
    setFormError(null);
    setSuccessMessage(null);
  }, []);

  const validate = useCallback(() => {
    const nextErrors: FormErrors = {};
    const nameError = validateGoalName(formState.name);
    if (nameError) nextErrors.name = nameError;

    const targetError = validateTargetValue(formState.target_value);
    if (targetError) nextErrors.target_value = targetError;

    const deadlineError = validateDeadlineFuture(formState.deadline);
    if (deadlineError) nextErrors.deadline = deadlineError;

    return nextErrors;
  }, [formState.deadline, formState.name, formState.target_value]);

  const hasChanges = useMemo(() => {
    return formState.name !== name || formState.target_value !== targetValue || formState.deadline !== deadline;
  }, [deadline, formState.deadline, formState.name, formState.target_value, name, targetValue]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (isLocked) {
        return;
      }

      const nextErrors = validate();
      setErrors(nextErrors);
      setFormError(null);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      if (!hasChanges) {
        return;
      }

      const command: UpdateGoalCommand = {
        name: normalizeTrim(formState.name),
        target_value: normalizeTrim(formState.target_value),
        deadline: normalizeTrim(formState.deadline),
      };

      setSubmitting(true);
      try {
        await onSubmit(command);
        setSuccessMessage("Zapisano zmiany.");
      } catch (error) {
        if (error instanceof ApiError) {
          setFormError(error.message);
        } else if (error instanceof Error) {
          setFormError(error.message);
        } else {
          setFormError("Nie udało się zapisać.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [formState.deadline, formState.name, formState.target_value, hasChanges, isLocked, onSubmit, validate]
  );

  return (
    <section
      className="rounded-xl border border-[#E5DDD5] bg-white px-6 py-5 shadow-sm"
      aria-label="Edycja danych celu"
    >
      <header className="flex items-center justify-between gap-3 pb-4">
        <div>
          <h3 className="text-base font-semibold text-[#4A3F35]">Edytuj cel</h3>
          <p className="text-sm text-[#8B7E74]">
            Nazwa, wartość docelowa i termin są edytowalne do pierwszego wpisu progresu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {goalStatus === "active" ? (
            isLocked ? (
              <Button disabled variant="outline" size="sm" title="Edycja jest zablokowana z powodu trwającego progresu">
                Edytuj
              </Button>
            ) : !isEditing ? (
              <Button onClick={onToggleEditing} variant="outline" size="sm">
                Edytuj
              </Button>
            ) : null
          ) : null}
        </div>
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${baseId}-name`} className="text-[#4A3F35]">
              Nazwa
            </Label>
            <span className="text-[11px] text-[#8B7E74]">{formState.name.trim().length}/500</span>
          </div>
          <Input
            id={`${baseId}-name`}
            value={formState.name}
            onChange={(event) => handleChange("name", event.target.value)}
            disabled={isLocked || !isEditing}
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

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${baseId}-target`} className="text-[#4A3F35]">
              Wartość docelowa
            </Label>
            <Input
              id={`${baseId}-target`}
              value={formState.target_value}
              onChange={(event) => handleChange("target_value", event.target.value)}
              disabled={isLocked || !isEditing}
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
              disabled={isLocked || !isEditing}
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

        {formError ? (
          <div
            className="flex items-start gap-2 rounded-md border border-[#C17A6F]/40 bg-[#C17A6F]/10 px-3 py-2 text-sm text-[#C17A6F]"
            aria-live="polite"
            role="status"
          >
            <span>{formError}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div
            className="flex items-start gap-2 rounded-md border border-[#9CAA7F]/60 bg-[#9CAA7F]/10 px-3 py-2 text-sm text-[#4A3F35]"
            aria-live="polite"
            role="status"
          >
            <span>{successMessage}</span>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            disabled={isLocked || !isEditing || submitting || !hasChanges}
            className="bg-[#D4A574] hover:bg-[#C9965E] text-white"
          >
            {submitting ? "Zapisywanie..." : "Zapisz zmiany"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export default GoalEditableFieldsSection;

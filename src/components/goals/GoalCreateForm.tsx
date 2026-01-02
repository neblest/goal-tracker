import React, { useCallback, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/apiFetchJson";
import { normalizeTrim, validateDeadlineFuture, validateGoalName, validateTargetValue } from "@/lib/goals/validation";
import type { CreateGoalCommand } from "@/types";

export interface GoalCreateFormVm {
  name: string;
  target_value: string;
  deadline: string;
  parent_goal_id?: string | null;
}

export interface GoalCreateFormErrors {
  name?: string;
  target_value?: string;
  deadline?: string;
  form?: string;
}

interface GoalCreateFormProps {
  initialValues?: Partial<GoalCreateFormVm>;
  isSubmitting?: boolean;
  onSubmit: (command: CreateGoalCommand) => Promise<void> | void;
  onCancel?: () => void;
}

function validate(values: GoalCreateFormVm): GoalCreateFormErrors {
  const errors: GoalCreateFormErrors = {};

  const nameError = validateGoalName(values.name);
  if (nameError) errors.name = nameError;

  const targetError = validateTargetValue(values.target_value);
  if (targetError) errors.target_value = targetError;

  const deadlineError = validateDeadlineFuture(values.deadline.trim());
  if (deadlineError) errors.deadline = deadlineError;

  return errors;
}

export function GoalCreateForm({ initialValues, isSubmitting = false, onSubmit, onCancel }: GoalCreateFormProps) {
  const baseId = useId();
  const [values, setValues] = useState<GoalCreateFormVm>({
    name: initialValues?.name ?? "",
    target_value: initialValues?.target_value ?? "",
    deadline: initialValues?.deadline ?? "",
    parent_goal_id: initialValues?.parent_goal_id ?? undefined,
  });
  const [errors, setErrors] = useState<GoalCreateFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = useCallback(<K extends keyof GoalCreateFormVm>(field: K, value: GoalCreateFormVm[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete (next as Record<string, string | undefined>)[field as string];
      return next;
    });
    setFormError(null);
  }, []);

  const hasErrors = useMemo(
    () => Boolean(errors.name || errors.target_value || errors.deadline || errors.form),
    [errors]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextErrors = validate(values);
      setErrors(nextErrors);
      setFormError(null);

      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      const command: CreateGoalCommand = {
        name: values.name.trim(),
        target_value: normalizeTrim(values.target_value),
        deadline: normalizeTrim(values.deadline),
      };

      if (values.parent_goal_id) {
        command.parent_goal_id = values.parent_goal_id;
      }

      setSubmitting(true);
      try {
        await onSubmit(command);
      } catch (error) {
        if (error instanceof ApiError) {
          setFormError(error.message);
        } else if (error instanceof Error) {
          setFormError(error.message);
        } else {
          setFormError("Failed to save.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [values, onSubmit]
  );

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${baseId}-name`} className="text-sm font-medium text-[#4A3F35]">
            Name
          </Label>
          <span className="text-[11px] text-[#8B7E74]">{values.name.trim().length}/50</span>
        </div>
        <Input
          id={`${baseId}-name`}
          name="name"
          value={values.name}
          onChange={(event) => handleChange("name", event.target.value)}
          placeholder="Goal name"
          maxLength={50}
          required
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${baseId}-name-error` : undefined}
        />
        {errors.name ? (
          <p id={`${baseId}-name-error`} className="text-sm text-[#C17A6F]">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${baseId}-target`} className="text-sm font-medium text-[#4A3F35]">
            Target value
          </Label>
          <Input
            id={`${baseId}-target`}
            name="target_value"
            inputMode="decimal"
            value={values.target_value}
            onChange={(event) => handleChange("target_value", event.target.value)}
            placeholder="e.g. 1000"
            required
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
          <Label htmlFor={`${baseId}-deadline`} className="text-sm font-medium text-[#4A3F35]">
            Deadline
          </Label>
          <Input
            id={`${baseId}-deadline`}
            name="deadline"
            type="date"
            value={values.deadline}
            onChange={(event) => handleChange("deadline", event.target.value)}
            required
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
          role="status"
          aria-live="polite"
        >
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting || submitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting || submitting || hasErrors}>
          {isSubmitting || submitting ? "Saving..." : "Create goal"}
        </Button>
      </div>
    </form>
  );
}

export default GoalCreateForm;

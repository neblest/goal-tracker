import React, { useCallback, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GoalCreateForm from "@/components/goals/GoalCreateForm";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type { CreateGoalCommand, CreateGoalResponseDto } from "@/types";

export default function GoalCreateModalPage() {
  const [open, setOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  type InitialValues = Partial<{
    name: string;
    target_value: string;
    deadline: string;
    parent_goal_id: string | null;
  }>;

  const [initialValues] = useState<InitialValues>(() => {
    try {
      const params =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const iv: InitialValues = {};
      const name = params.get("name");
      const target_value = params.get("target_value");
      const deadline = params.get("deadline");
      const parent_goal_id = params.get("parent_goal_id");
      if (name) iv.name = name;
      if (target_value) iv.target_value = target_value;
      if (deadline) iv.deadline = deadline;
      if (parent_goal_id) iv.parent_goal_id = parent_goal_id;
      return iv;
    } catch (e) {
      return {} as InitialValues;
    }
  });

  const navigateBack = useCallback(() => {
    window.location.href = "/app/goals";
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        navigateBack();
      }
    },
    [navigateBack]
  );

  const handleSubmit = useCallback(
    async (command: CreateGoalCommand) => {
      setIsSubmitting(true);
      try {
        await apiFetchJson<CreateGoalResponseDto>("/api/goals", {
          method: "POST",
          body: JSON.stringify(command),
        });
        navigateBack();
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        if (error instanceof Error) {
          throw new Error(error.message);
        }

        throw new Error("Nie udało się utworzyć celu.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigateBack]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-2xl p-0 sm:p-0 bg-white border-[#E5DDD5]">
        <div className="flex flex-col gap-4 p-6 sm:p-7">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-[#4A3F35]">Utwórz nowy cel</DialogTitle>
            <DialogDescription className="text-[#8B7E74]">
              Uzupełnij dane, aby rozpocząć śledzenie nowego celu.
            </DialogDescription>
          </DialogHeader>

          <GoalCreateForm
            initialValues={initialValues}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={() => handleOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

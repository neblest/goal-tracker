import React, { useCallback, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GoalCreateForm from "@/components/goals/GoalCreateForm";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type { CreateGoalCommand, CreateGoalResponseDto } from "@/types";

export default function GoalCreateModalPage() {
  const [open, setOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <DialogContent className="w-full max-w-2xl p-0 sm:p-0">
        <div className="flex flex-col gap-4 p-6 sm:p-7">
          <DialogHeader className="space-y-2">
            <DialogTitle>Utwórz nowy cel</DialogTitle>
            <DialogDescription>Uzupełnij dane, aby rozpocząć śledzenie nowego celu.</DialogDescription>
          </DialogHeader>

          <GoalCreateForm
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={() => handleOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

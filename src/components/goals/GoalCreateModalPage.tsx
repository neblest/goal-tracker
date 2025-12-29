import React, { useCallback, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GoalCreateForm from "@/components/goals/GoalCreateForm";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type { CreateGoalCommand, CreateGoalResponseDto } from "@/types";

type InitialValues = Partial<{
  name: string;
  target_value: string;
  deadline: string;
  parent_goal_id: string | null;
}>;

interface GoalCreateModalPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: InitialValues;
  onSuccess?: () => void;
}

export default function GoalCreateModalPage({
  open,
  onOpenChange,
  initialValues = {},
  onSuccess,
}: GoalCreateModalPageProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (command: CreateGoalCommand) => {
      setIsSubmitting(true);
      try {
        const response = await apiFetchJson<CreateGoalResponseDto>("/api/goals", {
          method: "POST",
          body: JSON.stringify(command),
        });
        onOpenChange(false);
        const newGoalId = response.data.goal.id;
        window.location.href = `/app/goals/${newGoalId}`;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        if (error instanceof Error) {
          throw new Error(error.message);
        }

        throw new Error("Failed to create goal.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl p-0 sm:p-0 bg-white border-[#E5DDD5]">
        <div className="flex flex-col gap-4 p-6 sm:p-7">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-[#4A3F35]">Create new goal</DialogTitle>
            <DialogDescription className="text-[#8B7E74]">
              Fill in the details to start tracking a new goal.
            </DialogDescription>
          </DialogHeader>

          <GoalCreateForm
            initialValues={initialValues}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

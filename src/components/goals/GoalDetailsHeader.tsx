import React from "react";
import { ArrowLeft, TimerReset } from "lucide-react";

import { Button } from "@/components/ui/button";

interface GoalDetailsHeaderProps {
  onClose: () => void;
}

export function GoalDetailsHeader({ onClose }: GoalDetailsHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-8 py-4">
      <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#4A3F35]">
        <TimerReset className="size-5 text-[#D4A574]" aria-hidden="true" />
        <span>Goal details</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Back"
        onClick={onClose}
        className="hover:bg-[#D4A574]/10 text-[#4A3F35]"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
      </Button>
    </div>
  );
}

export default GoalDetailsHeader;

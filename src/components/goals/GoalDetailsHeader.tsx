import React, { useMemo } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GoalStatus } from "@/types";

interface GoalDetailsHeaderProps {
  name: string;
  status: GoalStatus;
  onClose: () => void;
}

const statusLabels: Record<GoalStatus, string> = {
  active: "Aktywne",
  completed_success: "Zakończone (sukces)",
  completed_failure: "Zakończone (porażka)",
  abandoned: "Porzucone",
};

export function GoalDetailsHeader({ name, status, onClose }: GoalDetailsHeaderProps) {
  const badgeVariant = useMemo(() => {
    switch (status) {
      case "completed_success":
        return "default" as const;
      case "completed_failure":
        return "destructive" as const;
      case "abandoned":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  }, [status]);

  return (
    <header className="flex items-start justify-between gap-4 border-b border-[#E5DDD5] px-6 pb-4 pt-5 sm:px-7">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold leading-tight text-[#4A3F35]">{name}</h2>
          <Badge variant={badgeVariant}>{statusLabels[status]}</Badge>
        </div>
        <p className="text-sm text-[#8B7E74]">Szczegóły celu i postępy.</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Zamknij"
        onClick={onClose}
        className="hover:bg-[#D4A574]/10 text-[#4A3F35]"
      >
        <X className="size-5" aria-hidden="true" />
      </Button>
    </header>
  );
}

export default GoalDetailsHeader;

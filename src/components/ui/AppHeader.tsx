import React from "react";
import { LogOut, TimerReset } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  title: string;
  userDisplayName: string;
  onLogout: () => void;
}

export function AppHeader({ title, userDisplayName, onLogout }: AppHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-8 py-4">
      <a href="/app/goals" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#4A3F35]">
        <TimerReset className="size-5 text-[#D4A574]" aria-hidden="true" />
        <span>{title}</span>
      </a>
      <div className="flex items-center gap-4">
        <p className="text-sm text-[#8B7E74]">Cześć, {userDisplayName}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="gap-2 border-[#D4A574]/30 text-[#4A3F35] hover:bg-[#D4A574]/10 hover:border-[#D4A574]"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Wyloguj
        </Button>
      </div>
    </div>
  );
}
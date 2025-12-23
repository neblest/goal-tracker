import React, { useMemo } from "react";
import { CalendarClock } from "lucide-react";

interface GoalMetricsSectionProps {
  currentValueText: string;
  targetValueText: string;
  progressPercent: number;
  daysRemaining: number;
  showDaysRemaining: boolean;
}

export function GoalMetricsSection({
  currentValueText,
  targetValueText,
  progressPercent,
  daysRemaining,
  showDaysRemaining,
}: GoalMetricsSectionProps) {
  const clampedPercent = useMemo(() => Math.min(Math.max(progressPercent, 0), 100), [progressPercent]);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <section aria-label="Postęp celu" className="rounded-xl border border-border/70 bg-card px-6 py-5 shadow-sm">
      <div className="grid items-center gap-6 md:grid-cols-[180px_1fr]">
        <div className="relative flex items-center justify-center">
          <svg className="size-36" viewBox="0 0 160 160" role="img" aria-label={`Postęp ${clampedPercent}%`}>
            <circle
              className="text-muted"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              r={radius}
              cx="80"
              cy="80"
              opacity={0.25}
            />
            <circle
              className="text-primary"
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
          <div className="absolute flex flex-col items-center justify-center text-lg font-semibold">
            <span>{Math.round(clampedPercent)}%</span>
            <span className="text-xs text-muted-foreground">postępu</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-lg font-semibold text-foreground">
            {currentValueText} / {targetValueText}
          </div>
          {showDaysRemaining ? (
            <div className="inline-flex w-fit items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
              <CalendarClock className="size-4" aria-hidden="true" />
              Pozostało {daysRemaining} dni
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Postęp jest obliczany na podstawie sumy wpisów progresu względem wartości docelowej.
          </p>
        </div>
      </div>
    </section>
  );
}

export default GoalMetricsSection;

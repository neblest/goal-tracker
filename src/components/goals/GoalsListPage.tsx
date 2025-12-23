import React, { useMemo } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Loader2,
  LogOut,
  Plus,
  Search,
  TimerReset,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/types";

import { useGoalsList } from "../hooks/useGoalsList";
import type { GoalCardVm } from "../hooks/useGoalsList";

const statusLabels: Record<GoalStatus, string> = {
  active: "Aktywne",
  completed_success: "Zakończone",
  completed_failure: "Niezakończone",
  abandoned: "Porzucone",
};

const sortLabels: Record<"created_at" | "deadline", string> = {
  created_at: "Data utworzenia",
  deadline: "Deadline",
};

const orderLabels: Record<"asc" | "desc", string> = {
  asc: "Rosnąco",
  desc: "Malejąco",
};

export default function GoalsListPage() {
  const goals = useGoalsList();

  const handleLogout = React.useCallback(() => {
    window.location.href = "/login";
  }, []);

  const handleCreateGoal = React.useCallback(() => {
    window.location.href = "/app/goals/new";
  }, []);

  const showEmpty = !goals.isInitialLoading && goals.items.length === 0 && !goals.error;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/40 to-background text-foreground">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur">
        <AppHeader userDisplayName="Użytkowniku" onLogout={handleLogout} />
      </header>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-6 pb-12 pt-4">
        <GoalsListControls
          status={goals.filters.status}
          search={goals.filters.search}
          sort={goals.filters.sort}
          order={goals.filters.order}
          onStatusChange={goals.handlers.setStatus}
          onSearchChange={goals.handlers.setSearch}
          onSortChange={goals.handlers.setSort}
          onOrderChange={goals.handlers.setOrder}
        />
        {goals.error ? <ErrorBanner error={goals.error} onRetry={goals.handlers.retry} /> : null}

        {goals.isInitialLoading ? <LoadingState /> : null}

        {showEmpty ? <EmptyState onCreateGoal={handleCreateGoal} /> : null}

        {goals.items.length > 0 ? <GoalsGrid items={goals.items} /> : null}

        <LoadMoreSection
          canLoadMore={goals.canLoadMore}
          isLoading={goals.isLoadingMore}
          onLoadMore={goals.handlers.loadMore}
        />
      </div>
    </div>
  );
}

interface AppHeaderProps {
  userDisplayName: string;
  onLogout: () => void;
}

function AppHeader({ userDisplayName, onLogout }: AppHeaderProps) {
  return (
    <div className="border-b border-border/70">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        <a href="/app/goals" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <TimerReset className="size-5" aria-hidden="true" />
          <span>Lista celów</span>
        </a>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">Cześć, {userDisplayName}</p>
          <Button variant="outline" size="sm" onClick={onLogout} className="gap-2">
            <LogOut className="size-4" aria-hidden="true" />
            Wyloguj
          </Button>
        </div>
      </div>
    </div>
  );
}

interface GoalsListControlsProps {
  status: GoalStatus;
  search: string;
  sort: "created_at" | "deadline";
  order: "asc" | "desc";
  onStatusChange: (status: GoalStatus) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (sort: "created_at" | "deadline") => void;
  onOrderChange: (order: "asc" | "desc") => void;
}

function GoalsListControls({
  status,
  search,
  sort,
  order,
  onStatusChange,
  onSearchChange,
  onSortChange,
  onOrderChange,
}: GoalsListControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="group relative flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 shadow-sm">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="Szukaj celu"
            placeholder="Szukaj po nazwie"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            maxLength={200}
            className="border-0 bg-transparent px-0 shadow-none outline-none ring-0 focus-visible:ring-0"
          />
          <span className="absolute right-3 text-[11px] text-muted-foreground">{search.trim().length}/200</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <Select value={status} onValueChange={(value) => onStatusChange(value as GoalStatus)}>
            <SelectTrigger aria-label="Filtruj po statusie">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Sortowanie</label>
          <div className="grid grid-cols-2 gap-2">
            <Select value={sort} onValueChange={(value) => onSortChange(value as "created_at" | "deadline")}>
              <SelectTrigger aria-label="Sortuj">
                <SelectValue placeholder="Sortuj" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sortLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={order} onValueChange={(value) => onOrderChange(value as "asc" | "desc")}>
              <SelectTrigger aria-label="Kolejność sortowania">
                <SelectValue placeholder="Kolejność" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(orderLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ErrorBannerProps {
  error: { message: string };
  onRetry: () => void;
}

function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  return (
    <div
      className="mt-3 flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      aria-live="polite"
    >
      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{error.message}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Spróbuj ponownie
      </Button>
    </div>
  );
}

function GoalsGrid({ items }: { items: GoalCardVm[] }) {
  return (
    <section aria-label="Cele" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <GoalCard key={item.id} item={item} />
      ))}
      {items.length > 0 && (
        <Card className="h-full border-dashed border-2 border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors">
          <CardContent className="flex items-center justify-center h-full min-h-[200px]">
            <Button onClick={() => (window.location.href = "/app/goals/new")} className="aspect-square p-4 text-lg">
              +
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function GoalCard({ item }: { item: GoalCardVm }) {
  const clampedPercent = Math.min(Math.max(item.progressPercent, 0), 100);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedPercent / 100) * circumference;

  const statusVariant = useMemo(() => {
    switch (item.status) {
      case "completed_success":
        return "default" as const;
      case "completed_failure":
        return "destructive" as const;
      case "abandoned":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  }, [item.status]);

  const statusIcon = useMemo(() => {
    switch (item.status) {
      case "completed_success":
        return <CheckCircle2 className="size-4 text-green-600" aria-hidden="true" />;
      case "completed_failure":
        return <XCircle className="size-4 text-red-600" aria-hidden="true" />;
      case "abandoned":
        return <CircleAlert className="size-4 text-yellow-600" aria-hidden="true" />;
      default:
        return <TimerReset className="size-4" aria-hidden="true" />;
    }
  }, [item.status]);

  return (
    <a href={item.href} className="group block focus:outline-none">
      <Card className="h-full border-border/70 shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CardTitle className="line-clamp-2 text-base font-semibold leading-tight flex-1 min-w-0">
              {item.name}
            </CardTitle>
            <div className="flex items-center gap-1 text-sm shrink-0">
              {statusIcon}
              <span>{statusLabels[item.status]}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="relative flex items-center justify-center">
            <svg className="size-20" viewBox="0 0 80 80" aria-hidden="true">
              <circle
                className="text-muted"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                r={radius}
                cx="40"
                cy="40"
                opacity={0.25}
              />
              <circle
                className="text-primary"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                fill="transparent"
                r={radius}
                cx="40"
                cy="40"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-sm font-semibold">
              <span>{Math.round(item.progressPercent)}%</span>
              <span className="text-[11px] text-muted-foreground">postępu</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="text-sm text-muted-foreground">
              {item.currentValueText} / {item.targetValueText}
            </div>
            {item.showDaysRemaining ? (
              <div className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[12px] font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                Pozostało {item.daysRemaining} dni
              </div>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="justify-end text-xs text-muted-foreground">
          Kliknij, aby przejść do szczegółów
        </CardFooter>
      </Card>
    </a>
  );
}

interface LoadMoreSectionProps {
  canLoadMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}

function LoadMoreSection({ canLoadMore, isLoading, onLoadMore }: LoadMoreSectionProps) {
  if (!canLoadMore && !isLoading) {
    return null;
  }

  return (
    <div className="flex items-center justify-center">
      <Button onClick={onLoadMore} disabled={!canLoadMore || isLoading} className="min-w-[160px]">
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Ładowanie...
          </>
        ) : (
          "Załaduj więcej"
        )}
      </Button>
    </div>
  );
}

function EmptyState({ onCreateGoal }: { onCreateGoal: () => void }) {
  return (
    <section
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-muted-foreground/30 bg-card px-6 py-10 text-center"
      aria-live="polite"
    >
      <p className="text-lg font-semibold">Brak celów</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Nie masz jeszcze żadnych celów. Utwórz pierwszy, aby zacząć śledzić swój postęp.
      </p>
      <Button onClick={onCreateGoal} className="mt-2">
        Utwórz cel
      </Button>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Ładowanie celów...
    </div>
  );
}

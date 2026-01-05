import React, { useMemo, useState, useCallback } from "react";
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
import { AppHeader } from "@/components/ui/AppHeader";
import { cn } from "@/lib/utils";
import { apiFetchJson } from "@/lib/api/apiFetchJson";
import type { GoalStatus } from "@/types";
import GoalCreateModalPage from "@/components/goals/GoalCreateModalPage";

import { useGoalsList } from "../hooks/useGoalsList";
import type { GoalCardVm } from "../hooks/useGoalsList";
import { useCurrentUser } from "../hooks/useCurrentUser";

const statusLabels: Record<GoalStatus, string> = {
  active: "Active",
  completed_success: "Completed",
  completed_failure: "Failed",
  abandoned: "Abandoned",
};

const sortLabels: Record<"created_at" | "deadline", string> = {
  created_at: "Created date",
  deadline: "Deadline",
};

const orderLabels: Record<"asc" | "desc", string> = {
  asc: "Ascending",
  desc: "Descending",
};

export default function GoalsListPage() {
  const goals = useGoalsList();
  const currentUser = useCurrentUser();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalInitialValues, setModalInitialValues] = useState<any>({});

  const handleLogout = useCallback(async () => {
    try {
      // Call logout endpoint to invalidate session on server
      await apiFetchJson("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      // Log error but continue with logout
      console.error("Logout API call failed:", error);
    } finally {
      // Cookies are cleared by server, just redirect to landing page
      window.location.href = "/";
    }
  }, []);

  const handleCreateGoal = useCallback((initialValues = {}) => {
    setModalInitialValues(initialValues);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalSuccess = useCallback(() => {
    goals.handlers.retry();
  }, [goals.handlers]);

  const showEmpty = !goals.isInitialLoading && goals.items.length === 0 && !goals.error;

  // Extract user display name (use email or fallback)
  const userDisplayName = currentUser.user?.email ?? "User";

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#4A3F35]">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-[#E5DDD5] shadow-sm">
        <AppHeader title="Goals List" userDisplayName={userDisplayName} onLogout={handleLogout} />
      </header>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-8 pb-16 pt-6">
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

        {showEmpty ? <EmptyState onCreateGoal={() => handleCreateGoal()} /> : null}

        {goals.items.length > 0 ? <GoalsGrid items={goals.items} onCreateGoal={() => handleCreateGoal()} /> : null}

        <LoadMoreSection
          canLoadMore={goals.canLoadMore}
          isLoading={goals.isLoadingMore}
          onLoadMore={goals.handlers.loadMore}
        />
      </div>

      <GoalCreateModalPage
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        initialValues={modalInitialValues}
        onSuccess={handleModalSuccess}
      />
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
    <div className="flex flex-col gap-5">
      <div>
        <label className="group relative">
          <div className="relative rounded-xl bg-white border border-[#E5DDD5] hover:border-[#D4A574] focus-within:border-[#D4A574] focus-within:ring-2 focus-within:ring-[#D4A574]/20 transition-all duration-200">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8B7E74]" aria-hidden="true" />
            <Input
              aria-label="Search goal"
              placeholder="Search by name"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              maxLength={200}
              className="border-0 bg-transparent pr-16 shadow-none outline-none ring-0 focus-visible:ring-0 text-[#4A3F35] placeholder:text-[#A89F94]"
              style={{ paddingLeft: "40px" }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8B7E74]">
              {search.trim().length}/200
            </span>
          </div>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-2 text-[#4A3F35]">Status</label>
          <Select value={status} onValueChange={(value) => onStatusChange(value as GoalStatus)}>
            <SelectTrigger aria-label="Filter by status">
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
          <label className="block text-sm font-medium mb-2 text-[#4A3F35]">Sort</label>
          <div className="grid grid-cols-2 gap-2">
            <Select value={sort} onValueChange={(value) => onSortChange(value as "created_at" | "deadline")}>
              <SelectTrigger aria-label="Sort">
                <SelectValue placeholder="Sort" />
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
              <SelectTrigger aria-label="Sort order">
                <SelectValue placeholder="Order" />
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
      className="flex items-center gap-3 rounded-xl border border-[#C17A6F]/30 bg-[#C17A6F]/10 px-4 py-3 text-sm text-[#C17A6F]"
      aria-live="polite"
    >
      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{error.message}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function GoalsGrid({ items, onCreateGoal }: { items: GoalCardVm[]; onCreateGoal: () => void }) {
  return (
    <section aria-label="Goals" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <GoalCard key={item.id} item={item} />
      ))}
      {items.length > 0 && (
        <Card className="h-full rounded-2xl border-dashed border-2 border-[#D4A574]/30 hover:border-[#D4A574]/60 hover:bg-[#D4A574]/5 transition-all duration-200 bg-white">
          <CardContent className="flex items-center justify-center h-full min-h-[200px]">
            <Button
              onClick={onCreateGoal}
              className="aspect-square p-4 text-lg bg-[#D4A574] hover:bg-[#C9965E] text-white"
            >
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
        return <CheckCircle2 className="size-4 text-[#9CAA7F]" aria-hidden="true" />;
      case "completed_failure":
        return <XCircle className="size-4 text-[#C17A6F]" aria-hidden="true" />;
      case "abandoned":
        return <CircleAlert className="size-4 text-[#D4A574]" aria-hidden="true" />;
      default:
        return <TimerReset className="size-4" aria-hidden="true" />;
    }
  }, [item.status]);

  return (
    <a href={item.href} className="group block focus:outline-none">
      <Card className="h-full rounded-2xl border-[#E5DDD5]/60 bg-white shadow-sm transition-all duration-300 group-hover:shadow-xl group-hover:scale-[1.02] group-hover:border-[#D4A574]/40 group-focus-visible:ring-2 group-focus-visible:ring-[#D4A574]/30">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CardTitle className="line-clamp-2 text-base font-semibold leading-tight flex-1 min-w-0 text-[#4A3F35]">
              {item.name}
            </CardTitle>
            <div className="flex items-center gap-1 text-sm shrink-0 text-[#4A3F35]">
              {statusIcon}
              <span>{statusLabels[item.status]}</span>
              {item.status === "active" && item.progressPercent >= 100 ? (
                <Badge className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-[#9CAA7F]/10 text-[#9CAA7F]">
                  Complete
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="relative flex items-center justify-center">
            <svg className="size-20" viewBox="0 0 80 80" aria-hidden="true">
              <circle
                className="text-[#E5DDD5]"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                r={radius}
                cx="40"
                cy="40"
                opacity={0.5}
              />
              <circle
                className="text-[#D4A574]"
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
            <div className="absolute flex flex-col items-center justify-center text-sm font-semibold text-[#4A3F35]">
              <span>{Math.round(item.progressPercent)}%</span>
              <span className="text-[11px] text-[#8B7E74]">progress</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="text-2xl text-[#8B7E74]">
              {item.currentValueText} / {item.targetValueText}
            </div>
            {item.showDaysRemaining ? (
              <div className="inline-flex items-center gap-1 rounded-md bg-[#D4A574]/10 px-2 py-1 text-[12px] font-medium text-[#4A3F35]">
                <CalendarClock className="size-3.5 text-[#D4A574]" aria-hidden="true" />
                {item.daysRemaining} days left
              </div>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="justify-end text-xs text-[#8B7E74]">Click for details</CardFooter>
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
      <Button
        onClick={onLoadMore}
        disabled={!canLoadMore || isLoading}
        className="min-w-[160px] bg-[#D4A574] hover:bg-[#C9965E] text-white"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading...
          </>
        ) : (
          "Load more"
        )}
      </Button>
    </div>
  );
}

function EmptyState({ onCreateGoal }: { onCreateGoal: () => void }) {
  return (
    <section
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[#D4A574]/30 bg-white px-8 py-12 text-center"
      aria-live="polite"
    >
      <p className="text-lg font-semibold text-[#4A3F35]">No goals</p>
      <p className="max-w-md text-sm text-[#8B7E74]">
        You don't have any goals yet. Create your first one to start tracking your progress.
      </p>
      <Button onClick={onCreateGoal} className="mt-2 bg-[#D4A574] hover:bg-[#C9965E] text-white">
        Create goal
      </Button>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E5DDD5] bg-white px-4 py-3 text-sm text-[#8B7E74] shadow-sm">
      <Loader2 className="size-4 animate-spin text-[#D4A574]" aria-hidden="true" />
      Loading goals...
    </div>
  );
}

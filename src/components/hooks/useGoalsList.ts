import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type { GetGoalsResponseDto, GoalListItemDto, GoalStatus, SyncStatusesResponseDto } from "@/types";

import { useDebouncedValue } from "./useDebouncedValue";

const DEFAULT_PAGE_SIZE = 20;
const SEARCH_MAX_LENGTH = 200;

export type GoalsListErrorKind = "unauthenticated" | "invalid_query" | "network" | "server" | "unknown";

export interface GoalsListError {
  kind: GoalsListErrorKind;
  message: string;
}

export interface GoalsListQueryState {
  status: GoalStatus;
  sort: "created_at" | "deadline";
  order: "asc" | "desc";
  pageSize: number;
}

export interface GoalCardVm {
  id: string;
  href: string;
  name: string;
  status: GoalStatus;
  currentValueText: string;
  targetValueText: string;
  progressPercent: number;
  daysRemaining: number;
  showDaysRemaining: boolean;
}

interface GoalsListState {
  items: GoalCardVm[];
  page: number;
  total: number;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  error: GoalsListError | null;
}

interface GoalsListHandlers {
  setStatus: (status: GoalStatus) => void;
  setSearch: (value: string) => void;
  setSort: (sort: "created_at" | "deadline") => void;
  setOrder: (order: "asc" | "desc") => void;
  loadMore: () => void;
  retry: () => void;
}

export interface GoalsListViewModel {
  items: GoalCardVm[];
  page: number;
  total: number;
  canLoadMore: boolean;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  error: GoalsListError | null;
  filters: {
    status: GoalStatus;
    search: string;
    sort: "created_at" | "deadline";
    order: "asc" | "desc";
  };
  handlers: GoalsListHandlers;
}

function sanitizeSearch(raw: string) {
  const trimmed = raw.trim().slice(0, SEARCH_MAX_LENGTH);
  return trimmed.length > 0 ? trimmed : "";
}

function mapGoalToVm(goal: GoalListItemDto): GoalCardVm {
  return {
    id: goal.id,
    href: `/app/goals/${goal.id}`,
    name: goal.name,
    status: goal.status,
    currentValueText: goal.computed.current_value,
    targetValueText: goal.target_value,
    progressPercent: goal.computed.progress_percent,
    daysRemaining: goal.computed.days_remaining,
    showDaysRemaining: goal.status === "active",
  };
}

function buildGoalsQueryParams(query: GoalsListQueryState, search: string, page: number) {
  const params = new URLSearchParams();

  params.set("status", query.status);
  params.set("sort", query.sort);
  params.set("order", query.order);
  params.set("page", Math.max(1, page).toString());
  params.set("pageSize", Math.min(Math.max(query.pageSize, 1), 100).toString());

  const sanitizedSearch = sanitizeSearch(search);

  if (sanitizedSearch) {
    params.set("q", sanitizedSearch);
  }

  return params;
}

function normalizeError(error: unknown): GoalsListError {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { kind: "unauthenticated", message: "Wymagane ponowne logowanie." };
    }

    if (error.status === 400) {
      return { kind: "invalid_query", message: error.message };
    }

    if (error.status >= 500) {
      return { kind: "server", message: "Wystąpił błąd serwera. Spróbuj ponownie." };
    }

    return { kind: "unknown", message: error.message };
  }

  if (error instanceof Error) {
    return { kind: "network", message: error.message };
  }

  return { kind: "unknown", message: "Nie udało się wykonać żądania." };
}

export function useGoalsList(): GoalsListViewModel {
  const [queryState, setQueryState] = useState<GoalsListQueryState>({
    status: "active",
    sort: "created_at",
    order: "desc",
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const [rawSearch, setRawSearch] = useState("");
  const debouncedSearch = useDebouncedValue(rawSearch, 300);
  const requestIdRef = useRef(0);
  const hasBootstrappedRef = useRef(false);

  const [state, setState] = useState<GoalsListState>({
    items: [],
    page: 1,
    total: 0,
    isInitialLoading: true,
    isLoadingMore: false,
    error: null,
  });

  const fetchGoals = useCallback(
    async (page: number, mode: "replace" | "append") => {
      const requestId = ++requestIdRef.current;

      setState((prev) => ({
        ...prev,
        isInitialLoading: mode === "replace",
        isLoadingMore: mode === "append",
        error: null,
      }));

      try {
        const params = buildGoalsQueryParams(queryState, debouncedSearch, page);
        const response = await apiFetchJson<GetGoalsResponseDto>(`/api/goals?${params.toString()}`);

        if (requestIdRef.current !== requestId) {
          return;
        }

        const items = response.data.items.map(mapGoalToVm);

        setState((prev) => ({
          ...prev,
          items: mode === "append" ? [...prev.items, ...items] : items,
          page,
          total: response.data.total,
          isInitialLoading: false,
          isLoadingMore: false,
          error: null,
        }));
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setState((prev) => ({
          ...prev,
          isInitialLoading: false,
          isLoadingMore: false,
          error: normalizeError(error),
        }));
      }
    },
    [debouncedSearch, queryState]
  );

  useEffect(() => {
    if (!hasBootstrappedRef.current) {
      return;
    }

    void fetchGoals(1, "replace");
  }, [fetchGoals]);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }

    hasBootstrappedRef.current = true;

    (async () => {
      try {
        const syncResponse = await apiFetchJson<SyncStatusesResponseDto>("/api/goals/sync-statuses", {
          method: "POST",
          body: "{}",
        });

        if (syncResponse.data?.updated?.length) {
          await fetchGoals(1, "replace");
          return;
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return;
        }

        // Silent failure by design; list fetch will still run.
        console.warn("sync-statuses failed", error);
      }

      await fetchGoals(1, "replace");
    })();
  }, [fetchGoals]);

  const setStatus = useCallback((status: GoalStatus) => {
    setQueryState((prev) => ({ ...prev, status }));
  }, []);

  const setSearch = useCallback((value: string) => {
    setRawSearch(value.slice(0, SEARCH_MAX_LENGTH));
  }, []);

  const setSort = useCallback((sort: "created_at" | "deadline") => {
    setQueryState((prev) => ({ ...prev, sort }));
  }, []);

  const setOrder = useCallback((order: "asc" | "desc") => {
    setQueryState((prev) => ({ ...prev, order }));
  }, []);

  const loadMore = useCallback(() => {
    if (state.isLoadingMore || state.items.length >= state.total) {
      return;
    }

    void fetchGoals(state.page + 1, "append");
  }, [fetchGoals, state.isLoadingMore, state.items.length, state.page, state.total]);

  const retry = useCallback(() => {
    void fetchGoals(1, "replace");
  }, [fetchGoals]);

  const viewModel: GoalsListViewModel = useMemo(
    () => ({
      items: state.items,
      page: state.page,
      total: state.total,
      canLoadMore: state.items.length < state.total,
      isInitialLoading: state.isInitialLoading,
      isLoadingMore: state.isLoadingMore,
      error: state.error,
      filters: {
        status: queryState.status,
        search: rawSearch,
        sort: queryState.sort,
        order: queryState.order,
      },
      handlers: {
        setStatus,
        setSearch,
        setSort,
        setOrder,
        loadMore,
        retry,
      },
    }),
    [loadMore, queryState.order, queryState.sort, queryState.status, rawSearch, retry, state]
  );

  return viewModel;
}

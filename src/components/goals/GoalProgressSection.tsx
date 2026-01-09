import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import { formatDateTime } from "@/lib/utils/dateFormat";
import type {
  CreateGoalProgressCommand,
  CreateGoalProgressResponseDto,
  DeleteProgressResponseDto,
  GetGoalProgressResponseDto,
  GoalProgressEntryDto,
  GoalStatus,
  UpdateProgressCommand,
  UpdateProgressResponseDto,
} from "@/types";

interface GoalProgressSectionProps {
  goalId: string;
  goalStatus: GoalStatus;
  onProgressChanged?: () => void;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

interface ProgressState {
  items: GoalProgressEntryDto[];
  loading: boolean;
  error: string | null;
}

interface DraftState {
  value: string;
  notes: string;
}

const PAGE_SIZE = 10;

export function GoalProgressSection({ goalId, goalStatus, onProgressChanged }: GoalProgressSectionProps) {
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: PAGE_SIZE, total: 0 });
  const [state, setState] = useState<ProgressState>({ items: [], loading: true, error: null });
  const [createDraft, setCreateDraft] = useState<DraftState>({ value: "", notes: "" });
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<DraftState>({ value: "", notes: "" });
  const [confirm, setConfirm] = useState<{ type: "create" | "update" | "delete"; entryId?: string } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GoalProgressEntryDto | null>(null);
  const [modalDraft, setModalDraft] = useState<DraftState>({ value: "", notes: "" });
  const [modalError, setModalError] = useState<string | null>(null);

  const canEdit = goalStatus === "active";

  const fetchProgress = useCallback(
    async (page: number) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: pagination.pageSize.toString(),
          sort: "created_at",
          order: "desc",
        });
        const response = await apiFetchJson<GetGoalProgressResponseDto>(
          `/api/goals/${goalId}/progress?${params.toString()}`
        );
        setState({ items: response.data.items, loading: false, error: null });
        setPagination({ page, pageSize: pagination.pageSize, total: response.data.total });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch progress.";
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [goalId, pagination.pageSize]
  );

  useEffect(() => {
    void fetchProgress(1);
  }, [fetchProgress]);

  useEffect(() => {
    if (selectedEntry) {
      setModalDraft({ value: selectedEntry.value, notes: selectedEntry.notes ?? "" });
    }
  }, [selectedEntry]);

  const validateValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "Value is required.";
    }
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return "Value must be a positive number.";
    }
    return null;
  };

  const handleCreate = useCallback(async () => {
    if (!canEdit) return;

    const validationError = validateValue(createDraft.value);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setCreateError(null);
    const command: CreateGoalProgressCommand = {
      value: createDraft.value.trim(),
      notes: createDraft.notes.trim() || undefined,
    };

    setPendingId("new");
    try {
      await apiFetchJson<CreateGoalProgressResponseDto>(`/api/goals/${goalId}/progress`, {
        method: "POST",
        body: JSON.stringify(command),
      });
      setCreateDraft({ value: "", notes: "" });
      setIsCreateModalOpen(false);
      if (onProgressChanged) {
        onProgressChanged();
      }
      void fetchProgress(1);
    } catch (error) {
      if (error instanceof ApiError) {
        setCreateError(error.message);
      } else if (error instanceof Error) {
        setCreateError(error.message);
      } else {
        setCreateError("Failed to save entry.");
      }
    } finally {
      setPendingId(null);
    }
  }, [canEdit, createDraft.notes, createDraft.value, fetchProgress, goalId, onProgressChanged]);

  const _startEdit = useCallback((entry: GoalProgressEntryDto) => {
    setEditingId(entry.id);
    setEditingDraft({ value: entry.value, notes: entry.notes ?? "" });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingDraft({ value: "", notes: "" });
  }, []);

  const handleUpdate = useCallback(
    async (entryId: string) => {
      if (!canEdit) return;
      const validationError = validateValue(editingDraft.value);
      if (validationError) {
        setCreateError(validationError);
        return;
      }

      const command: UpdateProgressCommand = {
        value: editingDraft.value.trim(),
        notes: editingDraft.notes.trim() || undefined,
      };

      setPendingId(entryId);
      try {
        await apiFetchJson<UpdateProgressResponseDto>(`/api/progress/${entryId}`, {
          method: "PATCH",
          body: JSON.stringify(command),
        });
        cancelEdit();
        if (onProgressChanged) {
          onProgressChanged();
        }
        void fetchProgress(pagination.page);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update entry.";
        setCreateError(message);
      } finally {
        setPendingId(null);
      }
    },
    [canEdit, cancelEdit, editingDraft.notes, editingDraft.value, fetchProgress, onProgressChanged, pagination.page]
  );

  const handleModalSave = useCallback(async () => {
    if (!selectedEntry || !canEdit) return;
    const validationError = validateValue(modalDraft.value);
    if (validationError) {
      setModalError(validationError);
      return;
    }

    setModalError(null);
    const command: UpdateProgressCommand = {
      value: modalDraft.value.trim(),
      notes: modalDraft.notes.trim() || undefined,
    };

    setPendingId(selectedEntry.id);
    try {
      await apiFetchJson<UpdateProgressResponseDto>(`/api/progress/${selectedEntry.id}`, {
        method: "PATCH",
        body: JSON.stringify(command),
      });
      setSelectedEntry(null);
      if (onProgressChanged) {
        onProgressChanged();
      }
      void fetchProgress(pagination.page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update entry.";
      setCreateError(message);
    } finally {
      setPendingId(null);
    }
  }, [selectedEntry, canEdit, modalDraft.value, modalDraft.notes, onProgressChanged, fetchProgress, pagination.page]);

  const handleDelete = useCallback(
    async (entryId: string) => {
      if (!canEdit) return;

      setPendingId(entryId);
      try {
        await apiFetchJson<DeleteProgressResponseDto>(`/api/progress/${entryId}`, {
          method: "DELETE",
        });
        if (onProgressChanged) {
          onProgressChanged();
        }
        void fetchProgress(1);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete entry.";
        setCreateError(message);
      } finally {
        setPendingId(null);
      }
    },
    [canEdit, fetchProgress, onProgressChanged]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(pagination.total / pagination.pageSize)),
    [pagination.pageSize, pagination.total]
  );

  const canSubmit = canEdit && !pendingId;

  return (
    <section className="rounded-xl border border-[#E5DDD5] bg-white px-6 py-5 shadow-sm" aria-label="Goal progress">
      <header className="flex items-center justify-between pb-4">
        <div>
          <h3 className="text-base font-semibold text-[#4A3F35]">Progress</h3>
          <p className="text-sm text-[#8B7E74]">Add and edit progress entries. Available only for active goals.</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              disabled={Boolean(pendingId)}
              className="gap-2 bg-[#D4A574] hover:bg-[#C9965E] text-white"
              data-test-id="add-progress-button"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add Progress
            </Button>
          ) : (
            <span className="rounded-full bg-[#E5DDD5] px-3 py-1 text-xs text-[#4A3F35]">View only</span>
          )}
        </div>
      </header>

      {state.error ? (
        <div
          className="mb-4 rounded-md border border-[#C17A6F]/40 bg-[#C17A6F]/10 px-3 py-2 text-sm text-[#C17A6F]"
          role="status"
          aria-live="polite"
        >
          {state.error}
        </div>
      ) : null}

      {state.loading ? (
        <div className="flex items-center gap-2 text-sm text-[#8B7E74]">
          <Loader2 className="size-4 animate-spin text-[#D4A574]" aria-hidden="true" />
          Loading entries...
        </div>
      ) : null}

      <div className="max-h-55 overflow-y-auto">
        <div className="grid gap-3">
          {state.items.map((entry) => {
            const isEditing = editingId === entry.id;
            return (
              <Card
                key={entry.id}
                className="border-[#E5DDD5] bg-[#FAF8F5] cursor-pointer"
                onClick={() => setSelectedEntry(entry)}
              >
                <CardContent className="flex items-center gap-4 py-3">
                  {isEditing ? (
                    <>
                      <div className="flex flex-col gap-1">
                        <Input
                          className="w-16 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          type="number"
                          value={editingDraft.value}
                          onChange={(event) => {
                            setEditingDraft((prev) => ({ ...prev, value: event.target.value }));
                            setCreateError(null); // Clear error on change
                          }}
                          inputMode="decimal"
                          aria-invalid={Boolean(createError)}
                        />
                        {createError && <p className="text-xs text-[#C17A6F]">{createError}</p>}
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex justify-end">
                          <span className="text-[11px] text-[#8B7E74]">{editingDraft.notes.length}/150</span>
                        </div>
                        <Textarea
                          value={editingDraft.notes}
                          onChange={(event) => setEditingDraft((prev) => ({ ...prev, notes: event.target.value }))}
                          maxLength={150}
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEdit();
                          }}
                          disabled={Boolean(pendingId)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirm({ type: "update", entryId: entry.id });
                          }}
                          disabled={Boolean(pendingId)}
                        >
                          {pendingId === entry.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 font-semibold text-[#4A3F35]">{entry.value}</div>
                      <div className="flex-1 text-sm text-[#8B7E74] truncate">{entry.notes || "No notes"}</div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {state.items.length > 0 && totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchProgress(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1 || state.loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchProgress(Math.min(totalPages, pagination.page + 1))}
              disabled={pagination.page === totalPages || state.loading}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.type === "delete" ? "Delete entry" : confirm?.type === "update" ? "Save changes" : "Add entry"}
            </DialogTitle>
            <DialogDescription>
              {confirm?.type === "delete"
                ? "Are you sure you want to delete this progress entry?"
                : confirm?.type === "update"
                  ? "Confirm saving changes to this entry."
                  : "Confirm adding a new entry."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!confirm) return;
                if (confirm.type === "create") {
                  void handleCreate();
                } else if (confirm.type === "update" && confirm.entryId) {
                  void handleUpdate(confirm.entryId);
                } else if (confirm.type === "delete" && confirm.entryId) {
                  void handleDelete(confirm.entryId);
                }
                setConfirm(null);
              }}
              variant={confirm?.type === "delete" ? "destructive" : "default"}
              disabled={Boolean(pendingId)}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedEntry)} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Progress entry details</DialogTitle>
            <DialogDescription>Detailed information about this progress entry.</DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#4A3F35]" htmlFor="modal-value">
                  Value
                </label>
                <Input
                  id="modal-value"
                  type="number"
                  value={modalDraft.value}
                  onChange={(event) => {
                    setModalDraft((prev) => ({ ...prev, value: event.target.value }));
                    setModalError(null); // Clear error on change
                  }}
                  inputMode="decimal"
                  disabled={!canEdit}
                  aria-invalid={Boolean(modalError)}
                  className="rounded-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                />
                {modalError && <p className="text-sm text-[#C17A6F] mt-1">{modalError}</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-[#4A3F35]" htmlFor="modal-notes">
                    Notes
                  </label>
                  <span className="text-[11px] text-[#8B7E74]">{modalDraft.notes.length}/150</span>
                </div>
                <Textarea
                  id="modal-notes"
                  value={modalDraft.notes}
                  onChange={(event) => setModalDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  disabled={!canEdit}
                  maxLength={150}
                  rows={4}
                  className="resize-none rounded-sm"
                />
              </div>
              <div>
                <label htmlFor="entry-created-at" className="text-sm font-medium text-[#4A3F35]">
                  Created at
                </label>
                <p id="entry-created-at" className="text-sm text-[#8B7E74]">
                  {formatDateTime(selectedEntry.created_at)}
                </p>
              </div>
              <div>
                <label htmlFor="entry-updated-at" className="text-sm font-medium text-[#4A3F35]">
                  Updated at
                </label>
                <p id="entry-updated-at" className="text-sm text-[#8B7E74]">
                  {formatDateTime(selectedEntry.updated_at)}
                </p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            {canEdit && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedEntry) {
                    void handleDelete(selectedEntry.id);
                    setSelectedEntry(null);
                  }
                }}
                disabled={Boolean(pendingId)}
                className="gap-2"
              >
                {pendingId === selectedEntry?.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedEntry(null)}>
              Close
            </Button>
            {canEdit && (
              <Button
                onClick={() => void handleModalSave()}
                disabled={Boolean(pendingId)}
                className="gap-2 bg-[#D4A574] hover:bg-[#C9965E] text-white"
              >
                {pendingId === selectedEntry?.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Save
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setCreateDraft({ value: "", notes: "" });
            setCreateError(null);
          }
        }}
      >
        <DialogContent data-test-id="create-progress-dialog">
          <DialogHeader>
            <DialogTitle>Add progress entry</DialogTitle>
            <DialogDescription>Add a new progress entry for this goal.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
            noValidate
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#4A3F35]" htmlFor="create-value">
                  Value
                </label>
                <Input
                  id="create-value"
                  type="number"
                  value={createDraft.value}
                  onChange={(event) => {
                    setCreateDraft((prev) => ({ ...prev, value: event.target.value }));
                    setCreateError(null);
                  }}
                  inputMode="decimal"
                  aria-invalid={Boolean(createError)}
                  className="rounded-sm [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                  data-test-id="create-progress-value-input"
                />
                {createError && (
                  <p className="text-sm text-[#C17A6F] mt-1" data-test-id="create-progress-error-message">
                    {createError}
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-[#4A3F35]" htmlFor="create-notes">
                    Notes (optional)
                  </label>
                  <span className="text-[11px] text-[#8B7E74]">{createDraft.notes.length}/150</span>
                </div>
                <Textarea
                  id="create-notes"
                  value={createDraft.notes}
                  onChange={(event) => setCreateDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  maxLength={150}
                  rows={4}
                  className="resize-none rounded-sm"
                  data-test-id="create-progress-notes-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreateDraft({ value: "", notes: "" });
                  setCreateError(null);
                }}
                disabled={Boolean(pendingId)}
                data-test-id="create-progress-cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="gap-2 bg-[#D4A574] hover:bg-[#C9965E] text-white"
                data-test-id="create-progress-submit-button"
              >
                {pendingId === "new" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                Save Progress
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default GoalProgressSection;

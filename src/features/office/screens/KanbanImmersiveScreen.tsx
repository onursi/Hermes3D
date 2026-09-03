"use client";

import { type ComponentProps, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

import type { AgentState } from "@/features/agents/state/store";
import { TaskBoardView } from "@/features/office/tasks/TaskBoardView";
import type { TaskBoardCard, TaskBoardStatus } from "@/features/office/tasks/types";
import type { CronJobSummary } from "@/lib/cron/types";

export function KanbanImmersiveScreen({
  agents,
  cardsByStatus,
  selectedCard,
  activeRuns,
  cronJobs,
  cronLoading,
  cronError,
  taskCaptureDebug,
  onCreateCard,
  onMoveCard,
  onSelectCard,
  onUpdateCard,
  onDeleteCard,
  onRefreshCronJobs,
  onClose,
}: {
  agents: AgentState[];
  cardsByStatus: Record<TaskBoardStatus, TaskBoardCard[]>;
  selectedCard: TaskBoardCard | null;
  activeRuns: Array<{ runId: string; agentId: string; label: string }>;
  cronJobs: CronJobSummary[];
  cronLoading: boolean;
  cronError: string | null;
  taskCaptureDebug?: ComponentProps<typeof TaskBoardView>["taskCaptureDebug"];
  onCreateCard: () => void;
  onMoveCard: (cardId: string, status: TaskBoardStatus) => void;
  onSelectCard: (cardId: string | null) => void;
  onUpdateCard: (cardId: string, patch: Partial<TaskBoardCard>) => void;
  onDeleteCard: (cardId: string) => void;
  onRefreshCronJobs: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialog.focus();

    const trapFocus = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) {
        event.stopPropagation();
        dialog.focus();
      }
    };

    document.addEventListener("focusin", trapFocus);
    return () => {
      document.removeEventListener("focusin", trapFocus);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kanban Board"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kanban-Board schließen"
          className="absolute -right-4 -top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/30 bg-[#060c18]/95 text-cyan-300 shadow-xl backdrop-blur-md transition-colors hover:border-cyan-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          ref={dialogRef}
          tabIndex={-1}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
          className="flex h-[min(78vh,820px)] w-[min(84vw,1320px)] flex-col overflow-hidden rounded-2xl border border-cyan-500/35 bg-[#060e1b]/95 shadow-2xl shadow-cyan-950/80 outline-none backdrop-blur-xl"
        >
          <div className="min-h-0 flex-1">
          <TaskBoardView
            title="Hermes Aufgaben-Board // Task-Pipeline"
            subtitle="Eingang, Zeitpläne, Live-Agentenläufe, Freigaben & gelernte Fähigkeiten."
            agents={agents}
            cardsByStatus={cardsByStatus}
            selectedCard={selectedCard}
            activeRuns={activeRuns}
            cronJobs={cronJobs}
            cronLoading={cronLoading}
            cronError={cronError}
            taskCaptureDebug={taskCaptureDebug}
            onCreateCard={onCreateCard}
            onMoveCard={onMoveCard}
            onSelectCard={onSelectCard}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
            onRefreshCronJobs={onRefreshCronJobs}
          />
          </div>
        </div>
      </div>
    </div>
  );
}

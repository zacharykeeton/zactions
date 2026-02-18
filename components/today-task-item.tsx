"use client";

import { type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isPast, isToday, parseISO } from "date-fns";
import { GripVertical } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TaskRowContent } from "@/components/task-row-content";

interface TodayTaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onArchive?: (id: string) => void;
  onFastForward?: (id: string) => void;
  onSkipToday?: (id: string) => void;
  isTimerActive: boolean;
  displayTimeMs: number;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: () => void;
}

export function TodayTaskItem({
  task,
  onToggle,
  onDelete,
  onEdit,
  onArchive,
  onFastForward,
  onSkipToday,
  isTimerActive,
  displayTimeMs,
  onStartTimer,
  onPauseTimer,
}: TodayTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  // Determine overdue status (today background is skipped — redundant in Today list)
  const isDueOverdue =
    task.dueDate &&
    !task.completed &&
    isPast(parseISO(task.dueDate)) &&
    !isToday(parseISO(task.dueDate));

  const isScheduledOverdue =
    task.scheduledDate &&
    !task.completed &&
    isPast(parseISO(task.scheduledDate)) &&
    !isToday(parseISO(task.scheduledDate));

  const shouldShowOverdueBackground = isDueOverdue || isScheduledOverdue;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-border",
        !shouldShowOverdueBackground &&
          "hover:bg-accent/50",
        isDragging && "z-50 opacity-40",
        task.completed && "opacity-60",
        shouldShowOverdueBackground &&
          "bg-red-100 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/40"
      )}
      {...attributes}
    >
      <button
        ref={setActivatorNodeRef}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <TaskRowContent
        task={task}
        onToggle={onToggle}
        onDelete={onDelete}
        onEdit={onEdit}
        onArchive={onArchive}
        onFastForward={onFastForward}
        onSkipToday={onSkipToday}
        isTimerActive={isTimerActive}
        displayTimeMs={displayTimeMs}
        onStartTimer={onStartTimer}
        onPauseTimer={onPauseTimer}
      />
    </div>
  );
}

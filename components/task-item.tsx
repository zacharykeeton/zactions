"use client";

import { type CSSProperties, forwardRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isPast, isToday } from "date-fns";
import { GripVertical } from "lucide-react";
import { priorityColors } from "@/lib/constants";
import type { FlattenedTask, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TaskRowContent } from "@/components/task-row-content";

interface TaskItemProps {
  task: FlattenedTask;
  depth: number;
  indentationWidth: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (parentId: string) => void;
  onArchive?: (id: string) => void;
  onFastForward?: (id: string) => void;
  isGhost?: boolean;
  isTimerActive: boolean;
  displayTimeMs: number;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: () => void;
}

export function TaskItem({
  task,
  depth,
  indentationWidth,
  onToggle,
  onDelete,
  onEdit,
  onAddSubtask,
  onArchive,
  onFastForward,
  isTimerActive,
  displayTimeMs,
  onStartTimer,
  onPauseTimer,
}: TaskItemProps) {
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
    paddingLeft: `${depth * indentationWidth}px`,
  };

  // Determine due date and scheduled date status
  const isDueToday =
    task.dueDate &&
    !task.completed &&
    isToday(new Date(task.dueDate));

  const isScheduledToday =
    task.scheduledDate &&
    !task.completed &&
    isToday(new Date(task.scheduledDate));

  const isDueOverdue =
    task.dueDate &&
    !task.completed &&
    isPast(new Date(task.dueDate)) &&
    !isToday(new Date(task.dueDate));

  const isScheduledOverdue =
    task.scheduledDate &&
    !task.completed &&
    isPast(new Date(task.scheduledDate)) &&
    !isToday(new Date(task.scheduledDate));

  const shouldShowTodayBackground = isDueToday || isScheduledToday;
  const shouldShowOverdueBackground = isDueOverdue || isScheduledOverdue;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-border",
        !shouldShowTodayBackground && !shouldShowOverdueBackground && "hover:bg-accent/50",
        isDragging && "z-50 opacity-40",
        task.completed && "opacity-60",
        shouldShowTodayBackground && "bg-emerald-100 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/40",
        shouldShowOverdueBackground && "bg-red-100 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/40"
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
        onAddSubtask={onAddSubtask}
        onArchive={onArchive}
        onFastForward={onFastForward}
        isTimerActive={isTimerActive}
        displayTimeMs={displayTimeMs}
        onStartTimer={onStartTimer}
        onPauseTimer={onPauseTimer}
      />
    </div>
  );
}

export const TaskItemOverlay = forwardRef<
  HTMLDivElement,
  { task: FlattenedTask; childCount: number }
>(function TaskItemOverlay({ task, childCount }, ref) {
  return (
    <div
      ref={ref}
      className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 shadow-lg"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 truncate text-sm">{task.title}</span>
      <Badge
        variant="secondary"
        className={cn("text-xs", priorityColors[task.priority])}
      >
        {task.priority}
      </Badge>
      {childCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          +{childCount}
        </Badge>
      )}
    </div>
  );
});

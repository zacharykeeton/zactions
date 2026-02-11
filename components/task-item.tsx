"use client";

import { type CSSProperties, forwardRef, useCallback, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, isToday } from "date-fns";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  Repeat,
  Play,
  Pause,
} from "lucide-react";
import confetti from "canvas-confetti";
import { formatRecurrencePattern } from "@/lib/recurrence-utils";
import type { FlattenedTask, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/time-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TaskItemProps {
  task: FlattenedTask;
  depth: number;
  indentationWidth: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (parentId: string) => void;
  isGhost?: boolean;
  isTimerActive: boolean;
  displayTimeMs: number;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: () => void;
}

const priorityColors: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export function TaskItem({
  task,
  depth,
  indentationWidth,
  onToggle,
  onDelete,
  onEdit,
  onAddSubtask,
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

  const checkboxRef = useRef<HTMLButtonElement>(null);
  const completionSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    completionSound.current = new Audio("/sounds/liecio-bonus-points-190035.mp3");
  }, []);

  const handleToggle = useCallback(() => {
    if (!task.completed && checkboxRef.current) {
      const rect = checkboxRef.current.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { x, y },
        ticks: 100,
        gravity: 1.2,
        scalar: 0.8,
      });
      if (completionSound.current) {
        completionSound.current.currentTime = 0;
        completionSound.current.play();
      }
    }
    onToggle(task.id);
  }, [task.completed, task.id, onToggle]);

  const isOverdue =
    task.dueDate &&
    !task.completed &&
    isPast(new Date(task.dueDate)) &&
    !isToday(new Date(task.dueDate));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-accent/50",
        isDragging && "z-50 opacity-40",
        task.completed && "opacity-60"
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

      <Checkbox
        ref={checkboxRef}
        checked={task.completed}
        onCheckedChange={handleToggle}
        className="shrink-0"
      />

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          task.completed && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        {task.recurrence && (
          <Badge
            variant="outline"
            className="flex items-center gap-1 text-xs"
            title={formatRecurrencePattern(task.recurrence)}
          >
            <Repeat className="h-3 w-3" />
            {formatRecurrencePattern(task.recurrence)}
          </Badge>
        )}

        {(task.completionHistory?.length ?? 0) > 0 && (
          <span
            className="text-xs text-muted-foreground"
            title={`Completed ${task.completionHistory!.length} time${task.completionHistory!.length === 1 ? "" : "s"}`}
          >
            {task.completionHistory!.length}x
          </span>
        )}

        <Badge
          variant="secondary"
          className={cn("text-xs", priorityColors[task.priority])}
        >
          {task.priority}
        </Badge>

        {task.dueDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs text-muted-foreground",
              isOverdue && "text-red-600 dark:text-red-400"
            )}
          >
            <Calendar className="h-3 w-3" />
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        )}

        {task.scheduledDate && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(new Date(task.scheduledDate), "MMM d")}
          </span>
        )}

        {(displayTimeMs > 0 || isTimerActive) && (
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              isTimerActive
                ? "text-blue-600 dark:text-blue-400"
                : "text-muted-foreground"
            )}
          >
            {formatDuration(displayTimeMs)}
          </span>
        )}

        {!task.completed && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              isTimerActive
                ? "text-blue-600 hover:text-blue-700 dark:text-blue-400"
                : "text-muted-foreground hover:text-foreground",
              !isTimerActive && displayTimeMs === 0 && "opacity-0 group-hover:opacity-100"
            )}
            onClick={() => {
              if (isTimerActive) {
                onPauseTimer();
              } else {
                onStartTimer(task.id);
              }
            }}
            title={isTimerActive ? "Pause timer" : "Start timer"}
          >
            {isTimerActive ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
        )}

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {!task.recurrence && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onAddSubtask(task.id)}
              title="Add subtask"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(task)}
            title="Edit task"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(task.id)}
            title="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
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

"use client";

import { useCallback, useRef } from "react";
import { format, isFuture, isPast, isToday, parseISO } from "date-fns";
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  CalendarPlus,
  ClipboardPlus,
  Clock,
  Repeat,
  Play,
  Pause,
  Archive,
  FastForward,
  SkipForward,
  CheckCheck,
  LockKeyhole,
} from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { formatRecurrencePattern } from "@/lib/recurrence-utils";
import { priorityColors, TAG_COLORS } from "@/lib/constants";
import type { Task, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/time-utils";
import { playCompletionSound } from "@/lib/completion-sound";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface TaskRowContentProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onAddSubtask?: (parentId: string) => void;
  onArchive?: (id: string) => void;
  onFastForward?: (id: string) => void;
  onSkipToday?: (id: string) => void;
  tagMap?: Record<string, Tag>;
  isTimerActive: boolean;
  displayTimeMs: number;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: () => void;
  blockingTaskTitle?: string;
}

export function TaskRowContent({
  task,
  onToggle,
  onDelete,
  onEdit,
  onAddSubtask,
  onArchive,
  onFastForward,
  onSkipToday,
  tagMap,
  isTimerActive,
  displayTimeMs,
  onStartTimer,
  onPauseTimer,
  blockingTaskTitle,
}: TaskRowContentProps) {
  const checkboxRef = useRef<HTMLButtonElement>(null);

  const isBlocked = !task.completed && !!blockingTaskTitle;
  const notYetStarted =
    !task.completed &&
    !!task.startDate &&
    isFuture(parseISO(task.startDate));
  const isLocked = isBlocked || notYetStarted;

  const lockReason = isBlocked
    ? `This task is blocked by "${blockingTaskTitle}"`
    : notYetStarted
      ? `This task can't start until ${format(parseISO(task.startDate!), "MMM d, yyyy")}`
      : "";

  const lockTooltip = isBlocked
    ? `Blocked by \u201c${blockingTaskTitle}\u201d`
    : notYetStarted
      ? `Starts ${format(parseISO(task.startDate!), "MMM d, yyyy")}`
      : "";

  const handleToggle = useCallback(() => {
    if (isLocked) {
      toast.info(lockReason);
      return;
    }
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
      playCompletionSound();
    }
    onToggle(task.id);
  }, [task.completed, task.id, onToggle, isLocked, lockReason]);

  const isOverdue =
    task.dueDate &&
    !task.completed &&
    isPast(parseISO(task.dueDate)) &&
    !isToday(parseISO(task.dueDate));

  const showFastForward =
    task.recurrence && isOverdue && onFastForward;

  const isDueScheduledOrOverdue =
    !task.completed &&
    ((task.dueDate && (isToday(parseISO(task.dueDate)) || isPast(parseISO(task.dueDate)))) ||
      (task.scheduledDate && (isToday(parseISO(task.scheduledDate)) || isPast(parseISO(task.scheduledDate)))));
  const showSkipToday = onSkipToday && isDueScheduledOrOverdue;

  return (
    <>
      {isLocked ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleToggle}
                className="shrink-0 text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-500 transition-colors"
              >
                <LockKeyhole className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{lockTooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Checkbox
          ref={checkboxRef}
          checked={task.completed}
          onCheckedChange={handleToggle}
          className="shrink-0"
        />
      )}

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          task.completed && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        {isLocked && (
          <Badge
            variant="outline"
            className="text-xs border-orange-400 text-orange-600 dark:border-orange-500 dark:text-orange-400"
          >
            {isBlocked ? "Blocked" : "Not Started"}
          </Badge>
        )}

        {tagMap && task.tags?.map((tagId) => {
          const tag = tagMap[tagId];
          if (!tag) return null;
          const colorStyle = TAG_COLORS[tag.color];
          return (
            <Badge
              key={tagId}
              variant="outline"
              className={cn("text-xs", colorStyle?.badge)}
            >
              {tag.name}
            </Badge>
          );
        })}

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

        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ClipboardPlus className="h-3 w-3" />
          {format(new Date(task.createdDate), "MMM d")}
        </span>

        {task.startDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs text-muted-foreground",
              !task.completed && task.startDate > format(new Date(), "yyyy-MM-dd") && "text-blue-600 dark:text-blue-400"
            )}
          >
            <CalendarPlus className="h-3 w-3" />
            {format(parseISO(task.startDate), "MMM d")}
          </span>
        )}

        {task.scheduledDate && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(parseISO(task.scheduledDate), "MMM d")}
          </span>
        )}

        {task.dueDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs text-muted-foreground",
              isOverdue && "text-red-600 dark:text-red-400"
            )}
          >
            <Calendar className="h-3 w-3" />
            {format(parseISO(task.dueDate), "MMM d")}
          </span>
        )}

        {task.completed && task.completedDate && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCheck className="h-3 w-3" />
            {format(parseISO(task.completedDate), "MMM d")}
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
          {showFastForward && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-blue-600 hover:text-blue-700 dark:text-blue-400"
              onClick={() => onFastForward(task.id)}
              title="Fast forward to next due date"
            >
              <FastForward className="h-3.5 w-3.5" />
            </Button>
          )}
          {showSkipToday && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-blue-600 hover:text-blue-700 dark:text-blue-400"
              onClick={() => onSkipToday(task.id)}
              title="Skip to tomorrow"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
          )}
          {onAddSubtask && !task.recurrence && (
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
          {onArchive && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onArchive(task.id)}
              title="Archive task"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
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
    </>
  );
}

"use client";

import { useRef, useMemo } from "react";
import { startOfDay } from "date-fns";
import { format, isPast, isToday } from "date-fns";
import {
  CalendarCheck,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  Repeat,
} from "lucide-react";
import confetti from "canvas-confetti";
import { formatRecurrencePattern } from "@/lib/recurrence-utils";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getTasksForToday } from "@/lib/tree-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const priorityColors: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

interface TodayListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}

export function TodayList({ tasks, onToggle, onDelete, onEdit }: TodayListProps) {
  const checkboxRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const todayTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return getTasksForToday(tasks, today);
  }, [tasks]);

  const completedCount = todayTasks.filter((t) => t.completed).length;
  const totalCount = todayTasks.length;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (todayTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
        <CalendarCheck className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">Nothing scheduled for today</p>
          <p className="text-sm text-muted-foreground">
            Tasks with today&apos;s due date or scheduled date will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-4 rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Today&apos;s Progress
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight">
              {completionPercent}%
            </span>
            <span className="text-xs text-muted-foreground">
              ({completedCount}/{totalCount})
            </span>
          </div>
        </div>
        <Progress value={completionPercent} className="h-2" />
      </div>

      {todayTasks.map((task) => {
        const isOverdue =
          task.dueDate &&
          !task.completed &&
          isPast(new Date(task.dueDate)) &&
          !isToday(new Date(task.dueDate));

        return (
          <div
            key={task.id}
            className={cn(
              "group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-accent/50",
              task.completed && "opacity-60"
            )}
          >
            <Checkbox
              ref={(el) => {
                if (el) checkboxRefs.current.set(task.id, el);
                else checkboxRefs.current.delete(task.id);
              }}
              checked={task.completed}
              onCheckedChange={() => {
                if (!task.completed) {
                  const el = checkboxRefs.current.get(task.id);
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    confetti({
                      particleCount: 50,
                      spread: 60,
                      origin: {
                        x: (rect.left + rect.width / 2) / window.innerWidth,
                        y: (rect.top + rect.height / 2) / window.innerHeight,
                      },
                      ticks: 100,
                      gravity: 1.2,
                      scalar: 0.8,
                    });
                  }
                }
                onToggle(task.id);
              }}
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

              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
      })}
    </div>
  );
}

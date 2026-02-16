"use client";

import { useMemo } from "react";
import { startOfDay } from "date-fns";
import { CalendarCheck } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getTasksForToday, getTodayProgress } from "@/lib/tree-utils";
import { Progress } from "@/components/ui/progress";
import { TaskRowContent } from "@/components/task-row-content";

interface TodayListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onArchive?: (id: string) => void;
  activeTimerId: string | null;
  currentElapsedMs: number;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: () => void;
}

export function TodayList({ tasks, onToggle, onDelete, onEdit, onArchive, activeTimerId, currentElapsedMs, onStartTimer, onPauseTimer }: TodayListProps) {
  const todayTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return getTasksForToday(tasks, today);
  }, [tasks]);

  const { completedCount, totalCount, percentage: completionPercent } = useMemo(() => {
    const today = startOfDay(new Date());
    return getTodayProgress(todayTasks, today);
  }, [todayTasks]);

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
        const isTimerActive = task.id === activeTimerId;
        const displayTimeMs = isTimerActive
          ? task.timeInvestedMs + currentElapsedMs
          : task.timeInvestedMs;

        return (
          <div
            key={task.id}
            className={cn(
              "group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-accent/50",
              task.completed && "opacity-60"
            )}
          >
            <TaskRowContent
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
              onArchive={onArchive}
              isTimerActive={isTimerActive}
              displayTimeMs={displayTimeMs}
              onStartTimer={onStartTimer}
              onPauseTimer={onPauseTimer}
            />
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useMemo, useEffect } from "react";
import { startOfDay } from "date-fns";
import { CalendarCheck } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Task } from "@/lib/types";
import { getTasksForToday, getTodayProgress } from "@/lib/tree-utils";
import { sortTodayTasks } from "@/lib/today-sort-utils";
import { useTodaySortOrder } from "@/hooks/use-today-sort-order";
import { Progress } from "@/components/ui/progress";
import { TodayTaskItem } from "@/components/today-task-item";

interface TodayListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onArchive?: (id: string) => void;
  onFastForward?: (id: string) => void;
  onSkipToday?: (id: string) => void;
  activeTimerId: string | null;
  currentElapsedMs: number;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: () => void;
}

export function TodayList({
  tasks,
  onToggle,
  onDelete,
  onEdit,
  onArchive,
  onFastForward,
  onSkipToday,
  activeTimerId,
  currentElapsedMs,
  onStartTimer,
  onPauseTimer,
}: TodayListProps) {
  const { sortOrder, updateSortOrder, cleanupStaleIds } = useTodaySortOrder();

  const todayTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return getTasksForToday(tasks, today);
  }, [tasks]);

  // Sort tasks using the persisted sort order
  const sortedTodayTasks = useMemo(
    () => sortTodayTasks(todayTasks, sortOrder),
    [todayTasks, sortOrder]
  );

  // Cleanup stale IDs in a proper effect (not inside useMemo)
  useEffect(() => {
    if (todayTasks.length === 0 || sortOrder.length === 0) return;
    const validIds = new Set(todayTasks.map((t) => t.id));
    const hasStaleIds = sortOrder.some((id) => !validIds.has(id));
    if (hasStaleIds) {
      cleanupStaleIds(validIds);
    }
  }, [todayTasks, sortOrder, cleanupStaleIds]);

  const { completedCount, totalCount, percentage: completionPercent } =
    useMemo(() => {
      const today = startOfDay(new Date());
      return getTodayProgress(sortedTodayTasks, today);
    }, [sortedTodayTasks]);

  const sortedIds = useMemo(
    () => sortedTodayTasks.map(({ id }) => id),
    [sortedTodayTasks]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;

    const oldIndex = sortedIds.indexOf(active.id as string);
    const newIndex = sortedIds.indexOf(over.id as string);

    const newOrder = arrayMove(sortedIds, oldIndex, newIndex);
    updateSortOrder(newOrder);
  }

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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedIds}
          strategy={verticalListSortingStrategy}
        >
          {sortedTodayTasks.map((task) => {
            const isTimerActive = task.id === activeTimerId;
            const displayTimeMs = isTimerActive
              ? task.timeInvestedMs + currentElapsedMs
              : task.timeInvestedMs;

            return (
              <TodayTaskItem
                key={task.id}
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
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

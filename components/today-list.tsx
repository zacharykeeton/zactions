"use client";

import { useMemo, useEffect, useState } from "react";
import { startOfDay } from "date-fns";
import { CalendarCheck, ChevronDown, ChevronRight, Clock, Hourglass } from "lucide-react";
import { useDndMonitor, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Task, Tag } from "@/lib/types";
import { getTasksForToday, getOptionalTasksForToday, getTodayProgress } from "@/lib/tree-utils";
import { sortTodayTasks } from "@/lib/today-sort-utils";
import { useTodaySortOrder } from "@/hooks/use-today-sort-order";
import {
  TODAY_SORT_ORDER_KEY,
  TODAY_RECURRING_SECTION_KEY,
  TODAY_NON_RECURRING_SECTION_KEY,
  TODAY_OPTIONAL_SECTION_KEY,
} from "@/lib/constants";
import { isSidebarDroppableId } from "@/lib/dnd-utils";
import { formatEstimate } from "@/lib/time-utils";
import { getBlockingTask } from "@/lib/dependency-utils";
import { Progress } from "@/components/ui/progress";
import { TodayTaskItem } from "@/components/today-task-item";

function readSectionState(key: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(key) !== "false";
}

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  count: number;
}

function CollapsibleSection({ title, open, onToggle, children, count }: CollapsibleSectionProps) {
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors select-none"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        {title}
        <span className="ml-1 text-xs text-muted-foreground/60">({count})</span>
      </button>
      {open && <div className="flex flex-col">{children}</div>}
    </div>
  );
}

interface TodayListProps {
  tasks: Task[];
  date?: Date;
  storageKey?: string;
  recurringSectionKey?: string;
  nonRecurringSectionKey?: string;
  optionalSectionKey?: string;
  emptyMessage?: string;
  progressLabel?: string;
  listFilter?: (tasks: Task[]) => Task[];
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
  tagMap?: Record<string, Tag>;
}

export function TodayList({
  tasks,
  date,
  storageKey = TODAY_SORT_ORDER_KEY,
  recurringSectionKey = TODAY_RECURRING_SECTION_KEY,
  nonRecurringSectionKey = TODAY_NON_RECURRING_SECTION_KEY,
  optionalSectionKey = TODAY_OPTIONAL_SECTION_KEY,
  emptyMessage = "Nothing scheduled for today",
  progressLabel = "Today's Progress",
  listFilter,
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
  tagMap,
}: TodayListProps) {
  const { sortOrder, updateSortOrder, cleanupStaleIds } = useTodaySortOrder(storageKey);

  const targetDate = useMemo(() => date ?? startOfDay(new Date()), [date]);

  const allTodayTasks = useMemo(() => getTasksForToday(tasks, targetDate), [tasks, targetDate]);
  const todayTasks = useMemo(
    () => (listFilter ? listFilter(allTodayTasks) : allTodayTasks),
    [allTodayTasks, listFilter]
  );

  const sortedTodayTasks = useMemo(
    () => sortTodayTasks(todayTasks, sortOrder),
    [todayTasks, sortOrder]
  );

  useEffect(() => {
    if (todayTasks.length === 0 || sortOrder.length === 0) return;
    const validIds = new Set(todayTasks.map((t) => t.id));
    const hasStaleIds = sortOrder.some((id) => !validIds.has(id));
    if (hasStaleIds) {
      cleanupStaleIds(validIds);
    }
  }, [todayTasks, sortOrder, cleanupStaleIds]);

  const { completedCount, totalCount, percentage: completionPercent } = useMemo(
    () => getTodayProgress(sortedTodayTasks, targetDate),
    [sortedTodayTasks, targetDate]
  );

  const recurringTasks = useMemo(
    () => sortedTodayTasks.filter((t) => !!t.recurrence),
    [sortedTodayTasks]
  );
  const nonRecurringTasks = useMemo(
    () => sortedTodayTasks.filter((t) => !t.recurrence),
    [sortedTodayTasks]
  );

  const recurringIds = useMemo(() => recurringTasks.map((t) => t.id), [recurringTasks]);
  const nonRecurringIds = useMemo(() => nonRecurringTasks.map((t) => t.id), [nonRecurringTasks]);

  // Optional tasks: available (startDate <= today) but not due/scheduled today
  const allOptionalTasks = useMemo(() => getOptionalTasksForToday(tasks, targetDate), [tasks, targetDate]);
  const optionalTasks = useMemo(
    () => (listFilter ? listFilter(allOptionalTasks) : allOptionalTasks),
    [allOptionalTasks, listFilter]
  );
  const sortedOptionalTasks = useMemo(
    () => sortTodayTasks(optionalTasks, sortOrder),
    [optionalTasks, sortOrder]
  );
  const optionalIds = useMemo(() => sortedOptionalTasks.map((t) => t.id), [sortedOptionalTasks]);

  const timeBudget = useMemo(() => {
    const allDayTasks = [...sortedTodayTasks, ...sortedOptionalTasks];
    let totalEstimateMs = 0;
    let totalInvestedMs = 0;
    let hasEstimate = false;

    for (const task of allDayTasks) {
      if (task.timeEstimateMs) {
        totalEstimateMs += task.timeEstimateMs;
        hasEstimate = true;
      }
      totalInvestedMs += task.timeInvestedMs;
      if (task.id === activeTimerId) {
        totalInvestedMs += currentElapsedMs;
      }
    }

    return { totalEstimateMs, totalInvestedMs, hasEstimate };
  }, [sortedTodayTasks, sortedOptionalTasks, activeTimerId, currentElapsedMs]);

  const sortedIds = useMemo(
    () => [...sortedTodayTasks, ...sortedOptionalTasks].map(({ id }) => id),
    [sortedTodayTasks, sortedOptionalTasks]
  );

  const [recurringOpen, setRecurringOpen] = useState(() => readSectionState(recurringSectionKey));
  const [nonRecurringOpen, setNonRecurringOpen] = useState(() => readSectionState(nonRecurringSectionKey));
  const [optionalOpen, setOptionalOpen] = useState(() => readSectionState(optionalSectionKey));

  function toggleRecurring() {
    setRecurringOpen((prev) => {
      const next = !prev;
      localStorage.setItem(recurringSectionKey, String(next));
      return next;
    });
  }

  function toggleNonRecurring() {
    setNonRecurringOpen((prev) => {
      const next = !prev;
      localStorage.setItem(nonRecurringSectionKey, String(next));
      return next;
    });
  }

  function toggleOptional() {
    setOptionalOpen((prev) => {
      const next = !prev;
      localStorage.setItem(optionalSectionKey, String(next));
      return next;
    });
  }

  useDndMonitor({
    onDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Skip sidebar drops (handled by page.tsx)
      if (isSidebarDroppableId(String(over.id))) return;

      // Skip if this item isn't in our list
      if (!sortedIds.includes(String(active.id))) return;

      // Reject cross-group drops
      function getGroup(id: string): string {
        if (recurringIds.includes(id)) return "recurring";
        if (nonRecurringIds.includes(id)) return "nonRecurring";
        if (optionalIds.includes(id)) return "optional";
        return "unknown";
      }
      if (getGroup(active.id as string) !== getGroup(over.id as string)) return;

      const oldIndex = sortedIds.indexOf(active.id as string);
      const newIndex = sortedIds.indexOf(over.id as string);

      const newOrder = arrayMove(sortedIds, oldIndex, newIndex);
      updateSortOrder(newOrder);
    },
  });

  if (todayTasks.length === 0 && optionalTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
        <CalendarCheck className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">{emptyMessage}</p>
          <p className="text-sm text-muted-foreground">
            Tasks with a matching due date or scheduled date will appear here
          </p>
        </div>
      </div>
    );
  }

  function renderTaskItem(task: Task) {
    const isTimerActive = task.id === activeTimerId;
    const displayTimeMs = isTimerActive
      ? task.timeInvestedMs + currentElapsedMs
      : task.timeInvestedMs;
    const blockingTask = getBlockingTask(tasks, task);

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
        tagMap={tagMap}
        blockingTaskTitle={blockingTask?.title}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-4 rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {progressLabel}
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
        {timeBudget.hasEstimate && (
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hourglass className="h-3 w-3" />
              Estimated: {formatEstimate(timeBudget.totalEstimateMs)}
            </span>
            {timeBudget.totalInvestedMs > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Invested: {formatEstimate(timeBudget.totalInvestedMs)}
              </span>
            )}
          </div>
        )}
      </div>

      <CollapsibleSection
        title="Recurring"
        open={recurringOpen}
        onToggle={toggleRecurring}
        count={recurringTasks.length}
      >
        <SortableContext items={recurringIds} strategy={verticalListSortingStrategy}>
          {recurringTasks.map(renderTaskItem)}
        </SortableContext>
      </CollapsibleSection>

      <CollapsibleSection
        title="Non-Recurring"
        open={nonRecurringOpen}
        onToggle={toggleNonRecurring}
        count={nonRecurringTasks.length}
      >
        <SortableContext items={nonRecurringIds} strategy={verticalListSortingStrategy}>
          {nonRecurringTasks.map(renderTaskItem)}
        </SortableContext>
      </CollapsibleSection>

      {sortedOptionalTasks.length > 0 && (
        <CollapsibleSection
          title="Optional"
          open={optionalOpen}
          onToggle={toggleOptional}
          count={sortedOptionalTasks.length}
        >
          <SortableContext items={optionalIds} strategy={verticalListSortingStrategy}>
            {sortedOptionalTasks.map(renderTaskItem)}
          </SortableContext>
        </CollapsibleSection>
      )}
    </div>
  );
}

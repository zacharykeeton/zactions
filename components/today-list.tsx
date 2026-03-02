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
import type { Task, Tag, FlattenedTask } from "@/lib/types";
import {
  getTasksForTodayWithChildren,
  getOptionalTasksForTodayWithChildren,
  getRecurringTasksForTodayWithChildren,
  getTodayProgress,
  flattenTree,
} from "@/lib/tree-utils";
import { sortTodayTasks } from "@/lib/today-sort-utils";
import { useTodaySortOrder } from "@/hooks/use-today-sort-order";
import {
  TODAY_SORT_ORDER_KEY,
  TODAY_RECURRING_SECTION_KEY,
  TODAY_NON_RECURRING_SECTION_KEY,
  TODAY_OPTIONAL_SECTION_KEY,
  INDENTATION_WIDTH,
  COLLAPSED_TASKS_KEY,
} from "@/lib/constants";
import { isSidebarDroppableId } from "@/lib/dnd-utils";
import { formatEstimate } from "@/lib/time-utils";
import { getBlockingTask } from "@/lib/dependency-utils";
import { Progress } from "@/components/ui/progress";
import { TaskItem } from "@/components/task-item";

/** Remove descendants of collapsed tasks from a flattened list. */
function filterCollapsed(items: FlattenedTask[], collapsedIds: Set<string>): FlattenedTask[] {
  const result: FlattenedTask[] = [];
  let skipDepth: number | null = null;

  for (const item of items) {
    if (skipDepth !== null) {
      if (item.depth > skipDepth) continue;
      skipDepth = null;
    }
    result.push(item);
    if (collapsedIds.has(item.id) && item.children.length > 0) {
      skipDepth = item.depth;
    }
  }

  return result;
}

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
  onDuplicate?: (task: Task) => void;
  onArchive?: (id: string) => void;
  onFastForward?: (id: string) => void;
  onSkipToday?: (id: string) => void;
  onAddSubtask?: (parentId: string) => void;
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
  onDuplicate,
  onArchive,
  onFastForward,
  onSkipToday,
  onAddSubtask,
  activeTimerId,
  currentElapsedMs,
  onStartTimer,
  onPauseTimer,
  tagMap,
}: TodayListProps) {
  const { sortOrder, updateSortOrder, cleanupStaleIds } = useTodaySortOrder(storageKey);

  const targetDate = useMemo(() => date ?? startOfDay(new Date()), [date]);

  // --- Recurring tasks with children intact ---
  const { recurringTasks: recurringWithChildren, excludeIds } = useMemo(
    () => getRecurringTasksForTodayWithChildren(tasks, targetDate),
    [tasks, targetDate]
  );
  const filteredRecurringWithChildren = useMemo(
    () => (listFilter ? recurringWithChildren.filter((t) => listFilter([t]).length > 0) : recurringWithChildren),
    [recurringWithChildren, listFilter]
  );

  // Collapse state for recurring tree items (shared with All Tasks tab)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(COLLAPSED_TASKS_KEY);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem(COLLAPSED_TASKS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const fullFlattenedRecurring = useMemo(
    () => flattenTree(filteredRecurringWithChildren),
    [filteredRecurringWithChildren]
  );
  const flattenedRecurring = useMemo(
    () => filterCollapsed(fullFlattenedRecurring, collapsedIds),
    [fullFlattenedRecurring, collapsedIds]
  );
  const recurringIds = useMemo(
    () => flattenedRecurring.map((t) => t.id),
    [flattenedRecurring]
  );

  // --- Non-recurring (scheduled) tasks — exclude recurring children, preserve hierarchy ---
  const { tasks: allScheduledTrees, claimedIds: scheduledClaimedIds } = useMemo(
    () => getTasksForTodayWithChildren(tasks, targetDate, excludeIds),
    [tasks, targetDate, excludeIds]
  );
  const scheduledTrees = useMemo(
    () => (listFilter ? allScheduledTrees.filter((t) => listFilter([t]).length > 0) : allScheduledTrees),
    [allScheduledTrees, listFilter]
  );
  const sortedScheduledTrees = useMemo(
    () => sortTodayTasks(scheduledTrees, sortOrder),
    [scheduledTrees, sortOrder]
  );
  const fullFlattenedScheduled = useMemo(
    () => flattenTree(sortedScheduledTrees),
    [sortedScheduledTrees]
  );
  const flattenedScheduled = useMemo(
    () => filterCollapsed(fullFlattenedScheduled, collapsedIds),
    [fullFlattenedScheduled, collapsedIds]
  );
  const scheduledIds = useMemo(
    () => flattenedScheduled.map((t) => t.id),
    [flattenedScheduled]
  );

  useEffect(() => {
    if (scheduledTrees.length === 0 || sortOrder.length === 0) return;
    const validIds = new Set(scheduledTrees.map((t) => t.id));
    const hasStaleIds = sortOrder.some((id) => !validIds.has(id));
    if (hasStaleIds) {
      cleanupStaleIds(validIds);
    }
  }, [scheduledTrees, sortOrder, cleanupStaleIds]);

  // Progress includes both flattened recurring items and scheduled items
  const allProgressTasks = useMemo(
    () => [...fullFlattenedRecurring, ...fullFlattenedScheduled],
    [fullFlattenedRecurring, fullFlattenedScheduled]
  );
  const { completedCount, totalCount, percentage: completionPercent } = useMemo(
    () => getTodayProgress(allProgressTasks, targetDate),
    [allProgressTasks, targetDate]
  );

  // Optional tasks: available (startDate <= today) but not due/scheduled today — preserve hierarchy
  const combinedExcludeIds = useMemo(() => {
    const combined = new Set(excludeIds);
    for (const id of scheduledClaimedIds) combined.add(id);
    return combined;
  }, [excludeIds, scheduledClaimedIds]);

  const allOptionalTrees = useMemo(
    () => getOptionalTasksForTodayWithChildren(tasks, targetDate, combinedExcludeIds),
    [tasks, targetDate, combinedExcludeIds]
  );
  const optionalTrees = useMemo(
    () => (listFilter ? allOptionalTrees.filter((t) => listFilter([t]).length > 0) : allOptionalTrees),
    [allOptionalTrees, listFilter]
  );
  const sortedOptionalTrees = useMemo(
    () => sortTodayTasks(optionalTrees, sortOrder),
    [optionalTrees, sortOrder]
  );
  const fullFlattenedOptional = useMemo(
    () => flattenTree(sortedOptionalTrees),
    [sortedOptionalTrees]
  );
  const flattenedOptional = useMemo(
    () => filterCollapsed(fullFlattenedOptional, collapsedIds),
    [fullFlattenedOptional, collapsedIds]
  );
  const optionalIds = useMemo(
    () => flattenedOptional.map((t) => t.id),
    [flattenedOptional]
  );

  const timeBudget = useMemo(() => {
    const allDayTasks = [...fullFlattenedScheduled, ...fullFlattenedOptional];
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
  }, [fullFlattenedScheduled, fullFlattenedOptional, activeTimerId, currentElapsedMs]);

  const sortedIds = useMemo(
    () => [...recurringIds, ...scheduledIds, ...optionalIds],
    [recurringIds, scheduledIds, optionalIds]
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
        if (scheduledIds.includes(id)) return "scheduled";
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

  if (scheduledTrees.length === 0 && filteredRecurringWithChildren.length === 0 && optionalTrees.length === 0) {
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

  function renderTreeTaskItem(task: FlattenedTask) {
    const blockingTask = getBlockingTask(tasks, task);
    return (
      <TaskItem
        key={task.id}
        task={task}
        depth={task.depth}
        indentationWidth={INDENTATION_WIDTH}
        onToggle={onToggle}
        onDelete={onDelete}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onAddSubtask={onAddSubtask ?? (() => {})}
        onArchive={onArchive}
        onFastForward={onFastForward}
        onSkipToday={task.depth === 0 ? onSkipToday : undefined}
        isTimerActive={task.id === activeTimerId}
        displayTimeMs={
          task.id === activeTimerId
            ? task.timeInvestedMs + currentElapsedMs
            : task.timeInvestedMs
        }
        onStartTimer={onStartTimer}
        onPauseTimer={onPauseTimer}
        hasChildren={task.children.length > 0}
        isCollapsed={collapsedIds.has(task.id)}
        onToggleCollapse={toggleCollapsed}
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
        count={filteredRecurringWithChildren.length}
      >
        <SortableContext items={recurringIds} strategy={verticalListSortingStrategy}>
          {flattenedRecurring.map(renderTreeTaskItem)}
        </SortableContext>
      </CollapsibleSection>

      <CollapsibleSection
        title="Scheduled"
        open={nonRecurringOpen}
        onToggle={toggleNonRecurring}
        count={sortedScheduledTrees.length}
      >
        <SortableContext items={scheduledIds} strategy={verticalListSortingStrategy}>
          {flattenedScheduled.map(renderTreeTaskItem)}
        </SortableContext>
      </CollapsibleSection>

      {sortedOptionalTrees.length > 0 && (
        <CollapsibleSection
          title="Optional"
          open={optionalOpen}
          onToggle={toggleOptional}
          count={sortedOptionalTrees.length}
        >
          <SortableContext items={optionalIds} strategy={verticalListSortingStrategy}>
            {flattenedOptional.map(renderTreeTaskItem)}
          </SortableContext>
        </CollapsibleSection>
      )}
    </div>
  );
}

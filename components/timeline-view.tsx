"use client";

import { useMemo, useState } from "react";
import { endOfMonth, format } from "date-fns";
import {
  useDndMonitor,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { ChevronRight as ChevronRightIcon } from "lucide-react";
import type { Task, Tag, FlattenedTask } from "@/lib/types";
import {
  flattenTree,
  buildTree,
  getProjection,
  findItemDeep,
  excludeArchivedTasks,
} from "@/lib/tree-utils";
import { getTasksForMonth } from "@/lib/timeline-utils";
import { isSidebarDroppableId } from "@/lib/dnd-utils";
import {
  INDENTATION_WIDTH,
  COLLAPSED_TASKS_KEY,
  TIMELINE_RECURRING_SECTION_KEY,
  TIMELINE_NON_RECURRING_SECTION_KEY,
} from "@/lib/constants";
import { useTimelineState } from "@/hooks/use-timeline-state";
import { TimelineGrid } from "@/components/timeline-grid";
import { Button } from "@/components/ui/button";

function readSectionState(key: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(key) !== "false";
}

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
          <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
        )}
        {title}
        <span className="ml-1 text-xs text-muted-foreground/60">({count})</span>
      </button>
      {open && children}
    </div>
  );
}

interface TimelineViewProps {
  tasks: Task[];
  listFilter?: (tasks: Task[]) => Task[];
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  updateTask: (
    id: string,
    updates: Partial<Omit<Task, "id" | "children">>
  ) => void;
  onReorder: (tasks: Task[]) => void;
  tagMap?: Record<string, Tag>;
  showFullMonth: boolean;
  onToggleFullMonth: () => void;
  activeId: UniqueIdentifier | null;
  overId: UniqueIdentifier | null;
  offsetLeft: number;
}

export function TimelineView({
  tasks,
  listFilter,
  onToggle,
  onEdit,
  updateTask,
  onReorder,
  tagMap,
  showFullMonth,
  onToggleFullMonth,
  activeId,
  overId,
  offsetLeft,
}: TimelineViewProps) {
  const { currentMonth, goToPreviousMonth, goToNextMonth, goToToday } =
    useTimelineState();

  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  // Apply list filter first, then filter for month
  const filteredTasks = useMemo(() => {
    return listFilter ? listFilter(tasks) : tasks;
  }, [tasks, listFilter]);

  // All non-archived tasks (before month filtering) — needed for reorder merge
  const activeTasks = useMemo(
    () => excludeArchivedTasks(filteredTasks),
    [filteredTasks]
  );

  const visibleTasks = useMemo(
    () => getTasksForMonth(filteredTasks, currentMonth, monthEnd),
    [filteredTasks, currentMonth, monthEnd]
  );

  // Root-level tasks not visible in the timeline (no dates in current month)
  // Must be preserved when reordering to avoid deleting them
  const tasksNotInTimeline = useMemo(() => {
    const visibleIds = new Set(visibleTasks.map((t) => t.id));
    return activeTasks.filter((t) => !visibleIds.has(t.id));
  }, [activeTasks, visibleTasks]);

  // Collapsed task IDs (shared with All Tasks tab)
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

  // Collapsible section state
  const [recurringOpen, setRecurringOpen] = useState(() =>
    readSectionState(TIMELINE_RECURRING_SECTION_KEY)
  );
  const [nonRecurringOpen, setNonRecurringOpen] = useState(() =>
    readSectionState(TIMELINE_NON_RECURRING_SECTION_KEY)
  );

  function toggleRecurring() {
    setRecurringOpen((prev) => {
      const next = !prev;
      localStorage.setItem(TIMELINE_RECURRING_SECTION_KEY, String(next));
      return next;
    });
  }

  function toggleNonRecurring() {
    setNonRecurringOpen((prev) => {
      const next = !prev;
      localStorage.setItem(TIMELINE_NON_RECURRING_SECTION_KEY, String(next));
      return next;
    });
  }

  // Split into recurring / non-recurring
  const recurringTasks = useMemo(
    () => visibleTasks.filter((t) => !!t.recurrence),
    [visibleTasks]
  );
  const nonRecurringTasks = useMemo(
    () => visibleTasks.filter((t) => !t.recurrence),
    [visibleTasks]
  );

  // Flatten each group
  const fullFlattenedRecurring = useMemo(
    () => flattenTree(recurringTasks),
    [recurringTasks]
  );
  const fullFlattenedNonRecurring = useMemo(
    () => flattenTree(nonRecurringTasks),
    [nonRecurringTasks]
  );

  // Filter out collapsed descendants
  const flattenedRecurring = useMemo(
    () => filterCollapsed(fullFlattenedRecurring, collapsedIds),
    [fullFlattenedRecurring, collapsedIds]
  );
  const flattenedNonRecurring = useMemo(
    () => filterCollapsed(fullFlattenedNonRecurring, collapsedIds),
    [fullFlattenedNonRecurring, collapsedIds]
  );

  // Sortable IDs
  const recurringIds = useMemo(
    () => flattenedRecurring.map(({ id }) => id),
    [flattenedRecurring]
  );
  const nonRecurringIds = useMemo(
    () => flattenedNonRecurring.map(({ id }) => id),
    [flattenedNonRecurring]
  );

  // Determine which group the active item belongs to
  const activeIsRecurring = activeId
    ? fullFlattenedRecurring.some(({ id }) => id === activeId)
    : false;

  const activeFlattenedItems = activeIsRecurring
    ? flattenedRecurring
    : flattenedNonRecurring;
  const activeGroupTasks = activeIsRecurring
    ? recurringTasks
    : nonRecurringTasks;

  // Guard overId against sidebar droppable IDs
  const safeOverId =
    overId && !isSidebarDroppableId(String(overId)) ? overId : null;

  const projected =
    activeId && safeOverId
      ? getProjection(
          activeFlattenedItems,
          activeId as string,
          safeOverId as string,
          offsetLeft,
          INDENTATION_WIDTH
        )
      : null;

  // DnD reorder handler
  useDndMonitor({
    onDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      if (!over) return;

      // Skip sidebar drops (handled by page.tsx)
      if (isSidebarDroppableId(String(over.id))) return;

      // Skip if active item isn't in our groups
      const activeInRecurring = fullFlattenedRecurring.some(
        ({ id }) => id === active.id
      );
      const activeInNonRecurring = fullFlattenedNonRecurring.some(
        ({ id }) => id === active.id
      );
      if (!activeInRecurring && !activeInNonRecurring) return;

      if (active.id === over.id || !projected) return;

      const { depth, parentId } = projected;

      // Prevent nesting under a recurring task
      if (parentId) {
        const parent = findItemDeep(filteredTasks, parentId);
        if (parent?.recurrence) return;
      }

      const clonedItems = flattenTree(activeGroupTasks);
      const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
      const overIndex = clonedItems.findIndex(({ id }) => id === over.id);

      // Cross-section drop guard
      if (overIndex === -1) return;

      clonedItems[activeIndex] = {
        ...clonedItems[activeIndex],
        depth,
        parentId,
      };

      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
      const newGroupTree = buildTree(sortedItems);

      const isRecurring = fullFlattenedRecurring.some(
        ({ id }) => id === active.id
      );
      // Merge reordered group + other visible group + tasks not in timeline
      // so that tasks without dates (or dates outside this month) aren't lost
      const newTree = isRecurring
        ? [...newGroupTree, ...nonRecurringTasks, ...tasksNotInTimeline]
        : [...recurringTasks, ...newGroupTree, ...tasksNotInTimeline];

      onReorder(newTree);
    },
  });

  const activeIdStr = activeId ? String(activeId) : null;

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousMonth}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold w-44 text-center">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleFullMonth}
            title={showFullMonth ? "Fit to panel" : "Show full month"}
          >
            {showFullMonth ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
      </div>

      {/* Sections */}
      {visibleTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
          <p className="text-lg font-medium">No tasks in this month</p>
          <p className="text-sm text-muted-foreground">
            Tasks with dates will appear on the timeline
          </p>
        </div>
      ) : (
        <>
          <CollapsibleSection
            title="Recurring"
            open={recurringOpen}
            onToggle={toggleRecurring}
            count={recurringTasks.length}
          >
            {flattenedRecurring.length > 0 ? (
              <TimelineGrid
                allTasks={tasks}
                flattenedItems={flattenedRecurring}
                sortableIds={recurringIds}
                monthStart={currentMonth}
                monthEnd={monthEnd}
                onToggle={onToggle}
                onEdit={onEdit}
                updateTask={updateTask}
                tagMap={tagMap}
                activeId={activeIsRecurring ? activeIdStr : null}
                projected={activeIsRecurring ? projected : null}
                collapsedIds={collapsedIds}
                onToggleCollapse={toggleCollapsed}
              />
            ) : null}
          </CollapsibleSection>

          <CollapsibleSection
            title="Non-Recurring"
            open={nonRecurringOpen}
            onToggle={toggleNonRecurring}
            count={nonRecurringTasks.length}
          >
            {flattenedNonRecurring.length > 0 ? (
              <TimelineGrid
                allTasks={tasks}
                flattenedItems={flattenedNonRecurring}
                sortableIds={nonRecurringIds}
                monthStart={currentMonth}
                monthEnd={monthEnd}
                onToggle={onToggle}
                onEdit={onEdit}
                updateTask={updateTask}
                tagMap={tagMap}
                activeId={!activeIsRecurring ? activeIdStr : null}
                projected={!activeIsRecurring ? projected : null}
                collapsedIds={collapsedIds}
                onToggleCollapse={toggleCollapsed}
              />
            ) : null}
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  useDndMonitor,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Task, Tag, FlattenedTask } from "@/lib/types";
import {
  flattenTree,
  buildTree,
  getProjection,
  findItemDeep,
} from "@/lib/tree-utils";
import { INDENTATION_WIDTH, COLLAPSED_TASKS_KEY } from "@/lib/constants";
import { isSidebarDroppableId } from "@/lib/dnd-utils";
import { getBlockingTask } from "@/lib/dependency-utils";
import { TaskItem } from "./task-item";

const RECURRING_SECTION_KEY = "task-section-recurring-open";
const NON_RECURRING_SECTION_KEY = "task-section-nonrecurring-open"; // now used for "Scheduled"
const UNSCHEDULED_SECTION_KEY = "task-section-unscheduled-open";

function hasAnyDate(task: Task): boolean {
  return !!(task.dueDate || task.scheduledDate || task.startDate);
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

interface TaskTreeProps {
  tasks: Task[];
  allTasks: Task[];
  onReorder: (tasks: Task[]) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (parentId: string) => void;
  onArchive?: (id: string) => void;
  onFastForward?: (id: string) => void;
  activeTimerId: string | null;
  currentElapsedMs: number;
  onStartTimer: (taskId: string) => void;
  onPauseTimer: () => void;
  tagMap?: Record<string, Tag>;
  activeId: UniqueIdentifier | null;
  overId: UniqueIdentifier | null;
  offsetLeft: number;
}

export function TaskTree({
  tasks,
  allTasks,
  onReorder,
  onToggle,
  onDelete,
  onEdit,
  onAddSubtask,
  onArchive,
  onFastForward,
  activeTimerId,
  currentElapsedMs,
  onStartTimer,
  onPauseTimer,
  tagMap,
  activeId,
  overId,
  offsetLeft,
}: TaskTreeProps) {
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

  const [recurringOpen, setRecurringOpen] = useState(() => readSectionState(RECURRING_SECTION_KEY));
  const [scheduledOpen, setScheduledOpen] = useState(() => readSectionState(NON_RECURRING_SECTION_KEY));
  const [unscheduledOpen, setUnscheduledOpen] = useState(() => readSectionState(UNSCHEDULED_SECTION_KEY));

  function toggleRecurring() {
    setRecurringOpen((prev) => {
      const next = !prev;
      localStorage.setItem(RECURRING_SECTION_KEY, String(next));
      return next;
    });
  }

  function toggleScheduled() {
    setScheduledOpen((prev) => {
      const next = !prev;
      localStorage.setItem(NON_RECURRING_SECTION_KEY, String(next));
      return next;
    });
  }

  function toggleUnscheduled() {
    setUnscheduledOpen((prev) => {
      const next = !prev;
      localStorage.setItem(UNSCHEDULED_SECTION_KEY, String(next));
      return next;
    });
  }

  const recurringTasks = useMemo(() => tasks.filter((t) => !!t.recurrence), [tasks]);
  const scheduledTasks = useMemo(() => tasks.filter((t) => !t.recurrence && hasAnyDate(t)), [tasks]);
  const unscheduledTasks = useMemo(() => tasks.filter((t) => !t.recurrence && !hasAnyDate(t)), [tasks]);

  const fullFlattenedRecurring = useMemo(() => flattenTree(recurringTasks), [recurringTasks]);
  const fullFlattenedScheduled = useMemo(() => flattenTree(scheduledTasks), [scheduledTasks]);
  const fullFlattenedUnscheduled = useMemo(() => flattenTree(unscheduledTasks), [unscheduledTasks]);

  const flattenedRecurring = useMemo(() => filterCollapsed(fullFlattenedRecurring, collapsedIds), [fullFlattenedRecurring, collapsedIds]);
  const flattenedScheduled = useMemo(() => filterCollapsed(fullFlattenedScheduled, collapsedIds), [fullFlattenedScheduled, collapsedIds]);
  const flattenedUnscheduled = useMemo(() => filterCollapsed(fullFlattenedUnscheduled, collapsedIds), [fullFlattenedUnscheduled, collapsedIds]);

  const recurringIds = useMemo(() => flattenedRecurring.map(({ id }) => id), [flattenedRecurring]);
  const scheduledIds = useMemo(() => flattenedScheduled.map(({ id }) => id), [flattenedScheduled]);
  const unscheduledIds = useMemo(() => flattenedUnscheduled.map(({ id }) => id), [flattenedUnscheduled]);

  // Determine which of the 3 groups the active item belongs to
  const activeSection: "recurring" | "scheduled" | "unscheduled" | null = activeId
    ? fullFlattenedRecurring.some(({ id }) => id === activeId)
      ? "recurring"
      : fullFlattenedScheduled.some(({ id }) => id === activeId)
        ? "scheduled"
        : fullFlattenedUnscheduled.some(({ id }) => id === activeId)
          ? "unscheduled"
          : null
    : null;

  const activeFlattenedItems =
    activeSection === "recurring" ? flattenedRecurring
    : activeSection === "scheduled" ? flattenedScheduled
    : flattenedUnscheduled;

  // Guard overId against sidebar droppable IDs for projection
  const safeOverId = overId && !isSidebarDroppableId(String(overId)) ? overId : null;

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

  useDndMonitor({
    onDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      if (!over) return;

      // Skip if dropped on sidebar (handled by page.tsx)
      if (isSidebarDroppableId(String(over.id))) return;

      // Determine which group the active item belongs to
      const dragSection = fullFlattenedRecurring.some(({ id }) => id === active.id)
        ? "recurring"
        : fullFlattenedScheduled.some(({ id }) => id === active.id)
          ? "scheduled"
          : fullFlattenedUnscheduled.some(({ id }) => id === active.id)
            ? "unscheduled"
            : null;
      if (!dragSection) return;

      if (active.id === over.id || !projected) return;

      const { depth, parentId } = projected;

      // Prevent nesting under a recurring task
      if (parentId) {
        const parent = findItemDeep(tasks, parentId);
        if (parent?.recurrence) return;
      }

      const dragGroupTasks =
        dragSection === "recurring" ? recurringTasks
        : dragSection === "scheduled" ? scheduledTasks
        : unscheduledTasks;

      const clonedItems = flattenTree(dragGroupTasks);
      const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
      const overIndex = clonedItems.findIndex(({ id }) => id === over.id);

      // If the over item is not in the same group, cancel
      if (overIndex === -1) return;

      clonedItems[activeIndex] = {
        ...clonedItems[activeIndex],
        depth,
        parentId,
      };

      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
      const newGroupTree = buildTree(sortedItems);

      const newTree =
        dragSection === "recurring"
          ? [...newGroupTree, ...scheduledTasks, ...unscheduledTasks]
          : dragSection === "scheduled"
            ? [...recurringTasks, ...newGroupTree, ...unscheduledTasks]
            : [...recurringTasks, ...scheduledTasks, ...newGroupTree];

      onReorder(newTree);
    },
  });

  function renderTaskItem(task: FlattenedTask) {
    const blockingTask = getBlockingTask(allTasks, task);
    return (
      <TaskItem
        key={task.id}
        task={task}
        depth={
          task.id === (activeId as string) && projected
            ? projected.depth
            : task.depth
        }
        indentationWidth={INDENTATION_WIDTH}
        onToggle={onToggle}
        onDelete={onDelete}
        onEdit={onEdit}
        onAddSubtask={onAddSubtask}
        onArchive={onArchive}
        onFastForward={onFastForward}
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
    <>
      <CollapsibleSection
        title="Recurring"
        open={recurringOpen}
        onToggle={toggleRecurring}
        count={recurringTasks.length}
      >
        <SortableContext items={recurringIds} strategy={verticalListSortingStrategy}>
          {flattenedRecurring.map(renderTaskItem)}
        </SortableContext>
      </CollapsibleSection>

      <CollapsibleSection
        title="Scheduled"
        open={scheduledOpen}
        onToggle={toggleScheduled}
        count={scheduledTasks.length}
      >
        <SortableContext items={scheduledIds} strategy={verticalListSortingStrategy}>
          {flattenedScheduled.map(renderTaskItem)}
        </SortableContext>
      </CollapsibleSection>

      <CollapsibleSection
        title="Unscheduled"
        open={unscheduledOpen}
        onToggle={toggleUnscheduled}
        count={unscheduledTasks.length}
      >
        <SortableContext items={unscheduledIds} strategy={verticalListSortingStrategy}>
          {flattenedUnscheduled.map(renderTaskItem)}
        </SortableContext>
      </CollapsibleSection>
    </>
  );
}

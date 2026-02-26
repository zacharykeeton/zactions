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
const NON_RECURRING_SECTION_KEY = "task-section-nonrecurring-open";

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
  const [nonRecurringOpen, setNonRecurringOpen] = useState(() => readSectionState(NON_RECURRING_SECTION_KEY));

  function toggleRecurring() {
    setRecurringOpen((prev) => {
      const next = !prev;
      localStorage.setItem(RECURRING_SECTION_KEY, String(next));
      return next;
    });
  }

  function toggleNonRecurring() {
    setNonRecurringOpen((prev) => {
      const next = !prev;
      localStorage.setItem(NON_RECURRING_SECTION_KEY, String(next));
      return next;
    });
  }

  const recurringTasks = useMemo(() => tasks.filter((t) => !!t.recurrence), [tasks]);
  const nonRecurringTasks = useMemo(() => tasks.filter((t) => !t.recurrence), [tasks]);

  const fullFlattenedRecurring = useMemo(() => flattenTree(recurringTasks), [recurringTasks]);
  const fullFlattenedNonRecurring = useMemo(() => flattenTree(nonRecurringTasks), [nonRecurringTasks]);

  const flattenedRecurring = useMemo(() => filterCollapsed(fullFlattenedRecurring, collapsedIds), [fullFlattenedRecurring, collapsedIds]);
  const flattenedNonRecurring = useMemo(() => filterCollapsed(fullFlattenedNonRecurring, collapsedIds), [fullFlattenedNonRecurring, collapsedIds]);

  const recurringIds = useMemo(() => flattenedRecurring.map(({ id }) => id), [flattenedRecurring]);
  const nonRecurringIds = useMemo(() => flattenedNonRecurring.map(({ id }) => id), [flattenedNonRecurring]);

  // Determine which group the active item belongs to
  const activeIsRecurring = activeId
    ? fullFlattenedRecurring.some(({ id }) => id === activeId)
    : false;

  const activeFlattenedItems = activeIsRecurring ? flattenedRecurring : flattenedNonRecurring;
  const activeGroupTasks = activeIsRecurring ? recurringTasks : nonRecurringTasks;

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

      // Skip if active item isn't in our groups
      const activeInRecurring = fullFlattenedRecurring.some(({ id }) => id === active.id);
      const activeInNonRecurring = fullFlattenedNonRecurring.some(({ id }) => id === active.id);
      if (!activeInRecurring && !activeInNonRecurring) return;

      if (active.id === over.id || !projected) return;

      const { depth, parentId } = projected;

      // Prevent nesting under a recurring task
      if (parentId) {
        const parent = findItemDeep(tasks, parentId);
        if (parent?.recurrence) return;
      }

      const clonedItems = flattenTree(activeGroupTasks);
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

      const isRecurring = fullFlattenedRecurring.some(({ id }) => id === active.id);
      const newTree = isRecurring
        ? [...newGroupTree, ...nonRecurringTasks]
        : [...recurringTasks, ...newGroupTree];

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
        title="Non-Recurring"
        open={nonRecurringOpen}
        onToggle={toggleNonRecurring}
        count={nonRecurringTasks.length}
      >
        <SortableContext items={nonRecurringIds} strategy={verticalListSortingStrategy}>
          {flattenedNonRecurring.map(renderTaskItem)}
        </SortableContext>
      </CollapsibleSection>
    </>
  );
}

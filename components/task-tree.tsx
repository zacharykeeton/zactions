"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  MeasuringStrategy,
  type UniqueIdentifier,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Task } from "@/lib/types";
import {
  flattenTree,
  buildTree,
  getProjection,
  getChildCount,
  findItemDeep,
} from "@/lib/tree-utils";
import { INDENTATION_WIDTH } from "@/lib/constants";
import { TaskItem, TaskItemOverlay } from "./task-item";

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

const dropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

const RECURRING_SECTION_KEY = "task-section-recurring-open";
const NON_RECURRING_SECTION_KEY = "task-section-nonrecurring-open";

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
}

export function TaskTree({
  tasks,
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
}: TaskTreeProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

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

  const flattenedRecurring = useMemo(() => flattenTree(recurringTasks), [recurringTasks]);
  const flattenedNonRecurring = useMemo(() => flattenTree(nonRecurringTasks), [nonRecurringTasks]);

  const recurringIds = useMemo(() => flattenedRecurring.map(({ id }) => id), [flattenedRecurring]);
  const nonRecurringIds = useMemo(() => flattenedNonRecurring.map(({ id }) => id), [flattenedNonRecurring]);

  // Combined flattened list is only used for finding the active item for DragOverlay
  const allFlattenedItems = useMemo(
    () => [...flattenedRecurring, ...flattenedNonRecurring],
    [flattenedRecurring, flattenedNonRecurring]
  );

  const activeItem = activeId ? allFlattenedItems.find(({ id }) => id === activeId) : null;

  // Determine which group the active item belongs to
  const activeIsRecurring = activeId
    ? recurringIds.includes(activeId as string)
    : false;

  const activeFlattenedItems = activeIsRecurring ? flattenedRecurring : flattenedNonRecurring;
  const activeGroupTasks = activeIsRecurring ? recurringTasks : nonRecurringTasks;

  const projected =
    activeId && overId
      ? getProjection(
          activeFlattenedItems,
          activeId as string,
          overId as string,
          offsetLeft,
          INDENTATION_WIDTH
        )
      : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id);
    setOverId(active.id);
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x);
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over?.id ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    resetState();
    if (!over || active.id === over.id || !projected) return;

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

    const newTree = activeIsRecurring
      ? [...newGroupTree, ...nonRecurringTasks]
      : [...recurringTasks, ...newGroupTree];

    onReorder(newTree);
  }

  function handleDragCancel() {
    resetState();
  }

  function resetState() {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  }

  function renderTaskItem(task: (typeof allFlattenedItems)[number]) {
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
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={measuring}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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

      <DragOverlay dropAnimation={dropAnimation}>
        {activeId && activeItem ? (
          <TaskItemOverlay
            task={activeItem}
            childCount={getChildCount(tasks, activeId as string)}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

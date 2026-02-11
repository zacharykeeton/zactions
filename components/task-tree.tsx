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

interface TaskTreeProps {
  tasks: Task[];
  onReorder: (tasks: Task[]) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (parentId: string) => void;
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
  activeTimerId,
  currentElapsedMs,
  onStartTimer,
  onPauseTimer,
}: TaskTreeProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const flattenedItems = useMemo(() => flattenTree(tasks), [tasks]);
  const sortedIds = useMemo(
    () => flattenedItems.map(({ id }) => id),
    [flattenedItems]
  );

  const activeItem = activeId
    ? flattenedItems.find(({ id }) => id === activeId)
    : null;

  const projected =
    activeId && overId
      ? getProjection(
          flattenedItems,
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
    const clonedItems = flattenTree(tasks);

    const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
    const overIndex = clonedItems.findIndex(({ id }) => id === over.id);

    // Update the active item with projected depth/parent
    clonedItems[activeIndex] = {
      ...clonedItems[activeIndex],
      depth,
      parentId,
    };

    const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
    const newTree = buildTree(sortedItems);
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
      <SortableContext
        items={sortedIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col">
          {flattenedItems.map((task) => (
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
              isTimerActive={task.id === activeTimerId}
              displayTimeMs={
                task.id === activeTimerId
                  ? task.timeInvestedMs + currentElapsedMs
                  : task.timeInvestedMs
              }
              onStartTimer={onStartTimer}
              onPauseTimer={onPauseTimer}
            />
          ))}
        </div>
      </SortableContext>
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

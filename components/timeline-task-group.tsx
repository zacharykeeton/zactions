"use client";

import type { Task } from "@/lib/types";
import { TimelineTaskBar } from "@/components/timeline-task-row";

interface TimelineTaskGroupProps {
  parent: Task;
  children: Task[];
  daysInMonth: number;
  monthStart: Date;
  monthEnd: Date;
  isDragging: boolean;
  dragTaskId: string | null;
  previewOffset: number;
  onBarPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onStartEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onEndEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
}

/**
 * Renders a bordered group of bars in the timeline's right panel,
 * visually grouping a parent task with its children.
 */
export function TimelineTaskGroup({
  parent,
  children,
  daysInMonth,
  monthStart,
  monthEnd,
  isDragging,
  dragTaskId,
  previewOffset,
  onBarPointerDown,
  onStartEndpointPointerDown,
  onEndEndpointPointerDown,
}: TimelineTaskGroupProps) {
  const dragProps = {
    isDragging,
    dragTaskId,
    previewOffset,
    onBarPointerDown,
    onStartEndpointPointerDown,
    onEndEndpointPointerDown,
  };

  const barProps = {
    daysInMonth,
    monthStart,
    monthEnd,
    ...dragProps,
  };

  return (
    <div className="ring-1 ring-border/60 rounded-lg">
      <TimelineTaskBar task={parent} {...barProps} />
      {children.map((child) => (
        <TimelineTaskBar key={child.id} task={child} {...barProps} />
      ))}
    </div>
  );
}

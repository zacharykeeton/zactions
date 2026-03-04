"use client";

import { type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import type { Task, Tag, FlattenedTask } from "@/lib/types";
import type { DragType } from "@/hooks/use-timeline-drag";
import {
  TimelineTaskLabel,
  TimelineTaskBar,
} from "@/components/timeline-task-row";

interface TimelineSortableRowProps {
  task: FlattenedTask;
  depth: number;
  daysInMonth: number;
  monthStart: Date;
  monthEnd: Date;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  tagMap?: Record<string, Tag>;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggleCollapse: (id: string) => void;
  isDragging: boolean;
  dragType: DragType | null;
  dragTaskId: string | null;
  previewOffset: number;
  onBarPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onStartEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onEndEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onScheduledEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
  labelWidth: number;
  onAddSubtask?: (parentId: string) => void;
}

export function TimelineSortableRow({
  task,
  depth,
  daysInMonth,
  monthStart,
  monthEnd,
  onToggle,
  onEdit,
  tagMap,
  hasChildren,
  isCollapsed,
  onToggleCollapse,
  isDragging: dateDragging,
  dragType,
  dragTaskId,
  previewOffset,
  onBarPointerDown,
  onStartEndpointPointerDown,
  onEndEndpointPointerDown,
  onScheduledEndpointPointerDown,
  labelWidth,
  onAddSubtask,
}: TimelineSortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging: isSortDragging,
  } = useSortable({ id: task.id });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isSortDragging ? 0.4 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex"
    >
      {/* Left panel: indent + chevron + grip + label */}
      <div
        className="shrink-0 flex items-center border-r border-border bg-background"
        style={{ width: labelWidth }}
      >
        {/* Depth indentation */}
        <div
          className="shrink-0"
          style={{ width: `${depth * 16 + 4}px` }}
        />
        {/* Collapse chevron or spacer */}
        {hasChildren ? (
          <button
            onClick={() => onToggleCollapse(task.id)}
            className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        ) : (
          <div className="shrink-0 w-4" />
        )}
        {/* Drag handle */}
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          className="shrink-0 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        {/* Label — flex-1 + min-w-0 so truncation works */}
        <div className="flex-1 min-w-0">
          <TimelineTaskLabel
            task={task}
            onToggle={onToggle}
            onEdit={onEdit}
            tagMap={tagMap}
            indent={0}
            onAddSubtask={onAddSubtask}
          />
        </div>
      </div>

      {/* Right panel: bar */}
      <div className="flex-1 overflow-hidden">
        <TimelineTaskBar
          task={task}
          daysInMonth={daysInMonth}
          monthStart={monthStart}
          monthEnd={monthEnd}
          isDragging={dateDragging}
          dragType={dragType}
          dragTaskId={dragTaskId}
          previewOffset={previewOffset}
          onBarPointerDown={onBarPointerDown}
          onStartEndpointPointerDown={onStartEndpointPointerDown}
          onEndEndpointPointerDown={onEndEndpointPointerDown}
          onScheduledEndpointPointerDown={onScheduledEndpointPointerDown}
        />
      </div>
    </div>
  );
}

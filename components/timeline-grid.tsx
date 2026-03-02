"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { isSameMonth, getDate } from "date-fns";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Task, Tag, FlattenedTask } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getDaysInMonthArray, isDayWeekend } from "@/lib/timeline-utils";
import { findItemDeep } from "@/lib/tree-utils";
import { GripVertical } from "lucide-react";
import { TIMELINE_LABEL_WIDTH, TIMELINE_LABEL_WIDTH_KEY } from "@/lib/constants";
import { useGridDayWidth } from "@/hooks/use-grid-day-width";
import { useTimelineDrag } from "@/hooks/use-timeline-drag";
import { TimelineSortableRow } from "@/components/timeline-sortable-row";
import { TooltipProvider } from "@/components/ui/tooltip";

interface TimelineGridProps {
  allTasks: Task[];
  flattenedItems: FlattenedTask[];
  sortableIds: string[];
  monthStart: Date;
  monthEnd: Date;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  updateTask: (
    id: string,
    updates: Partial<Omit<Task, "id" | "children">>
  ) => void;
  tagMap?: Record<string, Tag>;
  activeId: string | null;
  projected: { depth: number; parentId: string | null } | null;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
}

export function TimelineGrid({
  allTasks,
  flattenedItems,
  sortableIds,
  monthStart,
  monthEnd,
  onToggle,
  onEdit,
  updateTask,
  tagMap,
  activeId,
  projected,
  collapsedIds,
  onToggleCollapse,
}: TimelineGridProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const [labelWidth, setLabelWidth] = useState(() => {
    if (typeof window === "undefined") return TIMELINE_LABEL_WIDTH;
    const stored = localStorage.getItem(TIMELINE_LABEL_WIDTH_KEY);
    return stored ? Number(stored) : TIMELINE_LABEL_WIDTH;
  });

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      resizeRef.current = { startX: e.clientX, startWidth: labelWidth };

      const onMove = (ev: PointerEvent) => {
        if (!resizeRef.current) return;
        const newWidth = Math.max(
          120,
          Math.min(500, resizeRef.current.startWidth + (ev.clientX - resizeRef.current.startX))
        );
        setLabelWidth(newWidth);
      };

      const onUp = () => {
        resizeRef.current = null;
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        setLabelWidth((w) => {
          localStorage.setItem(TIMELINE_LABEL_WIDTH_KEY, String(w));
          return w;
        });
      };

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    },
    [labelWidth]
  );

  const days = useMemo(() => getDaysInMonthArray(monthStart), [monthStart]);

  const { isCurrentMonth, todayDay } = useMemo(() => {
    const today = new Date();
    return {
      isCurrentMonth: isSameMonth(today, monthStart),
      todayDay: getDate(today),
    };
  }, [monthStart]);

  const dayWidth = useGridDayWidth(timelineRef, days.length);

  const findTask = useCallback(
    (id: string) => findItemDeep(allTasks, id),
    [allTasks]
  );

  const {
    isDragging,
    dragType,
    dragTaskId,
    previewOffset,
    handleBarPointerDown,
    handleStartEndpointPointerDown,
    handleEndEndpointPointerDown,
    handleScheduledEndpointPointerDown,
  } = useTimelineDrag({ dayWidth, onDateChange: updateTask, findTask });

  const dragProps = {
    isDragging,
    dragType,
    dragTaskId,
    previewOffset,
    onBarPointerDown: handleBarPointerDown,
    onStartEndpointPointerDown: handleStartEndpointPointerDown,
    onEndEndpointPointerDown: handleEndEndpointPointerDown,
    onScheduledEndpointPointerDown: handleScheduledEndpointPointerDown,
  };

  if (flattenedItems.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="border rounded-lg overflow-hidden relative">
        {/* Header row */}
        <div className="flex">
          <div
            className="shrink-0 border-r border-border bg-background"
            style={{ width: labelWidth }}
          >
            <div className="h-10 border-b border-border flex items-center px-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tasks
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden" ref={timelineRef}>
            <div className="flex h-10 border-b border-border">
              {days.map((day) => (
                <div
                  key={day}
                  className={cn(
                    "flex-1 flex items-center justify-center text-xs font-medium border-r border-dashed border-border/40",
                    isDayWeekend(day, monthStart) &&
                      "bg-red-50/60 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-semibold",
                    isCurrentMonth &&
                      todayDay === day &&
                      "bg-primary/10 font-bold text-primary"
                  )}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Task rows */}
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="relative">
            {/* Grid decorations over right panel */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-0"
              style={{ left: labelWidth, right: 0 }}
            >
              <div className="absolute inset-0 flex" aria-hidden="true">
                {days.map((day) => (
                  <div
                    key={day}
                    className={cn(
                      "flex-1 border-r border-dashed border-border/30",
                      isDayWeekend(day, monthStart) && "bg-red-50/30 dark:bg-red-950/10"
                    )}
                  />
                ))}
              </div>

              {/* Today marker */}
              {isCurrentMonth && (
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-500 z-20 pointer-events-none"
                  style={{
                    left: `${((todayDay - 0.5) / days.length) * 100}%`,
                  }}
                />
              )}
            </div>

            {flattenedItems.map((item) => (
              <TimelineSortableRow
                key={item.id}
                task={item}
                depth={
                  item.id === activeId && projected
                    ? projected.depth
                    : item.depth
                }
                daysInMonth={days.length}
                monthStart={monthStart}
                monthEnd={monthEnd}
                onToggle={onToggle}
                onEdit={onEdit}
                tagMap={tagMap}
                hasChildren={item.children.length > 0}
                isCollapsed={collapsedIds.has(item.id)}
                onToggleCollapse={onToggleCollapse}
                labelWidth={labelWidth}
                {...dragProps}
              />
            ))}
          </div>
        </SortableContext>

        {/* Resize handle */}
        <div
          className="absolute top-0 bottom-0 z-10 w-2 -translate-x-1/2 cursor-col-resize group/resize flex items-center justify-center"
          style={{ left: labelWidth }}
          onPointerDown={handleResizePointerDown}
        >
          <div className="absolute inset-y-0 w-px bg-border/0 group-hover/resize:bg-border/60 group-active/resize:bg-primary/40 transition-colors" />
          <div className="opacity-0 group-hover/resize:opacity-100 group-active/resize:opacity-100 transition-opacity bg-muted border rounded-sm p-0.5">
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

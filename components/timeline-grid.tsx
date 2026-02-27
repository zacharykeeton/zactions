"use client";

import { useRef, useCallback, useMemo } from "react";
import { isSameMonth, getDate } from "date-fns";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Task, Tag, FlattenedTask } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getDaysInMonthArray, isDayWeekend } from "@/lib/timeline-utils";
import { findItemDeep } from "@/lib/tree-utils";
import { TIMELINE_LABEL_WIDTH } from "@/lib/constants";
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
      <div className="border rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="flex">
          <div
            className="shrink-0 border-r border-border bg-background"
            style={{ width: `${TIMELINE_LABEL_WIDTH}px` }}
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
              style={{ left: `${TIMELINE_LABEL_WIDTH}px`, right: 0 }}
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
                {...dragProps}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </TooltipProvider>
  );
}

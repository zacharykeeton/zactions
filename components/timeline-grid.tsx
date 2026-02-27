"use client";

import { useRef, useCallback, useMemo } from "react";
import { isSameMonth, getDate } from "date-fns";
import type { Task, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  getDaysInMonthArray,
  isDayWeekend,
  getTasksForMonth,
} from "@/lib/timeline-utils";
import { findItemDeep } from "@/lib/tree-utils";
import { TIMELINE_LABEL_WIDTH } from "@/lib/constants";
import { useGridDayWidth } from "@/hooks/use-grid-day-width";
import { useTimelineDrag } from "@/hooks/use-timeline-drag";
import {
  TimelineTaskLabel,
  TimelineTaskBar,
} from "@/components/timeline-task-row";
import { TimelineTaskGroup } from "@/components/timeline-task-group";
import { TooltipProvider } from "@/components/ui/tooltip";

interface TimelineGridProps {
  tasks: Task[];
  monthStart: Date;
  monthEnd: Date;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  updateTask: (
    id: string,
    updates: Partial<Omit<Task, "id" | "children">>
  ) => void;
  tagMap?: Record<string, Tag>;
}

export function TimelineGrid({
  tasks,
  monthStart,
  monthEnd,
  onToggle,
  onEdit,
  updateTask,
  tagMap,
}: TimelineGridProps) {
  const timelineRef = useRef<HTMLDivElement>(null);

  const visibleTasks = useMemo(
    () => getTasksForMonth(tasks, monthStart, monthEnd),
    [tasks, monthStart, monthEnd]
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
    (id: string) => findItemDeep(tasks, id),
    [tasks]
  );

  const {
    isDragging,
    dragTaskId,
    previewOffset,
    handleBarPointerDown,
    handleStartEndpointPointerDown,
    handleEndEndpointPointerDown,
  } = useTimelineDrag({ dayWidth, onDateChange: updateTask, findTask });

  const dragProps = {
    isDragging,
    dragTaskId,
    previewOffset,
    onBarPointerDown: handleBarPointerDown,
    onStartEndpointPointerDown: handleStartEndpointPointerDown,
    onEndEndpointPointerDown: handleEndEndpointPointerDown,
  };

  // Memoize static grid decorations — only changes when month changes
  const gridDecorations = useMemo(
    () => (
      <div className="absolute inset-0 pointer-events-none flex" aria-hidden="true">
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
    ),
    [days, monthStart]
  );

  // Memoize day headers
  const dayHeaders = useMemo(
    () => (
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
    ),
    [days, monthStart, isCurrentMonth, todayDay]
  );

  if (visibleTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
        <p className="text-lg font-medium">No tasks in this month</p>
        <p className="text-sm text-muted-foreground">
          Tasks with dates will appear on the timeline
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex border rounded-lg overflow-hidden">
        {/* Left panel: task labels */}
        <div
          className="shrink-0 border-r border-border bg-background z-10"
          style={{ width: `${TIMELINE_LABEL_WIDTH}px` }}
        >
          <div className="h-10 border-b border-border flex items-center px-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tasks
            </span>
          </div>

          {visibleTasks.map((task) => (
            <div key={`label-group-${task.id}`}>
              <TimelineTaskLabel
                task={task}
                onToggle={onToggle}
                onEdit={onEdit}
                tagMap={tagMap}
                indent={0}
              />
              {task.children.map((child) => (
                <TimelineTaskLabel
                  key={`label-${child.id}`}
                  task={child}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  tagMap={tagMap}
                  indent={1}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Right panel: timeline area */}
        <div className="flex-1 overflow-hidden">
          <div ref={timelineRef}>
            {dayHeaders}

            {/* Task bars area */}
            <div className="relative">
              {gridDecorations}

              {/* Today marker */}
              {isCurrentMonth && (
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-500 z-20 pointer-events-none"
                  style={{
                    left: `${((todayDay - 0.5) / days.length) * 100}%`,
                  }}
                />
              )}

              {/* Task bar rows */}
              {visibleTasks.map((task) =>
                task.children.length > 0 ? (
                  <TimelineTaskGroup
                    key={`group-${task.id}`}
                    parent={task}
                    daysInMonth={days.length}
                    monthStart={monthStart}
                    monthEnd={monthEnd}
                    {...dragProps}
                  >
                    {task.children}
                  </TimelineTaskGroup>
                ) : (
                  <TimelineTaskBar
                    key={`bar-${task.id}`}
                    task={task}
                    daysInMonth={days.length}
                    monthStart={monthStart}
                    monthEnd={monthEnd}
                    {...dragProps}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

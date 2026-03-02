"use client";

import type { Task, Tag } from "@/lib/types";
import type { DragType } from "@/hooks/use-timeline-drag";
import { cn } from "@/lib/utils";
import { getBarColumns, getTaskDateRange, clampToMonth, getDayColumn } from "@/lib/timeline-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { TimelineBar } from "@/components/timeline-bar";
import { priorityColors, TAG_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parseISO, isBefore, isAfter } from "date-fns";

interface TimelineTaskRowProps {
  task: Task;
  daysInMonth: number;
  monthStart: Date;
  monthEnd: Date;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  tagMap?: Record<string, Tag>;
  isDragging: boolean;
  dragType: DragType | null;
  dragTaskId: string | null;
  previewOffset: number;
  onBarPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onStartEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onEndEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onScheduledEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
  indent?: number;
}

/** Task label cell for the left panel */
export function TimelineTaskLabel({
  task,
  onToggle,
  onEdit,
  tagMap,
  indent = 0,
}: Pick<TimelineTaskRowProps, "task" | "onToggle" | "onEdit" | "tagMap" | "indent">) {
  const range = getTaskDateRange(task);
  const dateLabel = !range.start
    ? "No date"
    : !range.end || range.start === range.end
      ? format(parseISO(range.start), "MMM d")
      : `${format(parseISO(range.start), "MMM d")} – ${format(parseISO(range.end), "MMM d")}`;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 h-9 border-b border-border/40 truncate",
        task.completed && "opacity-50"
      )}
      style={{ paddingLeft: `${8 + indent * 16}px` }}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggle(task.id)}
        className="shrink-0"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "truncate text-sm text-left hover:underline cursor-pointer",
              task.completed && "line-through text-muted-foreground"
            )}
            onClick={() => onEdit(task)}
          >
            {task.title}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{task.title}</p>
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
            {task.tags && task.tags.length > 0 && tagMap && (
              <div className="flex gap-1 flex-wrap">
                {task.tags.map((tagId) => {
                  const tag = tagMap[tagId];
                  if (!tag) return null;
                  return (
                    <Badge
                      key={tagId}
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1 py-0",
                        TAG_COLORS[tag.color]?.badge
                      )}
                    >
                      {tag.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
      <Badge
        variant="outline"
        className={cn("text-[10px] px-1 py-0 shrink-0", priorityColors[task.priority])}
      >
        {task.priority[0].toUpperCase()}
      </Badge>
    </div>
  );
}

/** Task bar row for the right timeline panel */
export function TimelineTaskBar({
  task,
  daysInMonth,
  monthStart,
  monthEnd,
  isDragging,
  dragType,
  dragTaskId,
  previewOffset,
  onBarPointerDown,
  onStartEndpointPointerDown,
  onEndEndpointPointerDown,
  onScheduledEndpointPointerDown,
}: Omit<TimelineTaskRowProps, "onToggle" | "onEdit" | "tagMap" | "indent">) {
  const columns = getBarColumns(task, monthStart, monthEnd);
  const isThisDragging = isDragging && dragTaskId === task.id;

  if (!columns) {
    return <div className="h-9 border-b border-border/40" />;
  }

  const single = columns.startCol === columns.endCol;

  // Determine if start/end/scheduled dates fall outside the visible month
  const range = getTaskDateRange(task);
  const startOutOfRange = range.start ? isBefore(parseISO(range.start), monthStart) : false;
  const endOutOfRange = range.end ? isAfter(parseISO(range.end), monthEnd) : !!range.start;
  const scheduledOutOfRange = task.scheduledDate
    ? isBefore(parseISO(task.scheduledDate), monthStart) || isAfter(parseISO(task.scheduledDate), monthEnd)
    : false;

  // Position the bar container:
  //   Single-day: full day-column width (dot centered inside)
  //   Range: center-to-center so endpoints land on day-column centers,
  //          extending to the column edge when an endpoint is out of month
  let leftPercent: number;
  let widthPercent: number;
  if (single) {
    leftPercent = ((columns.startCol - 1) / daysInMonth) * 100;
    widthPercent = (1 / daysInMonth) * 100;
  } else {
    const left = startOutOfRange
      ? ((columns.startCol - 1) / daysInMonth) * 100
      : ((columns.startCol - 0.5) / daysInMonth) * 100;
    const right = endOutOfRange
      ? (columns.endCol / daysInMonth) * 100
      : ((columns.endCol - 0.5) / daysInMonth) * 100;
    leftPercent = left;
    widthPercent = right - left;
  }

  // Compute scheduled date marker position as a percentage within the bar
  let scheduledDatePercent: number | undefined;
  if (!single && task.scheduledDate) {
    const clampedScheduled = clampToMonth(task.scheduledDate, monthStart, monthEnd);
    const scheduledCol = getDayColumn(clampedScheduled);
    if (scheduledCol >= columns.startCol && scheduledCol <= columns.endCol) {
      // Map the center of the scheduled day column to a % within the container
      const scheduledCenter = ((scheduledCol - 0.5) / daysInMonth) * 100;
      if (widthPercent > 0) {
        scheduledDatePercent = ((scheduledCenter - leftPercent) / widthPercent) * 100;
      }
    }
  }

  return (
    <div className="h-9 relative flex items-center border-b border-border/40">
      <div
        className="absolute top-0 bottom-0 flex items-center"
        style={{
          left: `${leftPercent}%`,
          width: `${widthPercent}%`,
        }}
      >
        <TimelineBar
          taskId={task.id}
          isRange={!single}
          completed={task.completed}
          isDragging={isThisDragging}
          dragType={isThisDragging ? dragType : null}
          previewOffset={isThisDragging ? previewOffset : 0}
          scheduledDatePercent={scheduledDatePercent}
          startOutOfRange={startOutOfRange}
          endOutOfRange={endOutOfRange}
          scheduledOutOfRange={scheduledOutOfRange}
          onBarPointerDown={onBarPointerDown}
          onStartEndpointPointerDown={onStartEndpointPointerDown}
          onEndEndpointPointerDown={onEndEndpointPointerDown}
          onScheduledEndpointPointerDown={onScheduledEndpointPointerDown}
        />
      </div>
    </div>
  );
}

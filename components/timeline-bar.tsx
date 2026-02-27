"use client";

import type { DragType } from "@/hooks/use-timeline-drag";
import { cn } from "@/lib/utils";

interface TimelineBarProps {
  taskId: string;
  isRange: boolean;
  completed: boolean;
  isDragging: boolean;
  dragType: DragType | null;
  previewOffset: number;
  scheduledDatePercent?: number;
  onBarPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onStartEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onEndEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onScheduledEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
}

export function TimelineBar({
  taskId,
  isRange,
  completed,
  isDragging,
  dragType,
  previewOffset,
  scheduledDatePercent,
  onBarPointerDown,
  onStartEndpointPointerDown,
  onEndEndpointPointerDown,
  onScheduledEndpointPointerDown,
}: TimelineBarProps) {
  // Only shift the whole bar for non-scheduled drags
  const isScheduledDrag = isDragging && dragType === "scheduled-endpoint";
  const barTransform = isDragging && !isScheduledDrag ? `translateX(${previewOffset}px)` : undefined;

  if (!isRange) {
    // Single-day marker: centered filled circle
    return (
      <div
        className="flex items-center justify-center w-full h-5"
        style={{ transform: barTransform }}
      >
        <div
          className={cn(
            "h-3 w-3 rounded-full cursor-grab active:cursor-grabbing transition-colors",
            completed
              ? "bg-muted-foreground/40"
              : "bg-blue-500 dark:bg-blue-400"
          )}
          onPointerDown={(e) => onBarPointerDown(taskId, e)}
        />
      </div>
    );
  }

  // Range bar with endpoints
  return (
    <div
      className={cn("relative flex items-center w-full h-5", isDragging && "z-10")}
      style={{ transform: barTransform }}
    >
      {/* Bar body (connecting line) */}
      <div
        className={cn(
          "absolute inset-x-[7px] top-1/2 -translate-y-1/2 h-[3px] rounded-full cursor-grab active:cursor-grabbing transition-colors",
          completed
            ? "bg-muted-foreground/30"
            : "bg-blue-500 dark:bg-blue-400"
        )}
        onPointerDown={(e) => onBarPointerDown(taskId, e)}
      />

      {/* Start endpoint */}
      <div
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 cursor-ew-resize z-10 transition-colors",
          completed
            ? "bg-muted-foreground/40 border-background"
            : "bg-blue-500 dark:bg-blue-400 border-background"
        )}
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartEndpointPointerDown(taskId, e);
        }}
      />

      {/* End endpoint */}
      <div
        className={cn(
          "absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 cursor-ew-resize z-10 transition-colors",
          completed
            ? "bg-muted-foreground/40 border-background"
            : "bg-blue-500 dark:bg-blue-400 border-background"
        )}
        onPointerDown={(e) => {
          e.stopPropagation();
          onEndEndpointPointerDown(taskId, e);
        }}
      />

      {/* Scheduled date marker */}
      {scheduledDatePercent !== undefined && (
        <div
          className={cn(
            "absolute top-1/2 h-3 w-3 z-10 cursor-ew-resize transition-colors",
            completed
              ? "bg-muted-foreground/40"
              : "bg-blue-500 dark:bg-blue-400"
          )}
          style={{
            left: `${scheduledDatePercent}%`,
            transform: `translateY(-50%) translateX(calc(-50% + ${isScheduledDrag ? previewOffset : 0}px))`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onScheduledEndpointPointerDown(taskId, e);
          }}
        />
      )}
    </div>
  );
}

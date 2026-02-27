"use client";

import { cn } from "@/lib/utils";

interface TimelineBarProps {
  taskId: string;
  isRange: boolean;
  completed: boolean;
  isDragging: boolean;
  previewOffset: number;
  onBarPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onStartEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
  onEndEndpointPointerDown: (taskId: string, e: React.PointerEvent) => void;
}

export function TimelineBar({
  taskId,
  isRange,
  completed,
  isDragging,
  previewOffset,
  onBarPointerDown,
  onStartEndpointPointerDown,
  onEndEndpointPointerDown,
}: TimelineBarProps) {
  const transform = isDragging ? `translateX(${previewOffset}px)` : undefined;

  if (!isRange) {
    // Single-day marker: centered filled circle
    return (
      <div
        className="flex items-center justify-center w-full h-5"
        style={{ transform }}
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
      style={{ transform }}
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
    </div>
  );
}

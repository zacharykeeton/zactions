"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { addDays, format, parseISO } from "date-fns";
import type { Task } from "@/lib/types";
import { getTaskDateRange } from "@/lib/timeline-utils";

export type DragType = "bar" | "start-endpoint" | "end-endpoint";

interface UseTimelineDragOptions {
  dayWidth: number;
  onDateChange: (
    taskId: string,
    updates: Partial<Omit<Task, "id" | "children">>
  ) => void;
  findTask: (id: string) => Task | undefined;
}

interface UseTimelineDragReturn {
  isDragging: boolean;
  dragType: DragType | null;
  dragTaskId: string | null;
  previewOffset: number;
  handleBarPointerDown: (taskId: string, e: React.PointerEvent) => void;
  handleStartEndpointPointerDown: (
    taskId: string,
    e: React.PointerEvent
  ) => void;
  handleEndEndpointPointerDown: (
    taskId: string,
    e: React.PointerEvent
  ) => void;
}

function shiftDate(dateStr: string | null, days: number): string | null {
  if (!dateStr) return null;
  return format(addDays(parseISO(dateStr), days), "yyyy-MM-dd");
}

export function useTimelineDrag({
  dayWidth,
  onDateChange,
  findTask,
}: UseTimelineDragOptions): UseTimelineDragReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<DragType | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [previewOffset, setPreviewOffset] = useState(0);

  // Store mutable values in refs to avoid stale closures in event listeners
  const dayWidthRef = useRef(dayWidth);
  useEffect(() => {
    dayWidthRef.current = dayWidth;
  }, [dayWidth]);

  const onDateChangeRef = useRef(onDateChange);
  useEffect(() => {
    onDateChangeRef.current = onDateChange;
  }, [onDateChange]);

  const dragStateRef = useRef<{
    taskId: string;
    type: DragType;
    startX: number;
    task: Task;
  } | null>(null);

  // Track the exact listener functions attached to document
  const activeListenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  function cleanup() {
    dragStateRef.current = null;
    setIsDragging(false);
    setDragType(null);
    setDragTaskId(null);
    setPreviewOffset(0);
    if (activeListenersRef.current) {
      document.removeEventListener(
        "pointermove",
        activeListenersRef.current.move
      );
      document.removeEventListener(
        "pointerup",
        activeListenersRef.current.up
      );
      activeListenersRef.current = null;
    }
  }

  // Stable handler — reads dayWidth from ref
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragStateRef.current || dayWidthRef.current <= 0) return;
    const deltaX = e.clientX - dragStateRef.current.startX;
    // Snap to whole-day increments so preview matches the committed result
    const dayDelta = Math.round(deltaX / dayWidthRef.current);
    setPreviewOffset(dayDelta * dayWidthRef.current);
  }, []);

  // Stable handler — reads dayWidth and onDateChange from refs
  const handlePointerUp = useCallback((e: PointerEvent) => {
    const state = dragStateRef.current;
    if (!state || dayWidthRef.current <= 0) {
      cleanup();
      return;
    }

    const deltaX = e.clientX - state.startX;
    const dayDelta = Math.round(deltaX / dayWidthRef.current);

    if (dayDelta !== 0) {
      const task = state.task;

      if (state.type === "bar") {
        // Shift all date fields that are set
        const updates: Record<string, string | null> = {};
        if (task.startDate)
          updates.startDate = shiftDate(task.startDate, dayDelta);
        if (task.dueDate) updates.dueDate = shiftDate(task.dueDate, dayDelta);
        if (task.scheduledDate)
          updates.scheduledDate = shiftDate(task.scheduledDate, dayDelta);
        onDateChangeRef.current(state.taskId, updates);
      } else if (state.type === "start-endpoint") {
        const newStart = shiftDate(
          task.startDate || task.scheduledDate,
          dayDelta
        );
        const endDate = task.dueDate || task.scheduledDate;
        // Enforce start <= end
        if (newStart && endDate && parseISO(newStart) > parseISO(endDate)) {
          // Don't move past the end
        } else {
          const updates: Record<string, string | null> = {};
          if (task.startDate) updates.startDate = newStart;
          else if (task.scheduledDate) updates.scheduledDate = newStart;
          onDateChangeRef.current(state.taskId, updates);
        }
      } else if (state.type === "end-endpoint") {
        const newEnd = shiftDate(
          task.dueDate || task.scheduledDate,
          dayDelta
        );
        const startDate = task.startDate || task.scheduledDate;
        // Enforce start <= end
        if (newEnd && startDate && parseISO(newEnd) < parseISO(startDate)) {
          // Don't move past the start
        } else {
          const updates: Record<string, string | null> = {};
          if (task.dueDate) updates.dueDate = newEnd;
          else if (task.scheduledDate) updates.scheduledDate = newEnd;
          onDateChangeRef.current(state.taskId, updates);
        }
      }
    }

    cleanup();
  }, []);

  // Stable unmount cleanup
  useEffect(() => {
    return () => {
      if (activeListenersRef.current) {
        document.removeEventListener(
          "pointermove",
          activeListenersRef.current.move
        );
        document.removeEventListener(
          "pointerup",
          activeListenersRef.current.up
        );
      }
    };
  }, []);

  const startDrag = useCallback(
    (taskId: string, type: DragType, e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const task = findTask(taskId);
      if (!task) return;

      dragStateRef.current = {
        taskId,
        type,
        startX: e.clientX,
        task,
      };

      setIsDragging(true);
      setDragType(type);
      setDragTaskId(taskId);
      setPreviewOffset(0);

      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      activeListenersRef.current = {
        move: handlePointerMove,
        up: handlePointerUp,
      };
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [findTask, handlePointerMove, handlePointerUp]
  );

  const handleBarPointerDown = useCallback(
    (taskId: string, e: React.PointerEvent) => startDrag(taskId, "bar", e),
    [startDrag]
  );

  const handleStartEndpointPointerDown = useCallback(
    (taskId: string, e: React.PointerEvent) =>
      startDrag(taskId, "start-endpoint", e),
    [startDrag]
  );

  const handleEndEndpointPointerDown = useCallback(
    (taskId: string, e: React.PointerEvent) =>
      startDrag(taskId, "end-endpoint", e),
    [startDrag]
  );

  return {
    isDragging,
    dragType,
    dragTaskId,
    previewOffset,
    handleBarPointerDown,
    handleStartEndpointPointerDown,
    handleEndEndpointPointerDown,
  };
}

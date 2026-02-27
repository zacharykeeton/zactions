"use client";

import { useState, useEffect, useCallback, type RefObject } from "react";

/**
 * Tracks the pixel width of a single day column in the timeline grid
 * by observing the timeline container width.
 */
export function useGridDayWidth(
  containerRef: RefObject<HTMLDivElement | null>,
  daysInMonth: number
): number {
  const [dayWidth, setDayWidth] = useState(0);

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    setDayWidth(containerWidth / daysInMonth);
  }, [daysInMonth]); // containerRef is a stable ref — omit from deps

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    measure();

    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  return dayWidth;
}

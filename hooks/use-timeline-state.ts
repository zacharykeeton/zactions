"use client";

import { useState, useCallback } from "react";
import { startOfMonth, addMonths, subMonths, format, parseISO } from "date-fns";
import { TIMELINE_MONTH_KEY } from "@/lib/constants";

function loadMonth(): Date {
  if (typeof window === "undefined") return startOfMonth(new Date());
  try {
    const stored = localStorage.getItem(TIMELINE_MONTH_KEY);
    if (stored) return startOfMonth(parseISO(stored));
  } catch {
    // ignore
  }
  return startOfMonth(new Date());
}

function saveMonth(month: Date) {
  try {
    localStorage.setItem(TIMELINE_MONTH_KEY, format(month, "yyyy-MM-dd"));
  } catch {
    // ignore
  }
}

export function useTimelineState() {
  const [currentMonth, setCurrentMonth] = useState<Date>(loadMonth);

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const next = startOfMonth(subMonths(prev, 1));
      saveMonth(next);
      return next;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const next = startOfMonth(addMonths(prev, 1));
      saveMonth(next);
      return next;
    });
  }, []);

  const goToToday = useCallback(() => {
    const today = startOfMonth(new Date());
    setCurrentMonth(today);
    saveMonth(today);
  }, []);

  return {
    currentMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
  };
}

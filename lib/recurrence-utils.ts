import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isBefore,
  startOfDay,
  getDay,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
} from "date-fns";
import type { RecurrencePattern, DayOfWeek } from "./types";

export function getNextDueDate(
  currentDueDate: string,
  pattern: RecurrencePattern
): string {
  const dueDate = new Date(currentDueDate);
  const today = startOfDay(new Date());

  switch (pattern.interval) {
    case "daily":
      return getNextDaily(dueDate, today).toISOString();
    case "weekly":
      return getNextWeekly(dueDate, today, pattern.daysOfWeek).toISOString();
    case "monthly":
      return getNextMonthly(dueDate, today).toISOString();
    case "yearly":
      return getNextYearly(dueDate, today).toISOString();
  }
}

function getNextDaily(dueDate: Date, today: Date): Date {
  let next = addDays(dueDate, 1);
  if (isBefore(next, today)) {
    const gap = differenceInCalendarDays(today, dueDate);
    next = addDays(dueDate, gap + 1);
  }
  return next;
}

function getNextWeekly(
  dueDate: Date,
  today: Date,
  daysOfWeek?: DayOfWeek[]
): Date {
  if (!daysOfWeek || daysOfWeek.length === 0) {
    let next = addWeeks(dueDate, 1);
    if (isBefore(next, today)) {
      const gap = differenceInCalendarWeeks(today, dueDate, { weekStartsOn: 0 });
      next = addWeeks(dueDate, gap + 1);
    }
    return next;
  }

  const sorted = [...daysOfWeek].sort((a, b) => a - b);

  // Search from dueDate + 1 day forward, up to 7 days
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(dueDate, i);
    const dow = getDay(candidate) as DayOfWeek;
    if (sorted.includes(dow) && !isBefore(candidate, today)) {
      return candidate;
    }
  }

  // If all candidates were in the past, skip ahead week by week
  const baseDays = differenceInCalendarDays(today, dueDate);
  const weeksAhead = Math.floor(baseDays / 7) + 1;
  const startSearch = addWeeks(dueDate, weeksAhead);

  for (let i = 0; i < 7; i++) {
    const candidate = addDays(startSearch, i);
    const dow = getDay(candidate) as DayOfWeek;
    if (sorted.includes(dow)) {
      return candidate;
    }
  }

  // Fallback
  return addWeeks(dueDate, 1);
}

function getNextMonthly(dueDate: Date, today: Date): Date {
  let next = addMonths(dueDate, 1);
  while (isBefore(next, today)) {
    next = addMonths(next, 1);
  }
  return next;
}

function getNextYearly(dueDate: Date, today: Date): Date {
  let next = addYears(dueDate, 1);
  while (isBefore(next, today)) {
    next = addYears(next, 1);
  }
  return next;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatRecurrencePattern(pattern: RecurrencePattern): string {
  const label =
    pattern.interval.charAt(0).toUpperCase() + pattern.interval.slice(1);

  if (
    pattern.interval === "weekly" &&
    pattern.daysOfWeek &&
    pattern.daysOfWeek.length > 0
  ) {
    const days = [...pattern.daysOfWeek]
      .sort((a, b) => a - b)
      .map((d) => DAY_NAMES[d])
      .join(", ");
    return `${label} (${days})`;
  }

  return label;
}

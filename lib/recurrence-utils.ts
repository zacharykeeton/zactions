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

export function fastForwardDueDate(
  currentDueDate: string,
  pattern: RecurrencePattern
): string {
  const dueDate = new Date(currentDueDate);
  const now = new Date();

  // Create a "today" date using UTC to avoid timezone issues
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Compare dates using UTC
  const dueDateUTC = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  // If already at or past today, return current due date
  if (dueDateUTC >= todayUTC) {
    return currentDueDate;
  }

  switch (pattern.interval) {
    case "daily":
      return fastForwardDaily(dueDate, today).toISOString();
    case "weekly":
      return fastForwardWeekly(dueDate, today, pattern.daysOfWeek).toISOString();
    case "monthly":
      return fastForwardMonthly(dueDate, today).toISOString();
    case "yearly":
      return fastForwardYearly(dueDate, today).toISOString();
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

function fastForwardDaily(dueDate: Date, today: Date): Date {
  // Calculate day difference using UTC dates (ignoring time)
  const dueDateUTC = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const gap = Math.floor((todayUTC - dueDateUTC) / (24 * 60 * 60 * 1000));
  return addDays(dueDate, gap);
}

function fastForwardWeekly(
  dueDate: Date,
  today: Date,
  daysOfWeek?: DayOfWeek[]
): Date {
  if (!daysOfWeek || daysOfWeek.length === 0) {
    // Simple weekly recurrence - advance by whole weeks to reach today
    const dueDateUTC = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
    const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const daysDiff = Math.floor((todayUTC - dueDateUTC) / (24 * 60 * 60 * 1000));
    const weeksDiff = Math.floor(daysDiff / 7);
    return addWeeks(dueDate, weeksDiff);
  }

  const sorted = [...daysOfWeek].sort((a, b) => a - b);
  const todayDow = today.getUTCDay() as DayOfWeek;

  // If today is one of the scheduled days, return dueDate advanced to today
  if (sorted.includes(todayDow)) {
    // Calculate how many weeks fit between dueDate and today to preserve the day of week
    const dueDateUTC = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
    const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const daysDiff = Math.floor((todayUTC - dueDateUTC) / (24 * 60 * 60 * 1000));
    const weeksDiff = Math.floor(daysDiff / 7);
    return addWeeks(dueDate, weeksDiff);
  }

  // Otherwise find the most recent scheduled day <= today
  // Start from yesterday and go back up to 6 days
  for (let i = 1; i <= 6; i++) {
    const candidate = addDays(today, -i);
    const dow = candidate.getUTCDay() as DayOfWeek;
    if (sorted.includes(dow) && !isBefore(candidate, dueDate)) {
      return candidate;
    }
  }

  // If no valid day found in the past week, return today
  return today;
}

function fastForwardMonthly(dueDate: Date, today: Date): Date {
  // For monthly recurrence, advance until we're in the current month or later
  // Use UTC dates to avoid DST issues and month overflow
  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth();

  let currentYear = dueDate.getUTCFullYear();
  let currentMonth = dueDate.getUTCMonth();

  // Advance by months until we reach the target month
  while (currentYear < todayYear || (currentYear === todayYear && currentMonth < todayMonth)) {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }

  // Construct the result date with proper day clamping for short months
  const originalDate = dueDate.getUTCDate();
  const originalHours = dueDate.getUTCHours();
  const originalMinutes = dueDate.getUTCMinutes();
  const originalSeconds = dueDate.getUTCSeconds();
  const originalMs = dueDate.getUTCMilliseconds();

  // Get the last day of the target month
  const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
  const clampedDate = Math.min(originalDate, lastDayOfMonth);

  return new Date(Date.UTC(
    currentYear,
    currentMonth,
    clampedDate,
    originalHours,
    originalMinutes,
    originalSeconds,
    originalMs
  ));
}

function fastForwardYearly(dueDate: Date, today: Date): Date {
  // For yearly recurrence, advance until we're in the current year or later
  // Use UTC dates to avoid DST issues and handle leap years
  const todayYear = today.getUTCFullYear();
  const dueYear = dueDate.getUTCFullYear();

  // Calculate how many years to advance
  const yearsToAdd = Math.max(0, todayYear - dueYear);

  const originalMonth = dueDate.getUTCMonth();
  const originalDate = dueDate.getUTCDate();
  const originalHours = dueDate.getUTCHours();
  const originalMinutes = dueDate.getUTCMinutes();
  const originalSeconds = dueDate.getUTCSeconds();
  const originalMs = dueDate.getUTCMilliseconds();

  const targetYear = dueYear + yearsToAdd;

  // Get the last day of the target month in the target year (handles leap years)
  const lastDayOfMonth = new Date(Date.UTC(targetYear, originalMonth + 1, 0)).getUTCDate();
  const clampedDate = Math.min(originalDate, lastDayOfMonth);

  return new Date(Date.UTC(
    targetYear,
    originalMonth,
    clampedDate,
    originalHours,
    originalMinutes,
    originalSeconds,
    originalMs
  ));
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

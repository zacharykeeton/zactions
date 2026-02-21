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
  const freq = pattern.frequency ?? 1;

  switch (pattern.interval) {
    case "daily":
      return getNextDaily(dueDate, today, freq).toISOString();
    case "weekly":
      return getNextWeekly(dueDate, today, pattern.daysOfWeek, freq).toISOString();
    case "monthly":
      return getNextMonthly(dueDate, today, freq).toISOString();
    case "yearly":
      return getNextYearly(dueDate, today, freq).toISOString();
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

  const freq = pattern.frequency ?? 1;

  switch (pattern.interval) {
    case "daily":
      return fastForwardDaily(dueDate, today, freq).toISOString();
    case "weekly":
      return fastForwardWeekly(dueDate, today, pattern.daysOfWeek, freq).toISOString();
    case "monthly":
      return fastForwardMonthly(dueDate, today, freq).toISOString();
    case "yearly":
      return fastForwardYearly(dueDate, today, freq).toISOString();
  }
}

function getNextDaily(dueDate: Date, today: Date, frequency: number): Date {
  let next = addDays(dueDate, frequency);
  if (isBefore(next, today)) {
    const gap = differenceInCalendarDays(today, dueDate);
    const periods = Math.floor(gap / frequency) + 1;
    next = addDays(dueDate, periods * frequency);
  }
  return next;
}

function getNextWeekly(
  dueDate: Date,
  today: Date,
  daysOfWeek: DayOfWeek[] | undefined,
  frequency: number
): Date {
  if (!daysOfWeek || daysOfWeek.length === 0) {
    let next = addWeeks(dueDate, frequency);
    if (isBefore(next, today)) {
      const gap = differenceInCalendarWeeks(today, dueDate, { weekStartsOn: 0 });
      const periods = Math.floor(gap / frequency) + 1;
      next = addWeeks(dueDate, periods * frequency);
    }
    return next;
  }

  const sorted = [...daysOfWeek].sort((a, b) => a - b);
  // Use UTC day-of-week so dates stored as midnight UTC are consistent across timezones
  const dueDow = dueDate.getUTCDay() as DayOfWeek;
  const currentIndex = sorted.indexOf(dueDow);

  if (currentIndex !== -1) {
    // dueDate is a scheduled day — check remaining days in this cycle
    for (let idx = currentIndex + 1; idx < sorted.length; idx++) {
      const targetDow = sorted[idx];
      const daysAhead = (targetDow - dueDow + 7) % 7;
      if (daysAhead > 0) {
        const candidate = addDays(dueDate, daysAhead);
        if (!isBefore(candidate, today)) return candidate;
      }
    }
  } else {
    // dueDate's day isn't in the schedule (edge case: pattern changed)
    for (let i = 1; i <= frequency * 7; i++) {
      const candidate = addDays(dueDate, i);
      const dow = candidate.getUTCDay() as DayOfWeek;
      if (sorted.includes(dow) && !isBefore(candidate, today)) {
        return candidate;
      }
    }
  }

  // No remaining days in this cycle — jump to the first day of the next cycle.
  // "Next cycle" starts frequency weeks after the current cycle's first day.
  const firstDow = sorted[0];
  const daysToFirstInNextCycle = ((firstDow - dueDow + 7) % 7 || 7) + (frequency - 1) * 7;
  let candidate = addDays(dueDate, daysToFirstInNextCycle);

  // If still in the past, keep advancing by frequency weeks
  while (isBefore(candidate, today)) {
    candidate = addWeeks(candidate, frequency);
  }
  return candidate;
}

function getNextMonthly(dueDate: Date, today: Date, frequency: number): Date {
  let next = addMonths(dueDate, frequency);
  while (isBefore(next, today)) {
    next = addMonths(next, frequency);
  }
  return next;
}

function getNextYearly(dueDate: Date, today: Date, frequency: number): Date {
  let next = addYears(dueDate, frequency);
  while (isBefore(next, today)) {
    next = addYears(next, frequency);
  }
  return next;
}

function fastForwardDaily(dueDate: Date, today: Date, frequency: number): Date {
  // Calculate day difference using UTC dates (ignoring time)
  const dueDateUTC = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const gap = Math.floor((todayUTC - dueDateUTC) / (24 * 60 * 60 * 1000));
  const periods = Math.floor(gap / frequency);
  return addDays(dueDate, periods * frequency);
}

function fastForwardWeekly(
  dueDate: Date,
  today: Date,
  daysOfWeek: DayOfWeek[] | undefined,
  frequency: number
): Date {
  const dueDateUTC = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysDiff = Math.floor((todayUTC - dueDateUTC) / (24 * 60 * 60 * 1000));

  if (!daysOfWeek || daysOfWeek.length === 0) {
    // Simple weekly — advance by whole frequency-week periods
    const weeksDiff = Math.floor(daysDiff / 7);
    const periods = Math.floor(weeksDiff / frequency);
    return addWeeks(dueDate, periods * frequency);
  }

  // With specific days: find the last valid occurrence <= today.
  //
  // Valid occurrences are laid out in repeating cycles of (frequency * 7) days.
  // Each cycle contains one occurrence per scheduled day-of-week, at offsets
  // computed relative to dueDate's day-of-week.
  //
  // Example: frequency=2, daysOfWeek=[Mon, Fri], dueDate=Mon Jan 12
  //   dueDow=1, sorted=[1,5], intraOffsets=[0,4], cycleLength=14
  //   Cycle 0: Jan 12 (offset 0), Jan 16 (offset 4)
  //   Cycle 1: Jan 26 (offset 0), Jan 30 (offset 4)
  //   ...

  const sorted = [...daysOfWeek].sort((a, b) => a - b);
  const dueDow = dueDate.getUTCDay() as DayOfWeek;

  // Intra-cycle offsets: days from dueDate to each scheduled day within the first cycle
  const intraOffsets = sorted
    .map((d) => (d - dueDow + 7) % 7)
    .sort((a, b) => a - b);

  const cycleLength = frequency * 7;
  const currentCycle = Math.floor(daysDiff / cycleLength);
  const cycleStartDays = currentCycle * cycleLength;
  const daysIntoCurrentCycle = daysDiff - cycleStartDays;

  // Last valid offset in the current cycle that is <= daysIntoCurrentCycle
  const validOffsets = intraOffsets.filter((o) => o <= daysIntoCurrentCycle);

  if (validOffsets.length > 0) {
    const lastOffset = validOffsets[validOffsets.length - 1];
    return addDays(dueDate, cycleStartDays + lastOffset);
  }

  if (currentCycle > 0) {
    // Use the last offset of the previous cycle
    const prevCycleStartDays = (currentCycle - 1) * cycleLength;
    const lastOffset = intraOffsets[intraOffsets.length - 1];
    return addDays(dueDate, prevCycleStartDays + lastOffset);
  }

  return dueDate;
}

function fastForwardMonthly(dueDate: Date, today: Date, frequency: number): Date {
  const dueYear = dueDate.getUTCFullYear();
  const dueMonth = dueDate.getUTCMonth();
  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth();

  const monthsDiff = (todayYear - dueYear) * 12 + (todayMonth - dueMonth);
  if (monthsDiff <= 0) return dueDate;

  const periods = Math.floor(monthsDiff / frequency);
  const totalMonthsToAdd = periods * frequency;
  const rawTargetMonth = dueMonth + totalMonthsToAdd;
  const targetYear = dueYear + Math.floor(rawTargetMonth / 12);
  const targetMonth = rawTargetMonth % 12;

  const originalDate = dueDate.getUTCDate();
  const originalHours = dueDate.getUTCHours();
  const originalMinutes = dueDate.getUTCMinutes();
  const originalSeconds = dueDate.getUTCSeconds();
  const originalMs = dueDate.getUTCMilliseconds();

  const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDate = Math.min(originalDate, lastDayOfMonth);

  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    clampedDate,
    originalHours,
    originalMinutes,
    originalSeconds,
    originalMs
  ));
}

function fastForwardYearly(dueDate: Date, today: Date, frequency: number): Date {
  const todayYear = today.getUTCFullYear();
  const dueYear = dueDate.getUTCFullYear();

  const yearsElapsed = todayYear - dueYear;
  if (yearsElapsed <= 0) return dueDate;

  const periods = Math.floor(yearsElapsed / frequency);
  const targetYear = dueYear + periods * frequency;

  const originalMonth = dueDate.getUTCMonth();
  const originalDate = dueDate.getUTCDate();
  const originalHours = dueDate.getUTCHours();
  const originalMinutes = dueDate.getUTCMinutes();
  const originalSeconds = dueDate.getUTCSeconds();
  const originalMs = dueDate.getUTCMilliseconds();

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

const INTERVAL_PLURAL: Record<string, string> = {
  daily: "days",
  weekly: "weeks",
  monthly: "months",
  yearly: "years",
};

export function formatRecurrencePattern(pattern: RecurrencePattern): string {
  const freq = pattern.frequency ?? 1;

  const daysSuffix =
    pattern.interval === "weekly" &&
    pattern.daysOfWeek &&
    pattern.daysOfWeek.length > 0
      ? ` (${[...pattern.daysOfWeek]
          .sort((a, b) => a - b)
          .map((d) => DAY_NAMES[d])
          .join(", ")})`
      : "";

  if (freq === 1) {
    const label =
      pattern.interval.charAt(0).toUpperCase() + pattern.interval.slice(1);
    return `${label}${daysSuffix}`;
  }

  return `Every ${freq} ${INTERVAL_PLURAL[pattern.interval]}${daysSuffix}`;
}

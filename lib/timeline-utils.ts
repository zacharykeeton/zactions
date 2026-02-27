import {
  parseISO,
  startOfMonth,
  endOfMonth,
  getDate,
  isWeekend,
  addDays,
  format,
  isSameMonth,
  differenceInCalendarDays,
} from "date-fns";
import type { Task } from "@/lib/types";

export interface TimelineDateRange {
  start: string | null;
  end: string | null;
}

export interface TimelineFlatTask {
  task: Task;
  children: Task[];
  depth: number;
}

/**
 * Returns the effective date range for a task on the timeline.
 * Priority: startDate→dueDate as range, else single-point fallbacks.
 */
export function getTaskDateRange(task: Task): TimelineDateRange {
  if (task.startDate && task.dueDate) {
    return { start: task.startDate, end: task.dueDate };
  }
  if (task.startDate && task.scheduledDate) {
    return { start: task.startDate, end: task.scheduledDate };
  }
  if (task.startDate) {
    return { start: task.startDate, end: task.startDate };
  }
  if (task.scheduledDate && task.dueDate) {
    return { start: task.scheduledDate, end: task.dueDate };
  }
  if (task.dueDate) {
    return { start: task.dueDate, end: task.dueDate };
  }
  if (task.scheduledDate) {
    return { start: task.scheduledDate, end: task.scheduledDate };
  }
  return { start: null, end: null };
}

/**
 * Check if a task's date range overlaps with a month.
 */
export function isTaskInMonth(
  task: Task,
  monthStart: Date,
  monthEnd: Date
): boolean {
  const range = getTaskDateRange(task);
  if (!range.start) return false;
  const taskStart = parseISO(range.start);
  const taskEnd = range.end ? parseISO(range.end) : taskStart;
  return taskStart <= monthEnd && taskEnd >= monthStart;
}

/**
 * Recursively filter tasks (and their children) visible in a given month.
 * Returns a new tree with only tasks that have dates in the month.
 * Children that are visible are preserved under their parent.
 */
export function getTasksForMonth(
  tasks: Task[],
  monthStart: Date,
  monthEnd: Date
): Task[] {
  const result: Task[] = [];
  for (const task of tasks) {
    if (task.archived) continue;

    const visibleChildren = getTasksForMonth(
      task.children,
      monthStart,
      monthEnd
    );
    const taskVisible = isTaskInMonth(task, monthStart, monthEnd);

    if (taskVisible || visibleChildren.length > 0) {
      result.push({
        ...task,
        children: visibleChildren,
      });
    }
  }
  return result;
}

/**
 * Flatten tasks for timeline rendering, preserving parent-child grouping.
 * Root tasks with children produce a group; leaf tasks are standalone rows.
 */
export function flattenForTimeline(
  tasks: Task[],
  depth = 0
): TimelineFlatTask[] {
  const result: TimelineFlatTask[] = [];
  for (const task of tasks) {
    result.push({
      task,
      children: task.children,
      depth,
    });
    if (task.children.length > 0) {
      result.push(...flattenForTimeline(task.children, depth + 1));
    }
  }
  return result;
}

/**
 * Clamp a date string to the boundaries of a month.
 * Returns the clamped ISO date string.
 */
export function clampToMonth(
  dateStr: string,
  monthStart: Date,
  monthEnd: Date
): string {
  const date = parseISO(dateStr);
  if (date < monthStart) return format(monthStart, "yyyy-MM-dd");
  if (date > monthEnd) return format(monthEnd, "yyyy-MM-dd");
  return dateStr;
}

/**
 * Get the 1-based day column index for a date within its month.
 * E.g., Feb 5 → 5.
 */
export function getDayColumn(dateStr: string): number {
  return getDate(parseISO(dateStr));
}

/**
 * Check if a date string falls on a weekend (Saturday or Sunday).
 */
export function isWeekendDay(dateStr: string): boolean {
  return isWeekend(parseISO(dateStr));
}

/**
 * Add N days to an ISO date string, returning a new ISO date string.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), "yyyy-MM-dd");
}

/**
 * Convert pixel delta to a day count, rounding to the nearest integer.
 */
export function computeDateDelta(deltaX: number, dayWidth: number): number {
  if (dayWidth <= 0) return 0;
  return Math.round(deltaX / dayWidth);
}

/**
 * Check if a date range is a single point (start === end or end is null).
 */
export function isSingleDate(range: TimelineDateRange): boolean {
  if (!range.start) return false;
  if (!range.end) return true;
  return range.start === range.end;
}

/**
 * Get an array of day numbers for a month (e.g., [1, 2, ..., 28] for Feb).
 */
export function getDaysInMonthArray(monthDate: Date): number[] {
  const end = endOfMonth(monthDate);
  const count = getDate(end);
  return Array.from({ length: count }, (_, i) => i + 1);
}

/**
 * Check if a given day number in the current month is today.
 */
export function isDayToday(day: number, currentMonth: Date): boolean {
  const today = new Date();
  return isSameMonth(today, currentMonth) && getDate(today) === day;
}

/**
 * Get the day-of-week (0=Sun, 6=Sat) for a given day number in a month.
 */
export function getDayOfWeek(day: number, monthDate: Date): number {
  const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
  return date.getDay();
}

/**
 * Check if a specific day number in a month falls on a weekend.
 */
export function isDayWeekend(day: number, monthDate: Date): boolean {
  const dow = getDayOfWeek(day, monthDate);
  return dow === 0 || dow === 6;
}

/**
 * Get the column span for a task bar within a month grid.
 * Returns { startCol, endCol } (1-based day columns), clamped to month.
 */
export function getBarColumns(
  task: Task,
  monthStart: Date,
  monthEnd: Date
): { startCol: number; endCol: number } | null {
  const range = getTaskDateRange(task);
  if (!range.start) return null;

  const clampedStart = clampToMonth(range.start, monthStart, monthEnd);
  const clampedEnd = clampToMonth(
    range.end || range.start,
    monthStart,
    monthEnd
  );

  return {
    startCol: getDayColumn(clampedStart),
    endCol: getDayColumn(clampedEnd),
  };
}

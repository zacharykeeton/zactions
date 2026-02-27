import { describe, it, expect } from "vitest";
import {
  getTaskDateRange,
  isTaskInMonth,
  getTasksForMonth,
  flattenForTimeline,
  clampToMonth,
  getDayColumn,
  isWeekendDay,
  addDaysToDateStr,
  computeDateDelta,
  isSingleDate,
  getDaysInMonthArray,
  isDayToday,
  isDayWeekend,
  getBarColumns,
} from "./timeline-utils";
import type { Task } from "@/lib/types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "test-1",
    title: "Test Task",
    completed: false,
    priority: "medium",
    dueDate: null,
    scheduledDate: null,
    startDate: null,
    completedDate: null,
    createdDate: "2026-02-01",
    children: [],
    timeInvestedMs: 0,
    timeEstimateMs: null,
    archived: false,
    ...overrides,
  };
}

describe("getTaskDateRange", () => {
  it("returns startDate→dueDate when both exist", () => {
    const task = makeTask({ startDate: "2026-02-05", dueDate: "2026-02-15" });
    expect(getTaskDateRange(task)).toEqual({
      start: "2026-02-05",
      end: "2026-02-15",
    });
  });

  it("returns startDate→scheduledDate when no dueDate", () => {
    const task = makeTask({
      startDate: "2026-02-05",
      scheduledDate: "2026-02-10",
    });
    expect(getTaskDateRange(task)).toEqual({
      start: "2026-02-05",
      end: "2026-02-10",
    });
  });

  it("returns startDate as single point when only startDate exists", () => {
    const task = makeTask({ startDate: "2026-02-05" });
    expect(getTaskDateRange(task)).toEqual({
      start: "2026-02-05",
      end: "2026-02-05",
    });
  });

  it("returns scheduledDate→dueDate when both exist but no startDate", () => {
    const task = makeTask({
      scheduledDate: "2026-02-05",
      dueDate: "2026-02-15",
    });
    expect(getTaskDateRange(task)).toEqual({
      start: "2026-02-05",
      end: "2026-02-15",
    });
  });

  it("returns dueDate as single point when only dueDate exists", () => {
    const task = makeTask({ dueDate: "2026-02-15" });
    expect(getTaskDateRange(task)).toEqual({
      start: "2026-02-15",
      end: "2026-02-15",
    });
  });

  it("returns scheduledDate as single point when only scheduledDate exists", () => {
    const task = makeTask({ scheduledDate: "2026-02-10" });
    expect(getTaskDateRange(task)).toEqual({
      start: "2026-02-10",
      end: "2026-02-10",
    });
  });

  it("returns null for task with no dates", () => {
    const task = makeTask({});
    expect(getTaskDateRange(task)).toEqual({ start: null, end: null });
  });
});

describe("isTaskInMonth", () => {
  const febStart = new Date(2026, 1, 1);
  const febEnd = new Date(2026, 1, 28);

  it("returns true for task fully within month", () => {
    const task = makeTask({ startDate: "2026-02-05", dueDate: "2026-02-20" });
    expect(isTaskInMonth(task, febStart, febEnd)).toBe(true);
  });

  it("returns true for task spanning across month start", () => {
    const task = makeTask({ startDate: "2026-01-25", dueDate: "2026-02-05" });
    expect(isTaskInMonth(task, febStart, febEnd)).toBe(true);
  });

  it("returns true for task spanning across month end", () => {
    const task = makeTask({ startDate: "2026-02-20", dueDate: "2026-03-05" });
    expect(isTaskInMonth(task, febStart, febEnd)).toBe(true);
  });

  it("returns false for task entirely before month", () => {
    const task = makeTask({ startDate: "2026-01-10", dueDate: "2026-01-20" });
    expect(isTaskInMonth(task, febStart, febEnd)).toBe(false);
  });

  it("returns false for task entirely after month", () => {
    const task = makeTask({ startDate: "2026-03-05", dueDate: "2026-03-15" });
    expect(isTaskInMonth(task, febStart, febEnd)).toBe(false);
  });

  it("returns false for task with no dates", () => {
    const task = makeTask({});
    expect(isTaskInMonth(task, febStart, febEnd)).toBe(false);
  });
});

describe("getTasksForMonth", () => {
  const febStart = new Date(2026, 1, 1);
  const febEnd = new Date(2026, 1, 28);

  it("filters tasks to those visible in month", () => {
    const tasks = [
      makeTask({ id: "1", dueDate: "2026-02-10" }),
      makeTask({ id: "2", dueDate: "2026-03-10" }),
      makeTask({ id: "3", dueDate: "2026-02-20" }),
    ];
    const result = getTasksForMonth(tasks, febStart, febEnd);
    expect(result.map((t) => t.id)).toEqual(["1", "3"]);
  });

  it("includes parent if child is visible even if parent has no dates", () => {
    const parent = makeTask({
      id: "parent",
      children: [makeTask({ id: "child", dueDate: "2026-02-10" })],
    });
    const result = getTasksForMonth([parent], febStart, febEnd);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("parent");
    expect(result[0].children).toHaveLength(1);
  });

  it("excludes archived tasks", () => {
    const tasks = [
      makeTask({ id: "1", dueDate: "2026-02-10", archived: true }),
    ];
    const result = getTasksForMonth(tasks, febStart, febEnd);
    expect(result).toHaveLength(0);
  });
});

describe("flattenForTimeline", () => {
  it("flattens tasks with depth info", () => {
    const tasks = [
      makeTask({
        id: "parent",
        children: [makeTask({ id: "child" })],
      }),
      makeTask({ id: "leaf" }),
    ];
    const flat = flattenForTimeline(tasks);
    expect(flat).toHaveLength(3);
    expect(flat[0].task.id).toBe("parent");
    expect(flat[0].depth).toBe(0);
    expect(flat[1].task.id).toBe("child");
    expect(flat[1].depth).toBe(1);
    expect(flat[2].task.id).toBe("leaf");
    expect(flat[2].depth).toBe(0);
  });
});

describe("clampToMonth", () => {
  const monthStart = new Date(2026, 1, 1);
  const monthEnd = new Date(2026, 1, 28);

  it("clamps date before month to month start", () => {
    expect(clampToMonth("2026-01-15", monthStart, monthEnd)).toBe(
      "2026-02-01"
    );
  });

  it("clamps date after month to month end", () => {
    expect(clampToMonth("2026-03-15", monthStart, monthEnd)).toBe(
      "2026-02-28"
    );
  });

  it("returns same date if within month", () => {
    expect(clampToMonth("2026-02-15", monthStart, monthEnd)).toBe(
      "2026-02-15"
    );
  });
});

describe("getDayColumn", () => {
  it("returns the day of the month", () => {
    expect(getDayColumn("2026-02-01")).toBe(1);
    expect(getDayColumn("2026-02-15")).toBe(15);
    expect(getDayColumn("2026-02-28")).toBe(28);
  });
});

describe("isWeekendDay", () => {
  it("returns true for Saturday", () => {
    expect(isWeekendDay("2026-02-07")).toBe(true); // Saturday
  });

  it("returns true for Sunday", () => {
    expect(isWeekendDay("2026-02-08")).toBe(true); // Sunday
  });

  it("returns false for weekday", () => {
    expect(isWeekendDay("2026-02-09")).toBe(false); // Monday
  });
});

describe("addDaysToDateStr", () => {
  it("adds positive days", () => {
    expect(addDaysToDateStr("2026-02-10", 5)).toBe("2026-02-15");
  });

  it("adds negative days", () => {
    expect(addDaysToDateStr("2026-02-10", -5)).toBe("2026-02-05");
  });

  it("crosses month boundary", () => {
    expect(addDaysToDateStr("2026-02-27", 5)).toBe("2026-03-04");
  });
});

describe("computeDateDelta", () => {
  it("computes rounded day delta", () => {
    expect(computeDateDelta(100, 40)).toBe(3); // 2.5 rounds to 3
    expect(computeDateDelta(80, 40)).toBe(2);
    expect(computeDateDelta(-120, 40)).toBe(-3);
  });

  it("returns 0 for zero dayWidth", () => {
    expect(computeDateDelta(100, 0)).toBe(0);
  });
});

describe("isSingleDate", () => {
  it("returns true when start equals end", () => {
    expect(isSingleDate({ start: "2026-02-10", end: "2026-02-10" })).toBe(
      true
    );
  });

  it("returns true when end is null", () => {
    expect(isSingleDate({ start: "2026-02-10", end: null })).toBe(true);
  });

  it("returns false when range spans multiple days", () => {
    expect(isSingleDate({ start: "2026-02-10", end: "2026-02-15" })).toBe(
      false
    );
  });

  it("returns false when start is null", () => {
    expect(isSingleDate({ start: null, end: null })).toBe(false);
  });
});

describe("getDaysInMonthArray", () => {
  it("returns 28 days for Feb 2026", () => {
    const days = getDaysInMonthArray(new Date(2026, 1, 1));
    expect(days).toHaveLength(28);
    expect(days[0]).toBe(1);
    expect(days[27]).toBe(28);
  });

  it("returns 31 days for March", () => {
    const days = getDaysInMonthArray(new Date(2026, 2, 1));
    expect(days).toHaveLength(31);
  });
});

describe("isDayWeekend", () => {
  it("returns true for Sunday Feb 1 2026", () => {
    expect(isDayWeekend(1, new Date(2026, 1, 1))).toBe(true); // Feb 1, 2026 is Sunday
  });

  it("returns false for Monday Feb 2 2026", () => {
    expect(isDayWeekend(2, new Date(2026, 1, 1))).toBe(false);
  });
});

describe("getBarColumns", () => {
  const monthStart = new Date(2026, 1, 1);
  const monthEnd = new Date(2026, 1, 28);

  it("returns columns for a date range within month", () => {
    const task = makeTask({ startDate: "2026-02-05", dueDate: "2026-02-15" });
    expect(getBarColumns(task, monthStart, monthEnd)).toEqual({
      startCol: 5,
      endCol: 15,
    });
  });

  it("clamps columns to month boundaries", () => {
    const task = makeTask({ startDate: "2026-01-25", dueDate: "2026-03-05" });
    expect(getBarColumns(task, monthStart, monthEnd)).toEqual({
      startCol: 1,
      endCol: 28,
    });
  });

  it("returns single column for single-date task", () => {
    const task = makeTask({ dueDate: "2026-02-10" });
    expect(getBarColumns(task, monthStart, monthEnd)).toEqual({
      startCol: 10,
      endCol: 10,
    });
  });

  it("returns null for task with no dates", () => {
    const task = makeTask({});
    expect(getBarColumns(task, monthStart, monthEnd)).toBeNull();
  });
});

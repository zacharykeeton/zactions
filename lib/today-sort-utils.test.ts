import { describe, it, expect } from "vitest";
import { sortTodayTasks } from "./today-sort-utils";
import type { Task } from "./types";

/** Minimal task factory — only the fields sortTodayTasks inspects. */
function makeTask(overrides: Partial<Task> & { id: string; priority: Task["priority"] }): Task {
  return {
    title: overrides.id,
    completed: false,
    dueDate: null,
    scheduledDate: null,
    startDate: null,
    completedDate: null,
    createdDate: "2026-01-01",
    children: [],
    timeInvestedMs: 0,
    timeEstimateMs: null,
    archived: false,
    ...overrides,
  };
}

describe("sortTodayTasks", () => {
  const highTask = makeTask({ id: "h1", priority: "high" });
  const medTask = makeTask({ id: "m1", priority: "medium" });
  const lowTask = makeTask({ id: "l1", priority: "low" });

  describe("empty inputs", () => {
    it("returns empty array when no tasks", () => {
      expect(sortTodayTasks([], [])).toEqual([]);
    });

    it("returns empty array when no tasks but sort order exists", () => {
      expect(sortTodayTasks([], ["a", "b"])).toEqual([]);
    });
  });

  describe("no remembered sort order (all new)", () => {
    it("sorts by priority: high > medium > low", () => {
      const result = sortTodayTasks([lowTask, highTask, medTask], []);
      expect(result.map((t) => t.id)).toEqual(["h1", "m1", "l1"]);
    });

    it("uses stable ID sort within same priority", () => {
      const a = makeTask({ id: "aaa", priority: "medium" });
      const b = makeTask({ id: "bbb", priority: "medium" });
      const c = makeTask({ id: "ccc", priority: "medium" });

      const result = sortTodayTasks([c, a, b], []);
      expect(result.map((t) => t.id)).toEqual(["aaa", "bbb", "ccc"]);
    });
  });

  describe("all tasks remembered", () => {
    it("preserves remembered order regardless of priority", () => {
      const sortOrder = ["l1", "h1", "m1"];
      const result = sortTodayTasks([highTask, medTask, lowTask], sortOrder);
      expect(result.map((t) => t.id)).toEqual(["l1", "h1", "m1"]);
    });

    it("preserves remembered order when input order differs", () => {
      const sortOrder = ["m1", "l1", "h1"];
      const result = sortTodayTasks([lowTask, highTask, medTask], sortOrder);
      expect(result.map((t) => t.id)).toEqual(["m1", "l1", "h1"]);
    });
  });

  describe("mixed remembered and new tasks", () => {
    it("remembered tasks come first, then new tasks sorted by priority", () => {
      const remembered = makeTask({ id: "r1", priority: "low" });
      const newHigh = makeTask({ id: "n1", priority: "high" });
      const newLow = makeTask({ id: "n2", priority: "low" });

      const result = sortTodayTasks(
        [newLow, remembered, newHigh],
        ["r1"]
      );
      expect(result.map((t) => t.id)).toEqual(["r1", "n1", "n2"]);
    });

    it("multiple remembered tasks maintain their stored order", () => {
      const r1 = makeTask({ id: "r1", priority: "low" });
      const r2 = makeTask({ id: "r2", priority: "high" });
      const newMed = makeTask({ id: "new", priority: "medium" });

      const result = sortTodayTasks([newMed, r2, r1], ["r1", "r2"]);
      // Remembered: r1, r2 (stored order); then new: "new" (medium)
      expect(result.map((t) => t.id)).toEqual(["r1", "r2", "new"]);
    });
  });

  describe("sort order with stale IDs", () => {
    it("ignores sort order entries that don't match any task", () => {
      const result = sortTodayTasks([highTask, lowTask], ["deleted-id", "h1"]);
      // h1 is remembered, l1 is new
      expect(result.map((t) => t.id)).toEqual(["h1", "l1"]);
    });
  });
});

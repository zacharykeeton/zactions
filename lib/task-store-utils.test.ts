import { describe, it, expect } from "vitest";
import { migrateTask, removeDependencyRef, resetChildrenDeep, mergeReorderedTasks, setArchivedDeep, setArchivedOnTask, daysBetweenDates, shiftDatesDeep } from "./task-store-utils";
import type { Task, CompletionRecord } from "./types";

/** Minimal task factory for testing. */
function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
    completed: false,
    priority: "medium",
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

// ---------------------------------------------------------------------------
// migrateTask
// ---------------------------------------------------------------------------

describe("migrateTask", () => {
  it("converts old string[] completionHistory to CompletionRecord[]", () => {
    const task = makeTask({
      id: "t1",
      // Simulate old format where completionHistory was string[]
      completionHistory: ["2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"] as unknown as CompletionRecord[],
    });

    const migrated = migrateTask(task);

    expect(migrated.completionHistory).toEqual([
      { scheduledDate: null, dueDate: null, completedAt: "2026-01-01T00:00:00Z", timeInvestedMs: 0 },
      { scheduledDate: null, dueDate: null, completedAt: "2026-01-02T00:00:00Z", timeInvestedMs: 0 },
    ]);
  });

  it("leaves already-migrated CompletionRecord[] unchanged", () => {
    const records: CompletionRecord[] = [
      { scheduledDate: "2026-01-01", dueDate: "2026-01-02", completedAt: "2026-01-02T12:00:00Z", timeInvestedMs: 5000 },
    ];
    const task = makeTask({ id: "t1", completionHistory: records });

    const migrated = migrateTask(task);
    expect(migrated.completionHistory).toEqual(records);
  });

  it("handles mixed old string + new record entries", () => {
    const mixed = [
      "2026-01-01T00:00:00Z",
      { scheduledDate: "2026-01-05", dueDate: "2026-01-06", completedAt: "2026-01-06T12:00:00Z" },
    ] as unknown as CompletionRecord[];

    const task = makeTask({ id: "t1", completionHistory: mixed });
    const migrated = migrateTask(task);

    expect(migrated.completionHistory).toEqual([
      { scheduledDate: null, dueDate: null, completedAt: "2026-01-01T00:00:00Z", timeInvestedMs: 0 },
      { timeInvestedMs: 0, scheduledDate: "2026-01-05", dueDate: "2026-01-06", completedAt: "2026-01-06T12:00:00Z" },
    ]);
  });

  it("defaults missing timeInvestedMs on CompletionRecord to 0", () => {
    // Simulate a record saved before timeInvestedMs was added
    const records = [
      { scheduledDate: "2026-01-01", dueDate: "2026-01-02", completedAt: "2026-01-02T12:00:00Z" },
    ] as unknown as CompletionRecord[];
    const task = makeTask({ id: "t1", completionHistory: records });

    const migrated = migrateTask(task);
    expect(migrated.completionHistory).toEqual([
      { timeInvestedMs: 0, scheduledDate: "2026-01-01", dueDate: "2026-01-02", completedAt: "2026-01-02T12:00:00Z" },
    ]);
  });

  it("leaves empty completionHistory as-is", () => {
    const task = makeTask({ id: "t1", completionHistory: [] });
    const migrated = migrateTask(task);
    expect(migrated.completionHistory).toEqual([]);
  });

  it("leaves undefined completionHistory as-is", () => {
    const task = makeTask({ id: "t1" });
    const migrated = migrateTask(task);
    expect(migrated.completionHistory).toBeUndefined();
  });

  it("defaults missing timeInvestedMs to 0", () => {
    const task = makeTask({ id: "t1" });
    // Simulate legacy task missing the field
    delete (task as Record<string, unknown>).timeInvestedMs;
    const migrated = migrateTask(task);
    expect(migrated.timeInvestedMs).toBe(0);
  });

  it("defaults missing archived to false", () => {
    const task = makeTask({ id: "t1" });
    delete (task as Record<string, unknown>).archived;
    const migrated = migrateTask(task);
    expect(migrated.archived).toBe(false);
  });

  it("defaults missing startDate to null", () => {
    const task = makeTask({ id: "t1" });
    delete (task as Record<string, unknown>).startDate;
    const migrated = migrateTask(task);
    expect(migrated.startDate).toBeNull();
  });

  it("migrates children recursively", () => {
    const child = makeTask({
      id: "child",
      completionHistory: ["2026-01-01T00:00:00Z"] as unknown as CompletionRecord[],
    });
    const parent = makeTask({ id: "parent", children: [child] });

    const migrated = migrateTask(parent);
    expect(migrated.children[0].completionHistory).toEqual([
      { scheduledDate: null, dueDate: null, completedAt: "2026-01-01T00:00:00Z", timeInvestedMs: 0 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// removeDependencyRef
// ---------------------------------------------------------------------------

describe("removeDependencyRef", () => {
  it("removes the dependency ID from a task's dependsOn", () => {
    const tasks = [
      makeTask({ id: "a", dependsOn: ["b", "c"] }),
      makeTask({ id: "b" }),
      makeTask({ id: "c" }),
    ];

    const result = removeDependencyRef(tasks, "b");
    expect(result[0].dependsOn).toEqual(["c"]);
  });

  it("sets dependsOn to undefined when last dependency is removed", () => {
    const tasks = [makeTask({ id: "a", dependsOn: ["b"] })];

    const result = removeDependencyRef(tasks, "b");
    expect(result[0].dependsOn).toBeUndefined();
  });

  it("leaves tasks without dependsOn unchanged", () => {
    const tasks = [makeTask({ id: "a" })];

    const result = removeDependencyRef(tasks, "b");
    expect(result[0].dependsOn).toBeUndefined();
  });

  it("removes dependency references from nested children", () => {
    const child = makeTask({ id: "child", dependsOn: ["deleted"] });
    const parent = makeTask({ id: "parent", children: [child] });

    const result = removeDependencyRef([parent], "deleted");
    expect(result[0].children[0].dependsOn).toBeUndefined();
  });

  it("removes references at multiple nesting levels", () => {
    const grandchild = makeTask({ id: "gc", dependsOn: ["x", "y"] });
    const child = makeTask({ id: "c", dependsOn: ["x"], children: [grandchild] });
    const root = makeTask({ id: "r", dependsOn: ["x", "z"], children: [child] });

    const result = removeDependencyRef([root], "x");
    expect(result[0].dependsOn).toEqual(["z"]);
    expect(result[0].children[0].dependsOn).toBeUndefined();
    expect(result[0].children[0].children[0].dependsOn).toEqual(["y"]);
  });
});

// ---------------------------------------------------------------------------
// resetChildrenDeep
// ---------------------------------------------------------------------------

describe("resetChildrenDeep", () => {
  it("resets completed, completedDate, and timeInvestedMs on a flat list", () => {
    const items = [
      makeTask({ id: "a", completed: true, completedDate: "2026-01-05", timeInvestedMs: 5000, completionHistory: [] }),
      makeTask({ id: "b", completed: true, completedDate: "2026-01-06", timeInvestedMs: 3000, completionHistory: [] }),
    ];

    const result = resetChildrenDeep(items);
    for (const item of result) {
      expect(item.completed).toBe(false);
      expect(item.completedDate).toBeNull();
      expect(item.timeInvestedMs).toBe(0);
    }
  });

  it("resets nested children recursively", () => {
    const grandchild = makeTask({ id: "gc", completed: true, completedDate: "2026-01-05", timeInvestedMs: 1000, completionHistory: [] });
    const child = makeTask({ id: "c", completed: true, completedDate: "2026-01-05", timeInvestedMs: 2000, completionHistory: [], children: [grandchild] });
    const items = [child];

    const result = resetChildrenDeep(items);
    expect(result[0].completed).toBe(false);
    expect(result[0].completedDate).toBeNull();
    expect(result[0].timeInvestedMs).toBe(0);
    expect(result[0].children[0].completed).toBe(false);
    expect(result[0].children[0].completedDate).toBeNull();
    expect(result[0].children[0].timeInvestedMs).toBe(0);
  });

  it("handles already-reset items (no-op)", () => {
    const items = [makeTask({ id: "a" })];

    const result = resetChildrenDeep(items);
    expect(result[0].completed).toBe(false);
    expect(result[0].completedDate).toBeNull();
    expect(result[0].timeInvestedMs).toBe(0);
  });

  it("returns empty array for empty input", () => {
    expect(resetChildrenDeep([])).toEqual([]);
  });

  it("first-cycle fallback: records completed children that lack completionHistory", () => {
    const items = [
      makeTask({
        id: "a",
        completed: true,
        completedDate: "2026-01-05T12:00:00Z",
        scheduledDate: "2026-01-04",
        dueDate: "2026-01-05",
        timeInvestedMs: 5000,
        // no completionHistory — first cycle
      }),
    ];

    const result = resetChildrenDeep(items);
    expect(result[0].completed).toBe(false);
    expect(result[0].completedDate).toBeNull();
    expect(result[0].timeInvestedMs).toBe(0);
    expect(result[0].completionHistory).toEqual([
      {
        scheduledDate: "2026-01-04",
        dueDate: "2026-01-05",
        completedAt: "2026-01-05T12:00:00Z",
        timeInvestedMs: 5000,
      },
    ]);
  });

  it("does not duplicate record for children that already have completionHistory", () => {
    const existingRecord = {
      scheduledDate: "2026-01-03",
      dueDate: "2026-01-04",
      completedAt: "2026-01-04T10:00:00Z",
      timeInvestedMs: 2000,
    };
    const items = [
      makeTask({
        id: "a",
        completed: true,
        completedDate: "2026-01-05T12:00:00Z",
        timeInvestedMs: 5000,
        completionHistory: [existingRecord],
      }),
    ];

    const result = resetChildrenDeep(items);
    // Already had completionHistory, so no fallback record — toggle recorded it
    expect(result[0].completionHistory).toEqual([existingRecord]);
  });

  it("initialises completionHistory to [] for incomplete children without it", () => {
    const items = [
      makeTask({ id: "a", completed: false, completedDate: null }),
    ];

    const result = resetChildrenDeep(items);
    expect(result[0].completionHistory).toEqual([]);
  });

  it("first-cycle fallback works recursively on nested children", () => {
    const grandchild = makeTask({
      id: "gc",
      completed: true,
      completedDate: "2026-01-05T14:00:00Z",
      dueDate: "2026-01-05",
      scheduledDate: null,
      timeInvestedMs: 2000,
    });
    const child = makeTask({
      id: "c",
      completed: true,
      completedDate: "2026-01-05T13:00:00Z",
      dueDate: "2026-01-05",
      scheduledDate: "2026-01-04",
      timeInvestedMs: 3000,
      children: [grandchild],
    });

    const result = resetChildrenDeep([child]);
    expect(result[0].completionHistory).toEqual([
      {
        scheduledDate: "2026-01-04",
        dueDate: "2026-01-05",
        completedAt: "2026-01-05T13:00:00Z",
        timeInvestedMs: 3000,
      },
    ]);
    expect(result[0].children[0].completionHistory).toEqual([
      {
        scheduledDate: null,
        dueDate: "2026-01-05",
        completedAt: "2026-01-05T14:00:00Z",
        timeInvestedMs: 2000,
      },
    ]);
  });

  it("preserves existing completionHistory through reset", () => {
    const priorRecord = {
      scheduledDate: "2026-01-01",
      dueDate: "2026-01-02",
      completedAt: "2026-01-02T12:00:00Z",
      timeInvestedMs: 1000,
    };
    const items = [
      makeTask({
        id: "a",
        completed: false,
        completedDate: null,
        completionHistory: [priorRecord],
      }),
    ];

    const result = resetChildrenDeep(items);
    expect(result[0].completionHistory).toEqual([priorRecord]);
  });

  it("preserves other properties", () => {
    const items = [
      makeTask({
        id: "a",
        title: "Exercise",
        priority: "high",
        dueDate: "2026-02-01",
        tags: ["tag1"],
        completed: true,
        completedDate: "2026-01-30",
        timeInvestedMs: 9000,
      }),
    ];

    const result = resetChildrenDeep(items);
    expect(result[0].title).toBe("Exercise");
    expect(result[0].priority).toBe("high");
    expect(result[0].dueDate).toBe("2026-02-01");
    expect(result[0].tags).toEqual(["tag1"]);
    // Reset fields
    expect(result[0].completed).toBe(false);
    expect(result[0].completedDate).toBeNull();
    expect(result[0].timeInvestedMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// setArchivedDeep
// ---------------------------------------------------------------------------

describe("setArchivedDeep", () => {
  it("archives all items and children", () => {
    const tasks = [
      makeTask({ id: "a", children: [makeTask({ id: "b" })] }),
      makeTask({ id: "c" }),
    ];

    const result = setArchivedDeep(tasks, true);
    expect(result[0].archived).toBe(true);
    expect(result[0].children[0].archived).toBe(true);
    expect(result[1].archived).toBe(true);
  });

  it("unarchives all items and children", () => {
    const tasks = [
      makeTask({ id: "a", archived: true, children: [makeTask({ id: "b", archived: true })] }),
    ];

    const result = setArchivedDeep(tasks, false);
    expect(result[0].archived).toBe(false);
    expect(result[0].children[0].archived).toBe(false);
  });

  it("handles deeply nested trees", () => {
    const deep = makeTask({
      id: "l1",
      children: [makeTask({
        id: "l2",
        children: [makeTask({
          id: "l3",
          children: [makeTask({ id: "l4" })],
        })],
      })],
    });

    const result = setArchivedDeep([deep], true);
    expect(result[0].archived).toBe(true);
    expect(result[0].children[0].archived).toBe(true);
    expect(result[0].children[0].children[0].archived).toBe(true);
    expect(result[0].children[0].children[0].children[0].archived).toBe(true);
  });

  it("returns empty array for empty input", () => {
    expect(setArchivedDeep([], true)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// setArchivedOnTask
// ---------------------------------------------------------------------------

describe("setArchivedOnTask", () => {
  it("archives the target task and all its children", () => {
    const child = makeTask({ id: "child" });
    const target = makeTask({ id: "target", children: [child] });
    const sibling = makeTask({ id: "sibling" });

    const result = setArchivedOnTask([target, sibling], "target", true);
    expect(result[0].archived).toBe(true);
    expect(result[0].children[0].archived).toBe(true);
    // Sibling should be unaffected
    expect(result[1].archived).toBe(false);
  });

  it("unarchives the target task and all its children", () => {
    const child = makeTask({ id: "child", archived: true });
    const target = makeTask({ id: "target", archived: true, children: [child] });

    const result = setArchivedOnTask([target], "target", false);
    expect(result[0].archived).toBe(false);
    expect(result[0].children[0].archived).toBe(false);
  });

  it("finds and archives a deeply nested task", () => {
    const target = makeTask({ id: "deep-target" });
    const mid = makeTask({ id: "mid", children: [target] });
    const root = makeTask({ id: "root", children: [mid] });

    const result = setArchivedOnTask([root], "deep-target", true);
    // Root and mid should be unchanged
    expect(result[0].archived).toBe(false);
    expect(result[0].children[0].archived).toBe(false);
    // Target should be archived
    expect(result[0].children[0].children[0].archived).toBe(true);
  });

  it("does nothing if task ID is not found", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];

    const result = setArchivedOnTask(tasks, "nonexistent", true);
    expect(result[0].archived).toBe(false);
    expect(result[1].archived).toBe(false);
  });

  it("archives target's grandchildren too", () => {
    const grandchild = makeTask({ id: "gc" });
    const child = makeTask({ id: "c", children: [grandchild] });
    const target = makeTask({ id: "t", children: [child] });

    const result = setArchivedOnTask([target], "t", true);
    expect(result[0].archived).toBe(true);
    expect(result[0].children[0].archived).toBe(true);
    expect(result[0].children[0].children[0].archived).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// daysBetweenDates
// ---------------------------------------------------------------------------

describe("daysBetweenDates", () => {
  it("returns 0 for the same date", () => {
    expect(daysBetweenDates("2026-03-01", "2026-03-01")).toBe(0);
  });

  it("returns positive delta for a later date", () => {
    expect(daysBetweenDates("2026-03-01", "2026-03-08")).toBe(7);
  });

  it("returns negative delta for an earlier date", () => {
    expect(daysBetweenDates("2026-03-08", "2026-03-01")).toBe(-7);
  });

  it("works across month boundaries", () => {
    expect(daysBetweenDates("2026-01-28", "2026-02-04")).toBe(7);
  });

  it("works across year boundaries", () => {
    expect(daysBetweenDates("2025-12-30", "2026-01-02")).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// shiftDatesDeep
// ---------------------------------------------------------------------------

describe("shiftDatesDeep", () => {
  it("shifts all date fields by a positive delta", () => {
    const items = [
      makeTask({
        id: "a",
        dueDate: "2026-03-01",
        scheduledDate: "2026-02-28",
        startDate: "2026-02-25",
      }),
    ];

    const result = shiftDatesDeep(items, 7);
    expect(result[0].dueDate).toBe("2026-03-08");
    expect(result[0].scheduledDate).toBe("2026-03-07");
    expect(result[0].startDate).toBe("2026-03-04");
  });

  it("skips null/undefined date fields", () => {
    const items = [
      makeTask({ id: "a", dueDate: "2026-03-01", scheduledDate: null, startDate: null }),
    ];

    const result = shiftDatesDeep(items, 3);
    expect(result[0].dueDate).toBe("2026-03-04");
    expect(result[0].scheduledDate).toBeNull();
    expect(result[0].startDate).toBeNull();
  });

  it("returns items unchanged when delta is 0", () => {
    const items = [
      makeTask({ id: "a", dueDate: "2026-03-01" }),
    ];

    const result = shiftDatesDeep(items, 0);
    expect(result).toBe(items); // same reference
  });

  it("recurses into nested children", () => {
    const grandchild = makeTask({ id: "gc", dueDate: "2026-03-01", scheduledDate: "2026-03-01" });
    const child = makeTask({ id: "c", dueDate: "2026-03-01", children: [grandchild] });
    const items = [child];

    const result = shiftDatesDeep(items, 7);
    expect(result[0].dueDate).toBe("2026-03-08");
    expect(result[0].children[0].dueDate).toBe("2026-03-08");
    expect(result[0].children[0].scheduledDate).toBe("2026-03-08");
  });

  it("handles negative deltas", () => {
    const items = [
      makeTask({ id: "a", dueDate: "2026-03-10" }),
    ];

    const result = shiftDatesDeep(items, -3);
    expect(result[0].dueDate).toBe("2026-03-07");
  });

  it("returns empty array for empty input", () => {
    expect(shiftDatesDeep([], 5)).toEqual([]);
  });

  it("shifts dates across month boundaries correctly", () => {
    const items = [
      makeTask({ id: "a", dueDate: "2026-01-30" }),
    ];

    const result = shiftDatesDeep(items, 3);
    expect(result[0].dueDate).toBe("2026-02-02");
  });
});

// ---------------------------------------------------------------------------
// mergeReorderedTasks
// ---------------------------------------------------------------------------

describe("mergeReorderedTasks", () => {
  it("preserves tasks from other lists when reordering a filtered list", () => {
    const listA1 = makeTask({ id: "a1", listId: "listA" });
    const listA2 = makeTask({ id: "a2", listId: "listA" });
    const listB1 = makeTask({ id: "b1", listId: "listB" });
    const listB2 = makeTask({ id: "b2", listId: "listB" });
    const prev = [listA1, listA2, listB1, listB2];

    // User reordered List A only (swapped a1 and a2)
    const reordered = [listA2, listA1];

    const result = mergeReorderedTasks(prev, reordered);

    // Reordered tasks come first, preserved tasks after
    expect(result.map((t) => t.id)).toEqual(["a2", "a1", "b1", "b2"]);
  });

  it("preserves inbox tasks when reordering a named list", () => {
    const inbox1 = makeTask({ id: "inbox1" }); // no listId = inbox
    const listTask = makeTask({ id: "lt1", listId: "myList" });
    const prev = [inbox1, listTask];

    const reordered = [listTask]; // reordering "myList" view

    const result = mergeReorderedTasks(prev, reordered);
    expect(result.map((t) => t.id)).toEqual(["lt1", "inbox1"]);
  });

  it("preserves named-list tasks when reordering inbox", () => {
    const inbox1 = makeTask({ id: "inbox1" });
    const inbox2 = makeTask({ id: "inbox2" });
    const listTask = makeTask({ id: "lt1", listId: "myList" });
    const prev = [inbox1, inbox2, listTask];

    // Reordering inbox view (swapped inbox1 and inbox2)
    const reordered = [inbox2, inbox1];

    const result = mergeReorderedTasks(prev, reordered);
    expect(result.map((t) => t.id)).toEqual(["inbox2", "inbox1", "lt1"]);
  });

  it("works correctly when reordering all tasks (no tasks to preserve)", () => {
    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });
    const t3 = makeTask({ id: "t3" });
    const prev = [t1, t2, t3];

    const reordered = [t3, t1, t2];

    const result = mergeReorderedTasks(prev, reordered);
    expect(result.map((t) => t.id)).toEqual(["t3", "t1", "t2"]);
  });

  it("reinserts archived tasks at their original parent positions", () => {
    const archivedChild = makeTask({ id: "ac", archived: true });
    const parent = makeTask({ id: "p", children: [makeTask({ id: "c1" }), archivedChild] });
    const prev = [parent];

    // UI receives parent without archived child, then reorders
    const reordered = [{ ...parent, children: [makeTask({ id: "c1" })] }];

    const result = mergeReorderedTasks(prev, reordered);
    expect(result[0].children.map((c) => c.id)).toEqual(["c1", "ac"]);
    expect(result[0].children[1].archived).toBe(true);
  });

  it("reinserts root-level archived tasks", () => {
    const active = makeTask({ id: "a1" });
    const archived = makeTask({ id: "arch", archived: true });
    const prev = [active, archived];

    // UI only sees active tasks
    const reordered = [active];

    const result = mergeReorderedTasks(prev, reordered);
    expect(result.map((t) => t.id)).toEqual(["a1", "arch"]);
    expect(result[1].archived).toBe(true);
  });

  it("preserves tasks from multiple different lists", () => {
    const a = makeTask({ id: "a", listId: "listA" });
    const b = makeTask({ id: "b", listId: "listB" });
    const c = makeTask({ id: "c", listId: "listC" });
    const d = makeTask({ id: "d", listId: "listA" });
    const prev = [a, b, c, d];

    // Reordering only List A (swapped a and d)
    const reordered = [d, a];

    const result = mergeReorderedTasks(prev, reordered);
    expect(result.map((t) => t.id)).toEqual(["d", "a", "b", "c"]);
  });

  it("handles children in reordered tasks (deep ID collection)", () => {
    const child = makeTask({ id: "child" });
    const parent = makeTask({ id: "parent", children: [child], listId: "listA" });
    const other = makeTask({ id: "other", listId: "listB" });
    const prev = [parent, other];

    const reordered = [parent]; // List A view, parent includes child

    const result = mergeReorderedTasks(prev, reordered);
    expect(result.map((t) => t.id)).toEqual(["parent", "other"]);
    expect(result[0].children.map((c) => c.id)).toEqual(["child"]);
  });

  it("handles empty reordered input (preserves all tasks)", () => {
    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });
    const prev = [t1, t2];

    const result = mergeReorderedTasks(prev, []);
    expect(result.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("handles empty previous state", () => {
    const result = mergeReorderedTasks([], []);
    expect(result).toEqual([]);
  });

  it("combines archived reinsertion and list preservation", () => {
    const archivedRoot = makeTask({ id: "arch", archived: true });
    const listA = makeTask({ id: "a1", listId: "listA" });
    const listB = makeTask({ id: "b1", listId: "listB" });
    const prev = [listA, listB, archivedRoot];

    // Reorder List A only
    const reordered = [listA];

    const result = mergeReorderedTasks(prev, reordered);
    // Should have: reordered List A, root archived, preserved List B
    expect(result.map((t) => t.id)).toEqual(["a1", "arch", "b1"]);
    expect(result[1].archived).toBe(true);
  });
});

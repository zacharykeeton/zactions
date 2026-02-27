import { describe, it, expect } from "vitest";
import { migrateTask, removeDependencyRef, setArchivedDeep, setArchivedOnTask } from "./task-store-utils";
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
      { scheduledDate: null, dueDate: null, completedAt: "2026-01-01T00:00:00Z" },
      { scheduledDate: null, dueDate: null, completedAt: "2026-01-02T00:00:00Z" },
    ]);
  });

  it("leaves already-migrated CompletionRecord[] unchanged", () => {
    const records: CompletionRecord[] = [
      { scheduledDate: "2026-01-01", dueDate: "2026-01-02", completedAt: "2026-01-02T12:00:00Z" },
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
      { scheduledDate: null, dueDate: null, completedAt: "2026-01-01T00:00:00Z" },
      { scheduledDate: "2026-01-05", dueDate: "2026-01-06", completedAt: "2026-01-06T12:00:00Z" },
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
      { scheduledDate: null, dueDate: null, completedAt: "2026-01-01T00:00:00Z" },
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

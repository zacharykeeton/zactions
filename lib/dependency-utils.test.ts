import { describe, it, expect } from "vitest";
import type { Task } from "./types";
import {
  getBlockingTask,
  isTaskBlocked,
  wouldCreateCycle,
  getEligibleDependencies,
} from "./dependency-utils";

function makeTask(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    completed: false,
    priority: "medium",
    dueDate: null,
    scheduledDate: null,
    startDate: null,
    completedDate: null,
    createdDate: "2025-01-01",
    children: [],
    timeInvestedMs: 0,
    timeEstimateMs: null,
    archived: false,
    ...overrides,
  };
}

describe("getBlockingTask", () => {
  it("returns null when task has no dependencies", () => {
    const task = makeTask({ id: "a", title: "A" });
    expect(getBlockingTask([task], task)).toBeNull();
  });

  it("returns null when dependency is completed", () => {
    const dep = makeTask({ id: "dep", title: "Dep", completed: true });
    const task = makeTask({ id: "a", title: "A", dependsOn: ["dep"] });
    expect(getBlockingTask([dep, task], task)).toBeNull();
  });

  it("returns null when dependency is archived", () => {
    const dep = makeTask({ id: "dep", title: "Dep", archived: true });
    const task = makeTask({ id: "a", title: "A", dependsOn: ["dep"] });
    expect(getBlockingTask([dep, task], task)).toBeNull();
  });

  it("returns null when dependency has been deleted (not in tree)", () => {
    const task = makeTask({ id: "a", title: "A", dependsOn: ["deleted-id"] });
    expect(getBlockingTask([task], task)).toBeNull();
  });

  it("returns the blocking task when dependency is incomplete", () => {
    const dep = makeTask({ id: "dep", title: "Dep" });
    const task = makeTask({ id: "a", title: "A", dependsOn: ["dep"] });
    expect(getBlockingTask([dep, task], task)).toEqual(dep);
  });

  it("finds dependencies nested in the tree", () => {
    const dep = makeTask({ id: "dep", title: "Dep" });
    const parent = makeTask({ id: "parent", title: "Parent", children: [dep] });
    const task = makeTask({ id: "a", title: "A", dependsOn: ["dep"] });
    expect(getBlockingTask([parent, task], task)).toEqual(dep);
  });
});

describe("isTaskBlocked", () => {
  it("returns false when not blocked", () => {
    const task = makeTask({ id: "a", title: "A" });
    expect(isTaskBlocked([task], task)).toBe(false);
  });

  it("returns true when blocked", () => {
    const dep = makeTask({ id: "dep", title: "Dep" });
    const task = makeTask({ id: "a", title: "A", dependsOn: ["dep"] });
    expect(isTaskBlocked([dep, task], task)).toBe(true);
  });
});

describe("wouldCreateCycle", () => {
  it("detects direct A↔B cycle", () => {
    const a = makeTask({ id: "a", title: "A", dependsOn: ["b"] });
    const b = makeTask({ id: "b", title: "B" });
    // Adding A as a dependency of B would create a cycle: B→A→B
    expect(wouldCreateCycle([a, b], "b", "a")).toBe(true);
  });

  it("detects indirect A→B→C→A cycle", () => {
    const a = makeTask({ id: "a", title: "A", dependsOn: ["c"] });
    const b = makeTask({ id: "b", title: "B", dependsOn: ["a"] });
    const c = makeTask({ id: "c", title: "C" });
    // Adding B as dep of C: C→B→A→C
    expect(wouldCreateCycle([a, b, c], "c", "b")).toBe(true);
  });

  it("returns false when no cycle", () => {
    const a = makeTask({ id: "a", title: "A" });
    const b = makeTask({ id: "b", title: "B" });
    expect(wouldCreateCycle([a, b], "a", "b")).toBe(false);
  });

  it("detects self-reference", () => {
    const a = makeTask({ id: "a", title: "A" });
    expect(wouldCreateCycle([a], "a", "a")).toBe(true);
  });
});

describe("getEligibleDependencies", () => {
  it("returns same-list tasks, excluding self/archived/recurring/cyclic", () => {
    const self = makeTask({ id: "self", title: "Self", listId: "list1" });
    const sameList = makeTask({ id: "same", title: "Same List", listId: "list1" });
    const otherList = makeTask({ id: "other", title: "Other List", listId: "list2" });
    const archived = makeTask({ id: "arch", title: "Archived", listId: "list1", archived: true });
    const recurring = makeTask({
      id: "rec",
      title: "Recurring",
      listId: "list1",
      recurrence: { interval: "daily" },
      dueDate: "2025-01-01",
    });

    const tasks = [self, sameList, otherList, archived, recurring];
    const eligible = getEligibleDependencies(tasks, "self", "list1");

    expect(eligible.map((t) => t.id)).toEqual(["same"]);
  });

  it("handles Inbox (undefined listId)", () => {
    const self = makeTask({ id: "self", title: "Self" }); // no listId = inbox
    const inboxTask = makeTask({ id: "inbox", title: "Inbox Task" });
    const listTask = makeTask({ id: "listed", title: "Listed", listId: "list1" });

    const tasks = [self, inboxTask, listTask];
    const eligible = getEligibleDependencies(tasks, "self", undefined);

    expect(eligible.map((t) => t.id)).toEqual(["inbox"]);
  });

  it("excludes tasks that would create a cycle", () => {
    const a = makeTask({ id: "a", title: "A", dependsOn: ["b"], listId: "list1" });
    const b = makeTask({ id: "b", title: "B", listId: "list1" });
    const c = makeTask({ id: "c", title: "C", listId: "list1" });

    // For task B: A depends on B, so adding A as dep of B would cycle
    const eligible = getEligibleDependencies([a, b, c], "b", "list1");
    expect(eligible.map((t) => t.id)).toEqual(["c"]);
  });
});

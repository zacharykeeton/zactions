import { describe, it, expect } from "vitest";
import { searchTasks, formatBreadcrumb } from "./search-utils";
import type { Task } from "./types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    title: overrides.title ?? "Test Task",
    completed: false,
    priority: "medium",
    dueDate: null,
    scheduledDate: null,
    startDate: null,
    completedDate: null,
    createdDate: "2026-01-01",
    children: overrides.children ?? [],
    timeInvestedMs: 0,
    timeEstimateMs: null,
    archived: overrides.archived ?? false,
    ...overrides,
  };
}

describe("searchTasks", () => {
  it("returns empty array for empty query", () => {
    const tasks = [makeTask({ title: "Buy milk" })];
    expect(searchTasks(tasks, "")).toEqual([]);
    expect(searchTasks(tasks, "   ")).toEqual([]);
  });

  it("matches partial title substring", () => {
    const tasks = [
      makeTask({ id: "1", title: "Groceries" }),
      makeTask({ id: "2", title: "Fix plumbing" }),
      makeTask({ id: "3", title: "Read book" }),
    ];
    const results = searchTasks(tasks, "gro");
    expect(results).toHaveLength(1);
    expect(results[0].task.title).toBe("Groceries");
  });

  it("is case insensitive", () => {
    const tasks = [makeTask({ id: "1", title: "buy milk" })];
    const results = searchTasks(tasks, "BUY");
    expect(results).toHaveLength(1);
    expect(results[0].task.title).toBe("buy milk");
  });

  it("finds nested subtasks with breadcrumb", () => {
    const tasks = [
      makeTask({
        id: "1",
        title: "Errands",
        children: [
          makeTask({
            id: "2",
            title: "Shopping",
            children: [
              makeTask({ id: "3", title: "Buy milk" }),
            ],
          }),
        ],
      }),
    ];
    const results = searchTasks(tasks, "milk");
    expect(results).toHaveLength(1);
    expect(results[0].task.title).toBe("Buy milk");
    expect(results[0].breadcrumb).toEqual(["Errands", "Shopping"]);
  });

  it("excludes archived tasks", () => {
    const tasks = [
      makeTask({ id: "1", title: "Active task" }),
      makeTask({ id: "2", title: "Archived task", archived: true }),
    ];
    const results = searchTasks(tasks, "task");
    expect(results).toHaveLength(1);
    expect(results[0].task.title).toBe("Active task");
  });

  it("excludes children of archived tasks", () => {
    const tasks = [
      makeTask({
        id: "1",
        title: "Archived parent",
        archived: true,
        children: [
          makeTask({ id: "2", title: "Child task" }),
        ],
      }),
    ];
    const results = searchTasks(tasks, "child");
    expect(results).toHaveLength(0);
  });

  it("inherits listId from parent", () => {
    const tasks = [
      makeTask({
        id: "1",
        title: "Parent",
        listId: "list-1",
        children: [
          makeTask({ id: "2", title: "Child task" }),
        ],
      }),
    ];
    const results = searchTasks(tasks, "child");
    expect(results).toHaveLength(1);
    expect(results[0].listId).toBe("list-1");
  });

  it("matches multiple results", () => {
    const tasks = [
      makeTask({ id: "1", title: "Buy groceries" }),
      makeTask({ id: "2", title: "Buy shoes" }),
      makeTask({ id: "3", title: "Read book" }),
    ];
    const results = searchTasks(tasks, "buy");
    expect(results).toHaveLength(2);
  });
});

describe("formatBreadcrumb", () => {
  it("formats breadcrumb with list name and parents", () => {
    const result = {
      task: makeTask({ title: "Buy milk" }),
      breadcrumb: ["Errands", "Shopping"],
      listId: "list-1",
    };
    const listNames = { "list-1": "Personal" };
    expect(formatBreadcrumb(result, listNames)).toBe("Personal > Errands > Shopping");
  });

  it("formats breadcrumb without list name", () => {
    const result = {
      task: makeTask({ title: "Buy milk" }),
      breadcrumb: ["Errands"],
      listId: undefined,
    };
    expect(formatBreadcrumb(result, {})).toBe("Errands");
  });

  it("returns empty string for root task with no list", () => {
    const result = {
      task: makeTask({ title: "Root task" }),
      breadcrumb: [],
      listId: undefined,
    };
    expect(formatBreadcrumb(result, {})).toBe("");
  });
});

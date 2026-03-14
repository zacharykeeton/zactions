import { describe, it, expect } from "vitest";
import {
  flattenTasksForSync,
  buildTaskTreeFromRows,
  extractJunctionData,
} from "./sync-tree-utils";
import type { Task } from "./types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test Task",
    completed: false,
    priority: "medium",
    dueDate: null,
    scheduledDate: null,
    startDate: null,
    completedDate: null,
    createdDate: "2024-01-01T00:00:00.000Z",
    children: [],
    timeInvestedMs: 0,
    timeEstimateMs: null,
    archived: false,
    ...overrides,
  };
}

describe("flattenTasksForSync", () => {
  it("flattens a single root task", () => {
    const tasks = [makeTask()];
    const rows = flattenTasksForSync(tasks);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("task-1");
    expect(rows[0].parentId).toBeNull();
    expect(rows[0].position).toBe(0);
  });

  it("flattens nested tasks with correct parentId and position", () => {
    const tasks = [
      makeTask({
        id: "parent",
        children: [
          makeTask({ id: "child-1" }),
          makeTask({ id: "child-2" }),
        ],
      }),
    ];
    const rows = flattenTasksForSync(tasks);

    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe("parent");
    expect(rows[0].parentId).toBeNull();

    expect(rows[1].id).toBe("child-1");
    expect(rows[1].parentId).toBe("parent");
    expect(rows[1].position).toBe(0);

    expect(rows[2].id).toBe("child-2");
    expect(rows[2].parentId).toBe("parent");
    expect(rows[2].position).toBe(1);
  });

  it("extracts recurrence fields", () => {
    const tasks = [
      makeTask({
        recurrence: {
          interval: "weekly",
          frequency: 2,
          daysOfWeek: [1, 3, 5],
        },
      }),
    ];
    const rows = flattenTasksForSync(tasks);

    expect(rows[0].recurrenceInterval).toBe("weekly");
    expect(rows[0].recurrenceFrequency).toBe(2);
    expect(rows[0].recurrenceDaysOfWeek).toBe("[1,3,5]");
  });

  it("extracts tags and dependencies", () => {
    const tasks = [
      makeTask({
        tags: ["tag-a", "tag-b"],
        dependsOn: ["dep-1"],
      }),
    ];
    const rows = flattenTasksForSync(tasks);

    expect(rows[0].tags).toEqual(["tag-a", "tag-b"]);
    expect(rows[0].dependsOn).toEqual(["dep-1"]);
  });

  it("handles deeply nested trees", () => {
    const tasks = [
      makeTask({
        id: "a",
        children: [
          makeTask({
            id: "b",
            children: [makeTask({ id: "c" })],
          }),
        ],
      }),
    ];
    const rows = flattenTasksForSync(tasks);

    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe("a");
    expect(rows[1].id).toBe("b");
    expect(rows[1].parentId).toBe("a");
    expect(rows[2].id).toBe("c");
    expect(rows[2].parentId).toBe("b");
  });
});

describe("buildTaskTreeFromRows", () => {
  it("builds a single root task", () => {
    const rows = flattenTasksForSync([makeTask()]);
    const tree = buildTaskTreeFromRows(rows);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("task-1");
    expect(tree[0].children).toEqual([]);
  });

  it("reconstructs nested tree from flat rows", () => {
    const original = [
      makeTask({
        id: "parent",
        children: [
          makeTask({ id: "child-1" }),
          makeTask({ id: "child-2" }),
        ],
      }),
    ];
    const rows = flattenTasksForSync(original);
    const tree = buildTaskTreeFromRows(rows);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("parent");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].id).toBe("child-1");
    expect(tree[0].children[1].id).toBe("child-2");
  });

  it("preserves position ordering", () => {
    const rows = flattenTasksForSync([
      makeTask({ id: "a" }),
      makeTask({ id: "b" }),
      makeTask({ id: "c" }),
    ]);
    // Shuffle rows to test sorting
    const shuffled = [rows[2], rows[0], rows[1]];
    const tree = buildTaskTreeFromRows(shuffled);

    expect(tree.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("reconstructs recurrence from flat fields", () => {
    const original = [
      makeTask({
        recurrence: {
          interval: "weekly",
          frequency: 2,
          daysOfWeek: [1, 3, 5],
        },
        completionHistory: [],
      }),
    ];
    const rows = flattenTasksForSync(original);
    const tree = buildTaskTreeFromRows(rows);

    expect(tree[0].recurrence).toEqual({
      interval: "weekly",
      frequency: 2,
      daysOfWeek: [1, 3, 5],
    });
  });

  it("sets recurrence to undefined when no recurrence fields", () => {
    const rows = flattenTasksForSync([makeTask()]);
    const tree = buildTaskTreeFromRows(rows);

    expect(tree[0].recurrence).toBeUndefined();
  });

  it("handles tags and dependencies", () => {
    const original = [
      makeTask({
        tags: ["tag-1"],
        dependsOn: ["dep-1", "dep-2"],
      }),
    ];
    const rows = flattenTasksForSync(original);
    const tree = buildTaskTreeFromRows(rows);

    expect(tree[0].tags).toEqual(["tag-1"]);
    expect(tree[0].dependsOn).toEqual(["dep-1", "dep-2"]);
  });

  it("sets tags/dependsOn to undefined when empty", () => {
    const rows = flattenTasksForSync([makeTask()]);
    const tree = buildTaskTreeFromRows(rows);

    expect(tree[0].tags).toBeUndefined();
    expect(tree[0].dependsOn).toBeUndefined();
  });
});

describe("extractJunctionData", () => {
  it("extracts task tags", () => {
    const rows = flattenTasksForSync([
      makeTask({ id: "t1", tags: ["tag-a", "tag-b"] }),
    ]);
    const junctions = extractJunctionData(rows);

    expect(junctions.taskTags).toEqual([
      { taskId: "t1", tagId: "tag-a" },
      { taskId: "t1", tagId: "tag-b" },
    ]);
  });

  it("extracts task dependencies", () => {
    const rows = flattenTasksForSync([
      makeTask({ id: "t1", dependsOn: ["dep-1"] }),
    ]);
    const junctions = extractJunctionData(rows);

    expect(junctions.taskDependencies).toEqual([
      { taskId: "t1", dependsOnId: "dep-1" },
    ]);
  });

  it("extracts completion history with generated IDs", () => {
    const rows = flattenTasksForSync([
      makeTask({
        id: "t1",
        completionHistory: [
          {
            scheduledDate: "2024-01-01",
            dueDate: "2024-01-01",
            completedAt: "2024-01-01T12:00:00Z",
            timeInvestedMs: 5000,
          },
        ],
      }),
    ]);
    const junctions = extractJunctionData(rows);

    expect(junctions.completionHistory).toHaveLength(1);
    expect(junctions.completionHistory[0].taskId).toBe("t1");
    expect(junctions.completionHistory[0].completedAt).toBe("2024-01-01T12:00:00Z");
    expect(junctions.completionHistory[0].id).toBeTruthy(); // UUID generated
  });
});

describe("roundtrip: flatten → build", () => {
  it("preserves full task data through roundtrip", () => {
    const original: Task[] = [
      {
        id: "root-1",
        title: "Root Task",
        completed: false,
        priority: "high",
        dueDate: "2024-06-15",
        scheduledDate: "2024-06-14",
        startDate: "2024-06-01",
        completedDate: null,
        createdDate: "2024-01-01T00:00:00.000Z",
        children: [
          {
            id: "child-1",
            title: "Child 1",
            completed: true,
            priority: "low",
            dueDate: null,
            scheduledDate: null,
            startDate: null,
            completedDate: "2024-06-10T00:00:00.000Z",
            createdDate: "2024-01-02T00:00:00.000Z",
            children: [],
            timeInvestedMs: 3600000,
            timeEstimateMs: 7200000,
            archived: false,
            tags: ["tag-1"],
          },
        ],
        recurrence: {
          interval: "daily",
          frequency: 1,
        },
        completionHistory: [
          {
            scheduledDate: "2024-06-13",
            dueDate: "2024-06-14",
            completedAt: "2024-06-14T10:00:00Z",
            timeInvestedMs: 1800000,
          },
        ],
        timeInvestedMs: 1800000,
        timeEstimateMs: 3600000,
        archived: false,
        tags: ["tag-1", "tag-2"],
        listId: "list-1",
        dependsOn: ["other-task"],
      },
      {
        id: "root-2",
        title: "Root Task 2",
        completed: false,
        priority: "medium",
        dueDate: null,
        scheduledDate: null,
        startDate: null,
        completedDate: null,
        createdDate: "2024-01-03T00:00:00.000Z",
        children: [],
        timeInvestedMs: 0,
        timeEstimateMs: null,
        archived: false,
      },
    ];

    const rows = flattenTasksForSync(original);
    const rebuilt = buildTaskTreeFromRows(rows);

    // Compare key structural properties
    expect(rebuilt).toHaveLength(2);

    const r1 = rebuilt[0];
    expect(r1.id).toBe("root-1");
    expect(r1.title).toBe("Root Task");
    expect(r1.priority).toBe("high");
    expect(r1.dueDate).toBe("2024-06-15");
    expect(r1.recurrence).toEqual({ interval: "daily", frequency: 1 });
    expect(r1.tags).toEqual(["tag-1", "tag-2"]);
    expect(r1.listId).toBe("list-1");
    expect(r1.dependsOn).toEqual(["other-task"]);
    expect(r1.children).toHaveLength(1);
    expect(r1.children[0].id).toBe("child-1");
    expect(r1.children[0].tags).toEqual(["tag-1"]);

    const r2 = rebuilt[1];
    expect(r2.id).toBe("root-2");
    expect(r2.children).toEqual([]);
    expect(r2.tags).toBeUndefined();
    expect(r2.listId).toBeUndefined();
  });
});

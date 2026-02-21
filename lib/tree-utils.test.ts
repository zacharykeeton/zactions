import { describe, it, expect } from 'vitest';
import { startOfDay, parseISO } from 'date-fns';
import { getTasksForToday, excludeArchivedTasks, collectArchivedTasks } from './tree-utils';
import type { Task } from './types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test task',
    completed: false,
    priority: 'medium',
    dueDate: null,
    scheduledDate: null,
    completedDate: null,
    createdDate: '2026-02-01',
    children: [],
    timeInvestedMs: 0,
    archived: false,
    ...overrides,
  };
}

describe('getTasksForToday', () => {
  // Use startOfDay(parseISO(...)) to match how the app constructs "today"
  const today = startOfDay(parseISO('2026-02-20'));

  describe('excludes tasks completed before today', () => {
    it('should exclude a task completed yesterday', () => {
      const tasks = [
        makeTask({
          dueDate: '2026-02-20',
          completed: true,
          completedDate: '2026-02-19',
        }),
      ];
      const result = getTasksForToday(tasks, today);
      expect(result).toHaveLength(0);
    });

    it('should exclude a task completed several days ago', () => {
      const tasks = [
        makeTask({
          scheduledDate: '2026-02-20',
          completed: true,
          completedDate: '2026-02-15',
        }),
      ];
      const result = getTasksForToday(tasks, today);
      expect(result).toHaveLength(0);
    });

    it('should include a task completed today', () => {
      const tasks = [
        makeTask({
          dueDate: '2026-02-20',
          completed: true,
          completedDate: '2026-02-20',
        }),
      ];
      const result = getTasksForToday(tasks, today);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-1');
    });

    it('should include an incomplete task due today', () => {
      const tasks = [
        makeTask({
          dueDate: '2026-02-20',
        }),
      ];
      const result = getTasksForToday(tasks, today);
      expect(result).toHaveLength(1);
    });

    it('should include an incomplete task scheduled today', () => {
      const tasks = [
        makeTask({
          scheduledDate: '2026-02-20',
        }),
      ];
      const result = getTasksForToday(tasks, today);
      expect(result).toHaveLength(1);
    });

    it('should include a completed task with no completedDate (legacy data)', () => {
      const tasks = [
        makeTask({
          dueDate: '2026-02-20',
          completed: true,
          completedDate: null,
        }),
      ];
      const result = getTasksForToday(tasks, today);
      expect(result).toHaveLength(1);
    });
  });

  describe('still traverses children of excluded tasks', () => {
    it('should include a child task even when the parent is excluded', () => {
      const tasks = [
        makeTask({
          id: 'parent',
          dueDate: '2026-02-20',
          completed: true,
          completedDate: '2026-02-18',
          children: [
            makeTask({
              id: 'child',
              dueDate: '2026-02-20',
              completed: false,
            }),
          ],
        }),
      ];
      const result = getTasksForToday(tasks, today);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('child');
    });
  });

  describe('mixed scenarios', () => {
    it('should filter correctly among multiple tasks', () => {
      const tasks = [
        makeTask({
          id: 'completed-yesterday',
          dueDate: '2026-02-20',
          completed: true,
          completedDate: '2026-02-19',
        }),
        makeTask({
          id: 'completed-today',
          dueDate: '2026-02-20',
          completed: true,
          completedDate: '2026-02-20',
        }),
        makeTask({
          id: 'incomplete',
          scheduledDate: '2026-02-20',
        }),
        makeTask({
          id: 'overdue',
          dueDate: '2026-02-18',
          completed: false,
        }),
      ];
      const result = getTasksForToday(tasks, today);
      const ids = result.map((t) => t.id);
      expect(ids).toContain('completed-today');
      expect(ids).toContain('incomplete');
      expect(ids).toContain('overdue');
      expect(ids).not.toContain('completed-yesterday');
      expect(result).toHaveLength(3);
    });
  });
});

describe('excludeArchivedTasks', () => {
  it('should remove a top-level archived task', () => {
    const tasks = [
      makeTask({ id: 'a', archived: true }),
      makeTask({ id: 'b', archived: false }),
    ];
    const result = excludeArchivedTasks(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('should remove an archived child but keep the active parent', () => {
    const tasks = [
      makeTask({
        id: 'parent',
        children: [
          makeTask({ id: 'active-child' }),
          makeTask({ id: 'archived-child', archived: true }),
        ],
      }),
    ];
    const result = excludeArchivedTasks(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].id).toBe('active-child');
  });

  it('should remove deeply nested archived tasks', () => {
    const tasks = [
      makeTask({
        id: 'root',
        children: [
          makeTask({
            id: 'mid',
            children: [
              makeTask({ id: 'deep-active' }),
              makeTask({ id: 'deep-archived', archived: true }),
            ],
          }),
        ],
      }),
    ];
    const result = excludeArchivedTasks(tasks);
    expect(result[0].children[0].children).toHaveLength(1);
    expect(result[0].children[0].children[0].id).toBe('deep-active');
  });

  it('should return an empty array when all tasks are archived', () => {
    const tasks = [
      makeTask({ id: 'a', archived: true }),
      makeTask({ id: 'b', archived: true }),
    ];
    expect(excludeArchivedTasks(tasks)).toHaveLength(0);
  });

  it('should return all tasks unchanged when none are archived', () => {
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', children: [makeTask({ id: 'c' })] }),
    ];
    const result = excludeArchivedTasks(tasks);
    expect(result).toHaveLength(2);
    expect(result[1].children).toHaveLength(1);
  });
});

describe('collectArchivedTasks', () => {
  it('should collect a top-level archived task', () => {
    const tasks = [
      makeTask({ id: 'active' }),
      makeTask({ id: 'archived', archived: true }),
    ];
    const result = collectArchivedTasks(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('archived');
  });

  it('should find an archived child nested under an active parent', () => {
    const tasks = [
      makeTask({
        id: 'parent',
        children: [
          makeTask({ id: 'active-child' }),
          makeTask({ id: 'archived-child', archived: true }),
        ],
      }),
    ];
    const result = collectArchivedTasks(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('archived-child');
  });

  it('should not recurse into children of an archived task', () => {
    const tasks = [
      makeTask({
        id: 'archived-parent',
        archived: true,
        children: [
          makeTask({ id: 'archived-child', archived: true }),
        ],
      }),
    ];
    const result = collectArchivedTasks(tasks);
    // Only the top-level archived parent should be collected, not the child separately
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('archived-parent');
  });

  it('should preserve children on collected archived tasks', () => {
    const tasks = [
      makeTask({
        id: 'archived-parent',
        archived: true,
        children: [
          makeTask({ id: 'child-a' }),
          makeTask({ id: 'child-b' }),
        ],
      }),
    ];
    const result = collectArchivedTasks(tasks);
    expect(result[0].children).toHaveLength(2);
  });

  it('should return empty when no tasks are archived', () => {
    const tasks = [
      makeTask({ id: 'a' }),
      makeTask({ id: 'b', children: [makeTask({ id: 'c' })] }),
    ];
    expect(collectArchivedTasks(tasks)).toHaveLength(0);
  });

  it('should find deeply nested archived tasks', () => {
    const tasks = [
      makeTask({
        id: 'root',
        children: [
          makeTask({
            id: 'mid',
            children: [
              makeTask({ id: 'deep-archived', archived: true }),
            ],
          }),
        ],
      }),
    ];
    const result = collectArchivedTasks(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('deep-archived');
  });
});

describe('archive round-trip: exclude then collect', () => {
  it('excludeArchivedTasks then collectArchivedTasks on original should find the same archived tasks', () => {
    const tasks = [
      makeTask({ id: 'active-1' }),
      makeTask({ id: 'archived-1', archived: true, title: 'Archived One' }),
      makeTask({
        id: 'active-2',
        children: [
          makeTask({ id: 'archived-child', archived: true, title: 'Archived Child' }),
          makeTask({ id: 'active-child' }),
        ],
      }),
    ];

    // This simulates the app flow: active tasks go to TaskTree, archived to ArchivedList
    const active = excludeArchivedTasks(tasks);
    const archived = collectArchivedTasks(tasks);

    // Active tree should not contain any archived tasks
    expect(active).toHaveLength(2);
    expect(active[0].id).toBe('active-1');
    expect(active[1].id).toBe('active-2');
    expect(active[1].children).toHaveLength(1);
    expect(active[1].children[0].id).toBe('active-child');

    // Archived list should have both archived tasks
    expect(archived).toHaveLength(2);
    const archivedIds = archived.map((t) => t.id);
    expect(archivedIds).toContain('archived-1');
    expect(archivedIds).toContain('archived-child');
  });

  it('reordering active tasks should not lose archived tasks (regression test)', () => {
    // This is the core regression test for the bug where drag-and-drop
    // reorder replaced the entire state with only active tasks.
    const tasks = [
      makeTask({ id: 'active-1' }),
      makeTask({ id: 'archived-top', archived: true }),
      makeTask({
        id: 'active-2',
        children: [
          makeTask({ id: 'active-child' }),
          makeTask({ id: 'archived-nested', archived: true }),
        ],
      }),
    ];

    // Step 1: Simulate what the app does — filter active tasks for TaskTree
    const activeTasks = excludeArchivedTasks(tasks);
    expect(activeTasks).toHaveLength(2);

    // Step 2: Simulate a reorder (swap the two active tasks)
    const reordered = [activeTasks[1], activeTasks[0]];

    // Step 3: Simulate what reorderTasks now does — merge archived back in
    const archivedByParent = new Map<string | null, Task[]>();
    function collectArchived(items: Task[], parentId: string | null) {
      for (const item of items) {
        if (item.archived) {
          const list = archivedByParent.get(parentId) || [];
          list.push(item);
          archivedByParent.set(parentId, list);
        } else {
          collectArchived(item.children, item.id);
        }
      }
    }
    collectArchived(tasks, null);

    function reinsert(items: Task[], parentId: string | null): Task[] {
      const result = items.map((item) => ({
        ...item,
        children: reinsert(item.children, item.id),
      }));
      const archived = archivedByParent.get(parentId);
      if (archived) result.push(...archived);
      return result;
    }
    const merged = reinsert(reordered, null);

    // Verify: active tasks are reordered
    expect(merged[0].id).toBe('active-2');
    expect(merged[1].id).toBe('active-1');

    // Verify: top-level archived task is preserved
    const mergedArchived = collectArchivedTasks(merged);
    const archivedIds = mergedArchived.map((t) => t.id);
    expect(archivedIds).toContain('archived-top');
    expect(archivedIds).toContain('archived-nested');

    // Verify: nested archived task is back under its original parent
    const active2 = merged.find((t) => t.id === 'active-2')!;
    expect(active2.children.some((c) => c.id === 'archived-nested')).toBe(true);
  });
});

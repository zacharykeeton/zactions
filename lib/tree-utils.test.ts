import { describe, it, expect } from 'vitest';
import { startOfDay, parseISO } from 'date-fns';
import { getTasksForToday } from './tree-utils';
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

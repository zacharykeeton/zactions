import { arrayMove } from "@dnd-kit/sortable";
import { isSameDay, isBefore, parseISO } from "date-fns";
import type { Task, FlattenedTask } from "./types";

function flatten(
  tasks: Task[],
  parentId: string | null,
  depth: number
): FlattenedTask[] {
  return tasks.reduce<FlattenedTask[]>((acc, task, index) => {
    const flatTask: FlattenedTask = { ...task, parentId, depth, index };
    return [...acc, flatTask, ...flatten(task.children, task.id, depth + 1)];
  }, []);
}

export function flattenTree(tasks: Task[]): FlattenedTask[] {
  return flatten(tasks, null, 0);
}

export function buildTree(flattenedItems: FlattenedTask[]): Task[] {
  const root: Task[] = [];
  const map = new Map<string, Task>();

  for (const item of flattenedItems) {
    const task: Task = {
      id: item.id,
      title: item.title,
      completed: item.completed,
      priority: item.priority,
      dueDate: item.dueDate,
      scheduledDate: item.scheduledDate,
      completedDate: item.completedDate,
      createdDate: item.createdDate,
      children: [],
      recurrence: item.recurrence,
      completionHistory: item.completionHistory,
      timeInvestedMs: item.timeInvestedMs,
      archived: item.archived,
    };
    map.set(task.id, task);
  }

  for (const item of flattenedItems) {
    const task = map.get(item.id)!;
    if (item.parentId === null || !map.has(item.parentId)) {
      root.push(task);
    } else {
      map.get(item.parentId)!.children.push(task);
    }
  }

  return root;
}

export function getProjection(
  items: FlattenedTask[],
  activeId: string,
  overId: string,
  dragOffset: number,
  indentationWidth: number
): { depth: number; parentId: string | null } {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];

  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];

  const dragDepth = Math.round(dragOffset / indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;

  const maxDepth = previousItem ? previousItem.depth + 1 : 0;
  const minDepth = nextItem ? nextItem.depth : 0;

  const depth = Math.min(Math.max(projectedDepth, minDepth), maxDepth);

  function getParentId(): string | null {
    if (depth === 0) return null;
    const itemsBefore = newItems.slice(0, overItemIndex);
    for (let i = itemsBefore.length - 1; i >= 0; i--) {
      if (itemsBefore[i].depth < depth) {
        return itemsBefore[i].id;
      }
    }
    return null;
  }

  return { depth, parentId: getParentId() };
}

export function removeItem(tasks: Task[], id: string): Task[] {
  return tasks.reduce<Task[]>((acc, task) => {
    if (task.id === id) return acc;
    return [
      ...acc,
      { ...task, children: removeItem(task.children, id) },
    ];
  }, []);
}

export function findItemDeep(tasks: Task[], id: string): Task | undefined {
  for (const task of tasks) {
    if (task.id === id) return task;
    const found = findItemDeep(task.children, id);
    if (found) return found;
  }
  return undefined;
}

export function setProperty<K extends keyof Task>(
  tasks: Task[],
  id: string,
  property: K,
  setter: (value: Task[K]) => Task[K]
): Task[] {
  return tasks.map((task) => {
    if (task.id === id) {
      return { ...task, [property]: setter(task[property]) };
    }
    if (task.children.length > 0) {
      return {
        ...task,
        children: setProperty(task.children, id, property, setter),
      };
    }
    return task;
  });
}

export function getChildCount(tasks: Task[], id: string): number {
  const item = findItemDeep(tasks, id);
  if (!item) return 0;
  return countDescendants(item);
}

function countDescendants(task: Task): number {
  let count = 0;
  for (const child of task.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}

/**
 * Given a flat list and an active item ID, returns the IDs of the active item
 * and all its descendants (items that should move together during drag).
 */
export function getDragDepthIds(
  flattenedItems: FlattenedTask[],
  activeId: string
): string[] {
  const activeIndex = flattenedItems.findIndex(({ id }) => id === activeId);
  if (activeIndex === -1) return [];

  const activeDepth = flattenedItems[activeIndex].depth;
  const ids = [activeId];

  for (let i = activeIndex + 1; i < flattenedItems.length; i++) {
    if (flattenedItems[i].depth > activeDepth) {
      ids.push(flattenedItems[i].id);
    } else {
      break;
    }
  }

  return ids;
}

export function getTasksForToday(tasks: Task[], today: Date): Task[] {
  const results: Task[] = [];
  function collect(items: Task[]) {
    for (const task of items) {
      if (task.archived) continue;
      const isDueToday = task.dueDate && isSameDay(parseISO(task.dueDate), today);
      const isScheduledToday = task.scheduledDate && isSameDay(parseISO(task.scheduledDate), today);
      const isPastDue = task.dueDate && !task.completed && isBefore(parseISO(task.dueDate), today);
      const isPastScheduled = task.scheduledDate && !task.completed && isBefore(parseISO(task.scheduledDate), today);
      if (isDueToday || isScheduledToday || isPastDue || isPastScheduled) {
        results.push({ ...task, children: [] });
      }
      collect(task.children);
    }
  }
  collect(tasks);
  return results;
}

/**
 * Check if a task was completed today, including recurring tasks that have been reset.
 * Returns true if:
 * - Task is currently marked as completed, OR
 * - Task has a completion record with completedAt matching today
 */
export function wasCompletedToday(task: Task, today: Date): boolean {
  if (task.completed) return true;

  if (task.completionHistory && task.completionHistory.length > 0) {
    return task.completionHistory.some((record) =>
      isSameDay(parseISO(record.completedAt), today)
    );
  }

  return false;
}

/**
 * Check if a task's occurrence for today was completed.
 * For recurring tasks: checks if any completion record has a dueDate or scheduledDate
 * matching today. Migrated records (dueDate === null) fall back to completedAt.
 * For non-recurring tasks: delegates to wasCompletedToday.
 */
export function wasCompletedForToday(task: Task, today: Date): boolean {
  if (!task.recurrence) {
    return wasCompletedToday(task, today);
  }

  if (task.completed) return true;

  if (task.completionHistory && task.completionHistory.length > 0) {
    return task.completionHistory.some((record) => {
      if (record.dueDate === null) {
        return isSameDay(parseISO(record.completedAt), today);
      }
      if (isSameDay(parseISO(record.dueDate), today)) return true;
      if (record.scheduledDate && isSameDay(parseISO(record.scheduledDate), today)) return true;
      return false;
    });
  }

  return false;
}

/**
 * Calculate today's progress statistics for a list of tasks.
 * Uses wasCompletedForToday so recurring tasks count based on their
 * occurrence's due/scheduled date, not just when the user pressed complete.
 */
export function getTodayProgress(tasks: Task[], today: Date): {
  completedCount: number;
  totalCount: number;
  percentage: number;
} {
  const totalCount = tasks.length;
  const completedCount = tasks.filter(task => wasCompletedForToday(task, today)).length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return { completedCount, totalCount, percentage };
}

/** Return only non-archived tasks, recursively. */
export function excludeArchivedTasks(tasks: Task[]): Task[] {
  return tasks.reduce<Task[]>((acc, task) => {
    if (task.archived) return acc;
    return [
      ...acc,
      { ...task, children: excludeArchivedTasks(task.children) },
    ];
  }, []);
}

/** Collect top-level archived tasks (with children intact) for the Archived tab. */
export function collectArchivedTasks(tasks: Task[]): Task[] {
  const results: Task[] = [];
  function collect(items: Task[]) {
    for (const task of items) {
      if (task.archived) {
        results.push(task);
      } else {
        collect(task.children);
      }
    }
  }
  collect(tasks);
  return results;
}

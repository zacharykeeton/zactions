import type { Task } from "./types";

/**
 * Flatten a task tree into a flat array (all levels).
 */
function flattenAll(tasks: Task[]): Task[] {
  const result: Task[] = [];
  function collect(items: Task[]) {
    for (const item of items) {
      result.push(item);
      collect(item.children);
    }
  }
  collect(tasks);
  return result;
}

/**
 * Returns the first incomplete, non-archived dependency task, or null if
 * the task is not blocked.
 */
export function getBlockingTask(tasks: Task[], task: Task): Task | null {
  if (!task.dependsOn || task.dependsOn.length === 0) return null;

  const allTasks = flattenAll(tasks);
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  for (const depId of task.dependsOn) {
    const dep = taskMap.get(depId);
    // Skip missing (deleted) or archived dependencies — they don't block
    if (!dep || dep.archived) continue;
    if (!dep.completed) return dep;
  }

  return null;
}

/**
 * Boolean convenience: is this task blocked by an unfinished dependency?
 */
export function isTaskBlocked(tasks: Task[], task: Task): boolean {
  return getBlockingTask(tasks, task) !== null;
}

/**
 * DFS cycle detection: would adding depId as a dependency of taskId
 * create a cycle? Walks the dependsOn chains from depId; returns true
 * if it reaches taskId.
 */
export function wouldCreateCycle(
  tasks: Task[],
  taskId: string,
  depId: string
): boolean {
  if (taskId === depId) return true;

  const allTasks = flattenAll(tasks);
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  const visited = new Set<string>();

  function dfs(currentId: string): boolean {
    if (currentId === taskId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const current = taskMap.get(currentId);
    if (!current?.dependsOn) return false;

    for (const nextId of current.dependsOn) {
      if (dfs(nextId)) return true;
    }
    return false;
  }

  return dfs(depId);
}

/**
 * Collects tasks eligible as dependencies for a given task:
 * - Same list (matching listId; undefined = Inbox)
 * - Not the task itself
 * - Not archived
 * - Not recurring (completing a recurring task resets it, which would re-block)
 * - Would not create a cycle
 */
export function getEligibleDependencies(
  tasks: Task[],
  taskId: string,
  listId: string | undefined
): Task[] {
  const allTasks = flattenAll(tasks);

  return allTasks.filter((t) => {
    if (t.id === taskId) return false;
    if (t.archived) return false;
    if (t.recurrence) return false;
    // Same list check (undefined === undefined for Inbox)
    if (t.listId !== listId) return false;
    if (wouldCreateCycle(tasks, taskId, t.id)) return false;
    return true;
  });
}

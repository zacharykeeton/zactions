import type { Task, Priority } from "./types";

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Sort today's tasks based on remembered sort order and priority fallback.
 *
 * Logic:
 * 1. Tasks with remembered positions appear first, in stored order
 * 2. New/unsorted tasks appear at bottom, sorted by priority (high → medium → low)
 * 3. Within same priority, maintain stable order by ID
 */
export function sortTodayTasks(tasks: Task[], sortOrder: string[]): Task[] {
  const sortOrderMap = new Map(sortOrder.map((id, index) => [id, index]));

  // Separate tasks into remembered and new
  const remembered: Task[] = [];
  const newTasks: Task[] = [];

  for (const task of tasks) {
    if (sortOrderMap.has(task.id)) {
      remembered.push(task);
    } else {
      newTasks.push(task);
    }
  }

  // Sort remembered by their position in sortOrder
  remembered.sort((a, b) => {
    const aIndex = sortOrderMap.get(a.id)!;
    const bIndex = sortOrderMap.get(b.id)!;
    return aIndex - bIndex;
  });

  // Sort new tasks by priority (high → medium → low), then by ID for stability
  newTasks.sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.id.localeCompare(b.id); // Stable sort by ID
  });

  return [...remembered, ...newTasks];
}

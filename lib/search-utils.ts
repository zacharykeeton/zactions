import type { Task } from "@/lib/types";

export interface SearchResult {
  task: Task;
  breadcrumb: string[]; // parent titles leading to this task
  listId?: string;
}

export function searchTasks(
  tasks: Task[],
  query: string,
  listNames?: Record<string, string>
): SearchResult[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  function walk(items: Task[], breadcrumb: string[], inheritedListId?: string) {
    for (const task of items) {
      if (task.archived) continue;

      const effectiveListId = task.listId ?? inheritedListId;
      const currentBreadcrumb = [...breadcrumb];

      if (task.title.toLowerCase().includes(lowerQuery)) {
        results.push({
          task,
          breadcrumb: currentBreadcrumb,
          listId: effectiveListId,
        });
      }

      walk(task.children, [...currentBreadcrumb, task.title], effectiveListId);
    }
  }

  walk(tasks, []);
  return results;
}

/** Find all ancestor task IDs for a given task in the tree. */
export function findAncestorIds(tasks: Task[], targetId: string): string[] {
  function search(items: Task[], path: string[]): string[] | null {
    for (const task of items) {
      if (task.id === targetId) return path;
      const result = search(task.children, [...path, task.id]);
      if (result) return result;
    }
    return null;
  }
  return search(tasks, []) ?? [];
}

export function formatBreadcrumb(
  result: SearchResult,
  listNames: Record<string, string>
): string {
  const parts: string[] = [];

  if (result.listId && listNames[result.listId]) {
    parts.push(listNames[result.listId]);
  }

  parts.push(...result.breadcrumb);

  return parts.join(" > ");
}

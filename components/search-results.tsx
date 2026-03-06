"use client";

import { useMemo } from "react";
import { SearchIcon } from "lucide-react";
import type { Task, TaskList } from "@/lib/types";
import { searchTasks, formatBreadcrumb, type SearchResult } from "@/lib/search-utils";
import { priorityColors } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SearchResultsProps {
  tasks: Task[];
  lists: TaskList[];
  query: string;
  onNavigateToTask: (result: SearchResult) => void;
}

export function SearchResults({
  tasks,
  lists,
  query,
  onNavigateToTask,
}: SearchResultsProps) {
  const listNames = useMemo(
    () => Object.fromEntries(lists.map((l) => [l.id, l.name])),
    [lists]
  );

  const results = useMemo(
    () => searchTasks(tasks, query),
    [tasks, query]
  );

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
        <SearchIcon className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">No tasks found</p>
          <p className="text-sm text-muted-foreground">
            No tasks match &quot;{query}&quot;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="mb-4 text-sm text-muted-foreground">
        {results.length} result{results.length !== 1 ? "s" : ""} for &quot;{query}&quot;
      </p>
      {results.map((result) => {
        const breadcrumb = formatBreadcrumb(result, listNames);
        return (
          <button
            key={result.task.id}
            onClick={() => onNavigateToTask(result)}
            className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-medium",
                  result.task.completed && "line-through text-muted-foreground"
                )}>
                  {result.task.title}
                </span>
                <Badge
                  variant="secondary"
                  className={cn("text-xs shrink-0", priorityColors[result.task.priority])}
                >
                  {result.task.priority}
                </Badge>
              </div>
              {breadcrumb && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  {breadcrumb}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

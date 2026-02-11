"use client";

import { useMemo } from "react";
import { ArchiveRestore, Archive, Trash2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { collectArchivedTasks } from "@/lib/tree-utils";
import { priorityColors } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ArchivedListProps {
  tasks: Task[];
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ArchivedList({ tasks, onUnarchive, onDelete }: ArchivedListProps) {
  const archivedTasks = useMemo(() => collectArchivedTasks(tasks), [tasks]);

  if (archivedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
        <Archive className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium">No archived tasks</p>
          <p className="text-sm text-muted-foreground">
            Archived tasks will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {archivedTasks.map((task) => (
        <ArchivedTaskRow
          key={task.id}
          task={task}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function ArchivedTaskRow({
  task,
  onUnarchive,
  onDelete,
}: {
  task: Task;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const childCount = countAllChildren(task);

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-border hover:bg-accent/50",
        task.completed && "opacity-60"
      )}
    >
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          task.completed && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        <Badge
          variant="secondary"
          className={cn("text-xs", priorityColors[task.priority])}
        >
          {task.priority}
        </Badge>

        {childCount > 0 && (
          <span className="text-xs text-muted-foreground">
            +{childCount} subtask{childCount === 1 ? "" : "s"}
          </span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onUnarchive(task.id)}
            title="Unarchive task"
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(task.id)}
            title="Delete permanently"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function countAllChildren(task: Task): number {
  let count = 0;
  for (const child of task.children) {
    count += 1 + countAllChildren(child);
  }
  return count;
}

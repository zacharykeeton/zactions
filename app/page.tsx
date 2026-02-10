"use client";

import { useState } from "react";
import { ListTodo, Plus } from "lucide-react";
import { useTaskStore } from "@/hooks/use-task-store";
import { TaskTree } from "@/components/task-tree";
import { TaskForm } from "@/components/task-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Task, Priority, RecurrencePattern } from "@/lib/types";

export default function Home() {
  const {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    reorderTasks,
  } = useTaskStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null);

  function handleAddRootTask() {
    setEditingTask(null);
    setParentIdForNew(null);
    setDialogOpen(true);
  }

  function handleAddSubtask(parentId: string) {
    setEditingTask(null);
    setParentIdForNew(parentId);
    setDialogOpen(true);
  }

  function handleEdit(task: Task) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  function handleFormSubmit(data: {
    title: string;
    priority: Priority;
    dueDate: string | null;
    scheduledDate: string | null;
    parentId: string | null;
    recurrence?: RecurrencePattern;
  }) {
    if (editingTask) {
      updateTask(editingTask.id, {
        title: data.title,
        priority: data.priority,
        dueDate: data.dueDate,
        scheduledDate: data.scheduledDate,
        recurrence: data.recurrence,
      });
    } else {
      addTask(
        data.title,
        data.priority,
        data.dueDate,
        data.scheduledDate,
        data.parentId,
        data.recurrence
      );
    }
    setDialogOpen(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <Button onClick={handleAddRootTask}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </header>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
            <ListTodo className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium">No tasks yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first task to get started
              </p>
            </div>
            <Button variant="outline" onClick={handleAddRootTask}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        ) : (
          <TaskTree
            tasks={tasks}
            onReorder={reorderTasks}
            onToggle={toggleTask}
            onDelete={deleteTask}
            onEdit={handleEdit}
            onAddSubtask={handleAddSubtask}
          />
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTask
                  ? "Edit Task"
                  : parentIdForNew
                    ? "Add Subtask"
                    : "New Task"}
              </DialogTitle>
            </DialogHeader>
            <TaskForm
              key={editingTask?.id ?? parentIdForNew ?? "new"}
              initialData={editingTask ?? undefined}
              parentId={editingTask ? null : parentIdForNew}
              onSubmit={handleFormSubmit}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

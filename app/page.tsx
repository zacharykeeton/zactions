"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ListTodo, Plus, CalendarCheck, Archive } from "lucide-react";
import { preloadCompletionSound } from "@/lib/completion-sound";
import { useTaskStore } from "@/hooks/use-task-store";
import { useTimer } from "@/hooks/use-timer";
import { findItemDeep } from "@/lib/tree-utils";
import { TaskTree } from "@/components/task-tree";
import { TodayList } from "@/components/today-list";
import { ArchivedList } from "@/components/archived-list";
import { excludeArchivedTasks } from "@/lib/tree-utils";
import { TaskForm } from "@/components/task-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Task, Priority, RecurrencePattern } from "@/lib/types";

export default function Home() {
  // Eagerly decode the completion sound so it's ready before the first click.
  useEffect(() => {
    preloadCompletionSound();
  }, []);

  const {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    archiveTask,
    unarchiveTask,
    fastForwardTask,
    skipTodayTask,
  } = useTaskStore();

  const handleSaveElapsed = useCallback(
    (taskId: string, elapsedMs: number) => {
      const task = findItemDeep(tasks, taskId);
      if (task) {
        updateTask(taskId, { timeInvestedMs: task.timeInvestedMs + elapsedMs });
      }
    },
    [tasks, updateTask]
  );

  const saveElapsedRef = useRef(handleSaveElapsed);
  useEffect(() => {
    saveElapsedRef.current = handleSaveElapsed;
  }, [handleSaveElapsed]);

  const stableSaveElapsed = useCallback(
    (taskId: string, elapsedMs: number) => {
      saveElapsedRef.current(taskId, elapsedMs);
    },
    []
  );

  const { activeTimerId, currentElapsedMs, startTimer, pauseTimer, stopTimerForTask } =
    useTimer(stableSaveElapsed);

  function handleToggleWithTimer(id: string) {
    stopTimerForTask(id);
    toggleTask(id);
  }

  function handleDeleteWithTimer(id: string) {
    stopTimerForTask(id);
    deleteTask(id);
  }

  function handleArchiveWithTimer(id: string) {
    stopTimerForTask(id);
    archiveTask(id);
  }

  const activeTasks = useMemo(() => excludeArchivedTasks(tasks), [tasks]);

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

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">
              <ListTodo className="mr-2 h-4 w-4" />
              All Tasks
            </TabsTrigger>
            <TabsTrigger value="today">
              <CalendarCheck className="mr-2 h-4 w-4" />
              Today
            </TabsTrigger>
            <TabsTrigger value="archived">
              <Archive className="mr-2 h-4 w-4" />
              Archived
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {activeTasks.length === 0 ? (
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
                tasks={activeTasks}
                onReorder={reorderTasks}
                onToggle={handleToggleWithTimer}
                onDelete={handleDeleteWithTimer}
                onEdit={handleEdit}
                onAddSubtask={handleAddSubtask}
                onArchive={handleArchiveWithTimer}
                onFastForward={fastForwardTask}
                activeTimerId={activeTimerId}
                currentElapsedMs={currentElapsedMs}
                onStartTimer={startTimer}
                onPauseTimer={pauseTimer}
              />
            )}
          </TabsContent>

          <TabsContent value="today">
            <TodayList
              tasks={tasks}
              onToggle={handleToggleWithTimer}
              onDelete={handleDeleteWithTimer}
              onEdit={handleEdit}
              onArchive={handleArchiveWithTimer}
              onFastForward={fastForwardTask}
              onSkipToday={skipTodayTask}
              activeTimerId={activeTimerId}
              currentElapsedMs={currentElapsedMs}
              onStartTimer={startTimer}
              onPauseTimer={pauseTimer}
            />
          </TabsContent>

          <TabsContent value="archived">
            <ArchivedList
              tasks={tasks}
              onUnarchive={unarchiveTask}
              onDelete={handleDeleteWithTimer}
            />
          </TabsContent>
        </Tabs>

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

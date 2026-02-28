"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Task, Priority, RecurrencePattern, CompletionRecord } from "@/lib/types";
import { removeItem, findItemDeep } from "@/lib/tree-utils";
import { isTaskBlocked } from "@/lib/dependency-utils";
import { getNextDueDate, fastForwardDueDate } from "@/lib/recurrence-utils";
import { LOCAL_STORAGE_KEY } from "@/lib/constants";
import { migrateTask, removeDependencyRef, resetChildrenDeep, setArchivedOnTask } from "@/lib/task-store-utils";

export function useTaskStore() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const isLoadingFromStorage = useRef(true);

  // Persist changes — declared before the load effect so it runs first
  // and correctly skips while isLoadingFromStorage is true
  useEffect(() => {
    if (isLoadingFromStorage.current) return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Load from localStorage after hydration to avoid SSR mismatch.
  // The lazy initializer pattern causes hydration errors because the server
  // returns [] while the client reads stored tasks, producing different DOM.
  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTasks((JSON.parse(stored) as Task[]).map(migrateTask));
      } catch { /* corrupt data, start fresh */ }
    }
    isLoadingFromStorage.current = false;
  }, []);

  const addTask = useCallback(
    (
      title: string,
      priority: Priority,
      dueDate: string | null,
      scheduledDate: string | null,
      startDate: string | null,
      parentId: string | null,
      recurrence?: RecurrencePattern,
      tags?: string[],
      listId?: string,
      dependsOn?: string[],
      timeEstimateMs?: number | null
    ) => {
      // Recurring tasks must have a due date
      if (recurrence && !dueDate) {
        recurrence = undefined;
      }

      const newTask: Task = {
        id: uuidv4(),
        title,
        completed: false,
        priority,
        dueDate,
        scheduledDate,
        startDate,
        completedDate: null,
        createdDate: new Date().toISOString(),
        children: [],
        recurrence,
        completionHistory: recurrence ? [] : undefined,
        timeInvestedMs: 0,
        timeEstimateMs: timeEstimateMs ?? null,
        archived: false,
        tags,
        listId,
        dependsOn,
      };

      if (parentId === null) {
        setTasks((prev) => [...prev, newTask]);
      } else {
        setTasks((prev) => {
          const addToParent = (items: Task[]): Task[] =>
            items.map((item) => {
              if (item.id === parentId) {
                return { ...item, children: [...item.children, newTask] };
              }
              if (item.children.length > 0) {
                return { ...item, children: addToParent(item.children) };
              }
              return item;
            });
          return addToParent(prev);
        });
      }
    },
    []
  );

  const updateTask = useCallback(
    (id: string, updates: Partial<Omit<Task, "id" | "children">>) => {
      setTasks((prev) => {
        const update = (items: Task[]): Task[] =>
          items.map((item) => {
            if (item.id === id) {
              const updated = { ...item, ...updates };
              // Initialize completionHistory when adding recurrence
              if (updated.recurrence && !updated.completionHistory) {
                updated.completionHistory = [];
              }
              // Clean up completionHistory when removing recurrence
              if (!updated.recurrence) {
                delete updated.completionHistory;
              }
              return updated;
            }
            if (item.children.length > 0)
              return { ...item, children: update(item.children) };
            return item;
          });
        return update(prev);
      });
    },
    []
  );

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => removeDependencyRef(removeItem(prev, id), id));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => {
      const task = findItemDeep(prev, id);
      if (!task) return prev;
      const newCompleted = !task.completed;

      // Defense-in-depth: prevent completing a blocked task
      if (newCompleted && isTaskBlocked(prev, task)) return prev;

      // Recurring task: reset in place with advanced due date
      if (newCompleted && task.recurrence && task.dueDate) {
        const nextDue = getNextDueDate(task.dueDate, task.recurrence);
        const now = new Date().toISOString();
        const update = (items: Task[]): Task[] =>
          items.map((item) => {
            if (item.id === id) {
              return {
                ...item,
                completed: false,
                dueDate: nextDue,
                completedDate: null,
                timeInvestedMs: 0,
                children: resetChildrenDeep(item.children),
                completionHistory: [...(item.completionHistory || []), {
                  scheduledDate: item.scheduledDate,
                  dueDate: item.dueDate!,
                  completedAt: now,
                  timeInvestedMs: item.timeInvestedMs,
                } as CompletionRecord],
              };
            }
            if (item.children.length > 0)
              return { ...item, children: update(item.children) };
            return item;
          });
        return update(prev);
      }

      // Normal toggle
      const now = new Date().toISOString();
      const update = (items: Task[]): Task[] =>
        items.map((item) => {
          if (item.id === id) {
            // Record completion immediately if this task tracks history
            // (i.e. it's a subtask of a recurring parent that has been
            // through at least one cycle, so completionHistory is initialised).
            const newHistory =
              newCompleted && Array.isArray(item.completionHistory)
                ? [...item.completionHistory, {
                    scheduledDate: item.scheduledDate,
                    dueDate: item.dueDate,
                    completedAt: now,
                    timeInvestedMs: item.timeInvestedMs,
                  } as CompletionRecord]
                : item.completionHistory;

            return {
              ...item,
              completed: newCompleted,
              completedDate: newCompleted ? now : null,
              completionHistory: newHistory,
            };
          }
          if (item.children.length > 0)
            return { ...item, children: update(item.children) };
          return item;
        });
      return update(prev);
    });
  }, []);

  const restoreTasks = useCallback((snapshot: Task[]) => {
    setTasks(snapshot);
  }, []);

  const reorderTasks = useCallback((reorderedActiveTasks: Task[]) => {
    setTasks((prev) => {
      // Collect archived tasks from previous state, keyed by parent ID.
      // excludeArchivedTasks strips these at every level before handing
      // the tree to TaskTree, so we must reinsert them after reorder.
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
      collectArchived(prev, null);

      function reinsert(items: Task[], parentId: string | null): Task[] {
        const result = items.map((item) => ({
          ...item,
          children: reinsert(item.children, item.id),
        }));
        const archived = archivedByParent.get(parentId);
        if (archived) result.push(...archived);
        return result;
      }

      return reinsert(reorderedActiveTasks, null);
    });
  }, []);

  const archiveTask = useCallback((id: string) => {
    setTasks((prev) => setArchivedOnTask(prev, id, true));
  }, []);

  const unarchiveTask = useCallback((id: string) => {
    setTasks((prev) => setArchivedOnTask(prev, id, false));
  }, []);

  const fastForwardTask = useCallback((id: string) => {
    setTasks((prev) => {
      const task = findItemDeep(prev, id);
      if (!task || !task.recurrence || !task.dueDate) return prev;

      // Calculate the next due date >= today
      const nextDue = fastForwardDueDate(task.dueDate, task.recurrence);

      // Update the task with the new due date
      const update = (items: Task[]): Task[] =>
        items.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              dueDate: nextDue,
              children: resetChildrenDeep(item.children),
            };
          }
          if (item.children.length > 0)
            return { ...item, children: update(item.children) };
          return item;
        });
      return update(prev);
    });
  }, []);

  const skipTodayTask = useCallback((id: string) => {
    setTasks((prev) => {
      const task = findItemDeep(prev, id);
      if (!task) return prev;

      const pad = (n: number) => String(n).padStart(2, "0");
      const localDateStr = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const todayStr = localDateStr(new Date());
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = localDateStr(tomorrow);

      const dueShouldSkip =
        task.dueDate && task.dueDate.split("T")[0] <= todayStr;
      const scheduledShouldSkip =
        task.scheduledDate && task.scheduledDate.split("T")[0] <= todayStr;

      if (!dueShouldSkip && !scheduledShouldSkip) return prev;

      const update = (items: Task[]): Task[] =>
        items.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              ...(dueShouldSkip && { dueDate: tomorrowStr }),
              ...(scheduledShouldSkip && { scheduledDate: tomorrowStr }),
            };
          }
          if (item.children.length > 0)
            return { ...item, children: update(item.children) };
          return item;
        });
      return update(prev);
    });
  }, []);

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    restoreTasks,
    archiveTask,
    unarchiveTask,
    fastForwardTask,
    skipTodayTask,
  };
}

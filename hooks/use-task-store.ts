"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Task, Priority, RecurrencePattern } from "@/lib/types";
import { removeItem, findItemDeep } from "@/lib/tree-utils";
import { getNextDueDate } from "@/lib/recurrence-utils";
import { LOCAL_STORAGE_KEY } from "@/lib/constants";

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
        setTasks(JSON.parse(stored));
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
      parentId: string | null,
      recurrence?: RecurrencePattern
    ) => {
      // Recurring tasks must have a due date and cannot be subtasks
      if (recurrence && (!dueDate || parentId !== null)) {
        recurrence = undefined;
      }

      const newTask: Task = {
        id: uuidv4(),
        title,
        completed: false,
        priority,
        dueDate,
        scheduledDate,
        completedDate: null,
        createdDate: new Date().toISOString(),
        children: [],
        recurrence,
        completionHistory: recurrence ? [] : undefined,
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
    setTasks((prev) => removeItem(prev, id));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => {
      const task = findItemDeep(prev, id);
      if (!task) return prev;
      const newCompleted = !task.completed;

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
                completionHistory: [...(item.completionHistory || []), now],
              };
            }
            if (item.children.length > 0)
              return { ...item, children: update(item.children) };
            return item;
          });
        return update(prev);
      }

      // Normal toggle
      const update = (items: Task[]): Task[] =>
        items.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              completed: newCompleted,
              completedDate: newCompleted ? new Date().toISOString() : null,
            };
          }
          if (item.children.length > 0)
            return { ...item, children: update(item.children) };
          return item;
        });
      return update(prev);
    });
  }, []);

  const reorderTasks = useCallback((newTasks: Task[]) => {
    setTasks(newTasks);
  }, []);

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    reorderTasks,
  };
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Task, Priority } from "@/lib/types";
import { removeItem, findItemDeep } from "@/lib/tree-utils";
import { LOCAL_STORAGE_KEY } from "@/lib/constants";

function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function useTaskStore() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const isInitialMount = useRef(true);

  // Persist on every change after initial mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const addTask = useCallback(
    (
      title: string,
      priority: Priority,
      dueDate: string | null,
      scheduledDate: string | null,
      parentId: string | null
    ) => {
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
            if (item.id === id) return { ...item, ...updates };
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

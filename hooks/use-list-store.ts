"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { TaskList, TagColor } from "@/lib/types";
import { LISTS_STORAGE_KEY } from "@/lib/constants";

export function useListStore() {
  const [lists, setLists] = useState<TaskList[]>([]);
  const isLoadingFromStorage = useRef(true);

  useEffect(() => {
    if (isLoadingFromStorage.current) return;
    localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(lists));
  }, [lists]);

  useEffect(() => {
    const stored = localStorage.getItem(LISTS_STORAGE_KEY);
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLists(JSON.parse(stored) as TaskList[]);
      } catch {
        /* corrupt data, start fresh */
      }
    }
    isLoadingFromStorage.current = false;
  }, []);

  const addList = useCallback((name: string, color: TagColor) => {
    const newList: TaskList = {
      id: uuidv4(),
      name,
      color,
      createdDate: new Date().toISOString(),
    };
    setLists((prev) => [...prev, newList]);
    return newList;
  }, []);

  const updateList = useCallback(
    (id: string, updates: Partial<Omit<TaskList, "id" | "createdDate">>) => {
      setLists((prev) =>
        prev.map((list) => (list.id === id ? { ...list, ...updates } : list))
      );
    },
    []
  );

  const deleteList = useCallback((id: string) => {
    setLists((prev) => prev.filter((list) => list.id !== id));
  }, []);

  const restoreLists = useCallback((snapshot: TaskList[]) => {
    setLists(snapshot);
  }, []);

  return { lists, addList, updateList, deleteList, restoreLists };
}

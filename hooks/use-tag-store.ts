"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Tag, TagColor } from "@/lib/types";
import { TAGS_STORAGE_KEY } from "@/lib/constants";
import { syncService } from "@/lib/sync-service";

export function useTagStore() {
  const [tags, setTags] = useState<Tag[]>([]);
  const isLoadingFromStorage = useRef(true);

  useEffect(() => {
    if (isLoadingFromStorage.current) return;
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
  }, [tags]);

  useEffect(() => {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Tag[];
        // Migrate legacy tags: default missing listIds to []
        const migrated = parsed.map((tag) => ({
          ...tag,
          listIds: tag.listIds ?? [],
        }));
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTags(migrated);
      } catch {
        /* corrupt data, start fresh */
      }
    }
    isLoadingFromStorage.current = false;
  }, []);

  const addTag = useCallback((name: string, color: TagColor, listIds: string[] = []) => {
    const newTag: Tag = { id: uuidv4(), name, color, listIds };
    setTags((prev) => [...prev, newTag]);
    syncService.enqueueTagUpsert([newTag]);
    return newTag;
  }, []);

  const updateTag = useCallback(
    (id: string, updates: Partial<Omit<Tag, "id">>) => {
      setTags((prev) => {
        const newTags = prev.map((tag) => (tag.id === id ? { ...tag, ...updates } : tag));
        const updatedTag = newTags.find((t) => t.id === id);
        if (updatedTag) syncService.enqueueTagUpsert([updatedTag]);
        return newTags;
      });
    },
    []
  );

  const deleteTag = useCallback((id: string) => {
    setTags((prev) => prev.filter((tag) => tag.id !== id));
    syncService.enqueueTagDelete([id]);
  }, []);

  const removeListFromTags = useCallback((listId: string) => {
    setTags((prev) => {
      const newTags = prev.map((tag) =>
        tag.listIds.includes(listId)
          ? { ...tag, listIds: tag.listIds.filter((id) => id !== listId) }
          : tag
      );
      const changedTags = newTags.filter((tag) =>
        prev.find((t) => t.id === tag.id)?.listIds.includes(listId)
      );
      if (changedTags.length > 0) syncService.enqueueTagUpsert(changedTags);
      return newTags;
    });
  }, []);

  const restoreTags = useCallback((snapshot: Tag[]) => {
    setTags(snapshot);
  }, []);

  return { tags, addTag, updateTag, deleteTag, removeListFromTags, restoreTags };
}

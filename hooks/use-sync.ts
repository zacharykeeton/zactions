"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  syncService,
  MigrationConflictError,
  pullResponseToTasks,
  type PullResponse,
} from "@/lib/sync-service";
import type { Task, Tag, TaskList } from "@/lib/types";

interface UseSyncOptions {
  tasks: Task[];
  tags: Tag[];
  lists: TaskList[];
  restoreTasks: (tasks: Task[]) => void;
  restoreTags: (tags: Tag[]) => void;
  restoreLists: (lists: TaskList[]) => void;
}

export function useSync({
  tasks,
  tags,
  lists,
  restoreTasks,
  restoreTags,
  restoreLists,
}: UseSyncOptions) {
  const { isSignedIn, userId } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  // Capture latest state in refs so callbacks don't go stale
  const tasksRef = useRef(tasks);
  const tagsRef = useRef(tags);
  const listsRef = useRef(lists);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { tagsRef.current = tags; }, [tags]);
  useEffect(() => { listsRef.current = lists; }, [lists]);

  const applyPullData = useCallback(
    (data: PullResponse) => {
      if (data.tasks.length > 0) {
        // Filter out deleted tasks for full replacement
        const activeTasks = data.tasks.filter((t) => !("deletedAt" in t) || !t.deletedAt);
        const tree = pullResponseToTasks({ ...data, tasks: activeTasks });
        restoreTasks(tree);
      }

      if (data.tags.length > 0) {
        const activeTags = data.tags.filter((t) => !t.deletedAt);
        restoreTags(
          activeTags.map((t) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            listIds: t.listIds,
          }))
        );
      }

      if (data.lists.length > 0) {
        const activeLists = data.lists.filter((l) => !l.deletedAt);
        restoreLists(
          activeLists.map((l) => ({
            id: l.id,
            name: l.name,
            color: l.color,
            createdDate: l.createdDate,
          }))
        );
      }
    },
    [restoreTasks, restoreTags, restoreLists]
  );

  // Initialize sync when auth state changes
  useEffect(() => {
    if (!isSignedIn || !userId) {
      syncService.reset();
      initializedRef.current = false;
      return;
    }

    if (initializedRef.current) return;
    initializedRef.current = true;

    syncService.init(userId);

    // Handle first-auth migration
    async function handleMigration() {
      if (syncService.getMigratedFlag()) {
        // Already migrated — just pull latest
        setIsSyncing(true);
        const data = await syncService.fullPull();
        if (data && (data.tasks.length > 0 || data.tags.length > 0 || data.lists.length > 0)) {
          applyPullData(data);
        }
        setIsSyncing(false);
        return;
      }

      setIsSyncing(true);
      try {
        // Check if server already has data
        const serverData = await syncService.fullPull();

        if (
          serverData &&
          (serverData.tasks.length > 0 ||
            serverData.tags.length > 0 ||
            serverData.lists.length > 0)
        ) {
          // Server has data — use it, don't upload local
          applyPullData(serverData);
          syncService.setMigratedFlag();
        } else {
          // Server is empty — upload local data
          try {
            await syncService.migrateLocalData(
              tasksRef.current,
              tagsRef.current,
              listsRef.current
            );
            syncService.setMigratedFlag();
          } catch (err) {
            if (err instanceof MigrationConflictError) {
              // Race condition — server got data between pull and migrate
              const data = await syncService.fullPull();
              if (data) applyPullData(data);
              syncService.setMigratedFlag();
            } else {
              setSyncError("Failed to sync local data to server");
            }
          }
        }
      } catch {
        setSyncError("Failed to connect to sync server");
      }
      setIsSyncing(false);
    }

    handleMigration();
  }, [isSignedIn, userId, applyPullData]);

  // Pull on tab focus
  useEffect(() => {
    if (!isSignedIn || !userId) return;

    async function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (!syncService.isInitialized()) return;

      // Flush pending mutations first
      await syncService.flush();

      // Then pull latest
      const data = await syncService.pull();
      if (data && (data.tasks.length > 0 || data.tags.length > 0 || data.lists.length > 0)) {
        applyPullData(data);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSignedIn, userId, applyPullData]);

  const clearError = useCallback(() => setSyncError(null), []);

  return {
    isSyncing,
    syncError,
    clearError,
    isSignedIn: isSignedIn ?? false,
  };
}

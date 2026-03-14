import type { Task, Tag, TaskList } from "./types";
import { flattenTasksForSync, buildTaskTreeFromRows, type FlatTaskRow } from "./sync-tree-utils";

const QUEUE_KEY = "sync-mutation-queue";
const LAST_PULL_KEY = "sync-last-pull-time";
const MIGRATED_KEY_PREFIX = "sync-migrated-";

// ── Mutation queue types ────────────────────────────────────────────────────

interface TaskUpsertMutation {
  type: "task";
  action: "upsert";
  rows: FlatTaskRow[];
}

interface TaskDeleteMutation {
  type: "task";
  action: "delete";
  ids: string[];
}

interface TagUpsertMutation {
  type: "tag";
  action: "upsert";
  tags: Tag[];
}

interface TagDeleteMutation {
  type: "tag";
  action: "delete";
  ids: string[];
}

interface ListUpsertMutation {
  type: "list";
  action: "upsert";
  lists: TaskList[];
}

interface ListDeleteMutation {
  type: "list";
  action: "delete";
  ids: string[];
}

type SyncMutation =
  | TaskUpsertMutation
  | TaskDeleteMutation
  | TagUpsertMutation
  | TagDeleteMutation
  | ListUpsertMutation
  | ListDeleteMutation;

// ── Pull response ───────────────────────────────────────────────────────────

export interface PullResponse {
  tasks: FlatTaskRow[];
  tags: (Tag & { deletedAt?: string | null })[];
  lists: (TaskList & { deletedAt?: string | null })[];
  serverTime: string;
}

// ── SyncService singleton ───────────────────────────────────────────────────

class SyncService {
  private userId: string | null = null;
  private queue: SyncMutation[] = [];
  private flushing = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  init(userId: string) {
    this.userId = userId;
    this.loadQueue();
    // Flush any queued mutations from a previous session
    this.flush();
  }

  reset() {
    this.userId = null;
    this.queue = [];
    this.flushing = false;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  isInitialized(): boolean {
    return this.userId !== null;
  }

  // ── Migration ───────────────────────────────────────────────────────

  getMigratedFlag(): boolean {
    if (!this.userId) return false;
    return localStorage.getItem(MIGRATED_KEY_PREFIX + this.userId) === "true";
  }

  setMigratedFlag() {
    if (!this.userId) return;
    localStorage.setItem(MIGRATED_KEY_PREFIX + this.userId, "true");
  }

  async migrateLocalData(
    tasks: Task[],
    tags: Tag[],
    lists: TaskList[]
  ): Promise<{ serverTime: string }> {
    const res = await fetch("/api/sync/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks, tags, lists }),
    });

    if (res.status === 409) {
      // User already has data on server — not an error, just skip migration
      throw new MigrationConflictError();
    }

    if (!res.ok) {
      throw new Error(`Migration failed: ${res.status}`);
    }

    return res.json();
  }

  // ── Mutations ─────────────────────────────────────────────────────

  enqueueMutation(mutation: SyncMutation) {
    if (!this.userId) return;
    this.queue.push(mutation);
    this.saveQueue();
    this.flush();
  }

  // Convenience: enqueue a task upsert from a nested Task tree
  enqueueTaskUpsert(tasks: Task[]) {
    const rows = flattenTasksForSync(tasks);
    this.enqueueMutation({ type: "task", action: "upsert", rows });
  }

  enqueueTaskDelete(ids: string[]) {
    this.enqueueMutation({ type: "task", action: "delete", ids });
  }

  enqueueTagUpsert(tags: Tag[]) {
    this.enqueueMutation({ type: "tag", action: "upsert", tags });
  }

  enqueueTagDelete(ids: string[]) {
    this.enqueueMutation({ type: "tag", action: "delete", ids });
  }

  enqueueListUpsert(lists: TaskList[]) {
    this.enqueueMutation({ type: "list", action: "upsert", lists });
  }

  enqueueListDelete(ids: string[]) {
    this.enqueueMutation({ type: "list", action: "delete", ids });
  }

  // ── Flush ─────────────────────────────────────────────────────────

  async flush(): Promise<boolean> {
    if (this.flushing || this.queue.length === 0 || !this.userId) return true;
    this.flushing = true;

    try {
      const batch = this.buildBatch();
      const res = await fetch("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });

      if (res.status === 401) {
        // Session expired — keep queue, don't retry aggressively
        this.flushing = false;
        return false;
      }

      if (!res.ok) {
        throw new Error(`Push failed: ${res.status}`);
      }

      // Success — clear queue
      this.queue = [];
      this.saveQueue();
      this.flushing = false;
      return true;
    } catch {
      // Network error or server error — retry with backoff
      this.flushing = false;
      this.scheduleRetry();
      return false;
    }
  }

  private buildBatch() {
    const batch: {
      tasks?: { upsert?: FlatTaskRow[]; delete?: string[] };
      tags?: { upsert?: Tag[]; delete?: string[] };
      lists?: { upsert?: TaskList[]; delete?: string[] };
    } = {};

    const taskUpserts: FlatTaskRow[] = [];
    const taskDeletes: string[] = [];
    const tagUpserts: Tag[] = [];
    const tagDeletes: string[] = [];
    const listUpserts: TaskList[] = [];
    const listDeletes: string[] = [];

    for (const mutation of this.queue) {
      switch (mutation.type) {
        case "task":
          if (mutation.action === "upsert") taskUpserts.push(...mutation.rows);
          else taskDeletes.push(...mutation.ids);
          break;
        case "tag":
          if (mutation.action === "upsert") tagUpserts.push(...mutation.tags);
          else tagDeletes.push(...mutation.ids);
          break;
        case "list":
          if (mutation.action === "upsert") listUpserts.push(...mutation.lists);
          else listDeletes.push(...mutation.ids);
          break;
      }
    }

    // Deduplicate upserts by id (last write wins)
    const dedupeTaskUpserts = new Map<string, FlatTaskRow>();
    for (const row of taskUpserts) dedupeTaskUpserts.set(row.id, row);

    const dedupeTagUpserts = new Map<string, Tag>();
    for (const tag of tagUpserts) dedupeTagUpserts.set(tag.id, tag);

    const dedupeListUpserts = new Map<string, TaskList>();
    for (const list of listUpserts) dedupeListUpserts.set(list.id, list);

    if (dedupeTaskUpserts.size > 0 || taskDeletes.length > 0) {
      batch.tasks = {};
      if (dedupeTaskUpserts.size > 0) batch.tasks.upsert = [...dedupeTaskUpserts.values()];
      if (taskDeletes.length > 0) batch.tasks.delete = [...new Set(taskDeletes)];
    }
    if (dedupeTagUpserts.size > 0 || tagDeletes.length > 0) {
      batch.tags = {};
      if (dedupeTagUpserts.size > 0) batch.tags.upsert = [...dedupeTagUpserts.values()];
      if (tagDeletes.length > 0) batch.tags.delete = [...new Set(tagDeletes)];
    }
    if (dedupeListUpserts.size > 0 || listDeletes.length > 0) {
      batch.lists = {};
      if (dedupeListUpserts.size > 0) batch.lists.upsert = [...dedupeListUpserts.values()];
      if (listDeletes.length > 0) batch.lists.delete = [...new Set(listDeletes)];
    }

    return batch;
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.flush();
    }, 5000);
  }

  // ── Pull ──────────────────────────────────────────────────────────

  async pull(since?: string): Promise<PullResponse | null> {
    if (!this.userId) return null;

    const sinceParam = since ?? this.getLastPullTime();
    const url = sinceParam
      ? `/api/sync/pull?since=${encodeURIComponent(sinceParam)}`
      : "/api/sync/pull";

    try {
      const res = await fetch(url);

      if (res.status === 401) return null;
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);

      const data: PullResponse = await res.json();
      this.setLastPullTime(data.serverTime);
      return data;
    } catch {
      return null;
    }
  }

  async fullPull(): Promise<PullResponse | null> {
    return this.pull(undefined);
  }

  getLastPullTime(): string | null {
    return localStorage.getItem(LAST_PULL_KEY);
  }

  private setLastPullTime(time: string) {
    localStorage.setItem(LAST_PULL_KEY, time);
  }

  // ── Queue persistence ─────────────────────────────────────────────

  private loadQueue() {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) this.queue = JSON.parse(stored);
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
  }
}

export class MigrationConflictError extends Error {
  constructor() {
    super("Migration conflict: user already has server data");
    this.name = "MigrationConflictError";
  }
}

// Convenience: convert PullResponse tasks to client Task tree
export function pullResponseToTasks(data: PullResponse): Task[] {
  return buildTaskTreeFromRows(data.tasks);
}

// Singleton export
export const syncService = new SyncService();

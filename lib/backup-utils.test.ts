import { describe, it, expect } from "vitest";
import { createBackupData, parseBackupFile } from "./backup-utils";
import { BACKUP_VERSION } from "./constants";
import type { Task, TaskList, Tag, BackupData } from "./types";

const sampleTask: Task = {
  id: "task-1",
  title: "Test task",
  completed: false,
  priority: "medium",
  dueDate: null,
  scheduledDate: null,
  startDate: null,
  completedDate: null,
  createdDate: "2026-01-01T00:00:00.000Z",
  children: [],
  timeInvestedMs: 0,
  archived: false,
};

const sampleList: TaskList = {
  id: "list-1",
  name: "Work",
  color: "blue",
  createdDate: "2026-01-01T00:00:00.000Z",
};

const sampleTag: Tag = {
  id: "tag-1",
  name: "urgent",
  color: "red",
  listIds: [],
};

function makeFile(content: string, name = "backup.json"): File {
  return new File([content], name, { type: "application/json" });
}

function makeValidBackup(overrides?: Partial<BackupData>): BackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tasks: [sampleTask],
    lists: [sampleList],
    tags: [sampleTag],
    ...overrides,
  };
}

describe("createBackupData", () => {
  it("includes tasks, lists, tags, and preferences in output", () => {
    const prefs = { activeListId: "list-1" };
    const result = createBackupData([sampleTask], [sampleList], [sampleTag], prefs);

    expect(result.tasks).toEqual([sampleTask]);
    expect(result.lists).toEqual([sampleList]);
    expect(result.tags).toEqual([sampleTag]);
    expect(result.preferences).toEqual(prefs);
  });

  it("sets version to current backup version", () => {
    const result = createBackupData([], [], []);
    expect(result.version).toBe(BACKUP_VERSION);
  });

  it("sets exportedAt to a valid ISO timestamp", () => {
    const before = new Date().toISOString();
    const result = createBackupData([], [], []);
    const after = new Date().toISOString();

    expect(result.exportedAt).toBeTruthy();
    expect(result.exportedAt >= before).toBe(true);
    expect(result.exportedAt <= after).toBe(true);
    // Verify it's a valid date
    expect(new Date(result.exportedAt).toISOString()).toBe(result.exportedAt);
  });

  it("handles empty data (no tasks, no lists, no tags)", () => {
    const result = createBackupData([], [], []);

    expect(result.tasks).toEqual([]);
    expect(result.lists).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(result.version).toBe(BACKUP_VERSION);
  });
});

describe("parseBackupFile", () => {
  it("parses a valid backup JSON file and returns typed BackupData", async () => {
    const backup = makeValidBackup();
    const file = makeFile(JSON.stringify(backup));
    const result = await parseBackupFile(file);

    expect(result.version).toBe(BACKUP_VERSION);
    expect(result.tasks).toEqual([sampleTask]);
    expect(result.lists).toEqual([sampleList]);
    expect(result.tags).toEqual([sampleTag]);
  });

  it("rejects non-JSON files", async () => {
    const file = makeFile("this is not json");
    await expect(parseBackupFile(file)).rejects.toThrow("Invalid JSON file");
  });

  it("rejects JSON missing the version field", async () => {
    const file = makeFile(JSON.stringify({ tasks: [], lists: [], tags: [] }));
    await expect(parseBackupFile(file)).rejects.toThrow("Missing or invalid version field");
  });

  it("rejects JSON missing required top-level keys (tasks)", async () => {
    const file = makeFile(JSON.stringify({ version: 1, lists: [], tags: [] }));
    await expect(parseBackupFile(file)).rejects.toThrow("Missing or invalid tasks field");
  });

  it("rejects JSON missing required top-level keys (lists)", async () => {
    const file = makeFile(JSON.stringify({ version: 1, tasks: [], tags: [] }));
    await expect(parseBackupFile(file)).rejects.toThrow("Missing or invalid lists field");
  });

  it("rejects JSON missing required top-level keys (tags)", async () => {
    const file = makeFile(JSON.stringify({ version: 1, tasks: [], lists: [] }));
    await expect(parseBackupFile(file)).rejects.toThrow("Missing or invalid tags field");
  });

  it("migrates legacy tags without listIds to have listIds: []", async () => {
    const legacyTag = { id: "tag-1", name: "urgent", color: "red" };
    const backup = makeValidBackup({ tags: [legacyTag as Tag] });
    const file = makeFile(JSON.stringify(backup));
    const result = await parseBackupFile(file);

    expect(result.tags[0].listIds).toEqual([]);
  });

  it("preserves existing listIds on tags", async () => {
    const scopedTag: Tag = { id: "tag-2", name: "work", color: "blue", listIds: ["list-1"] };
    const backup = makeValidBackup({ tags: [scopedTag] });
    const file = makeFile(JSON.stringify(backup));
    const result = await parseBackupFile(file);

    expect(result.tags[0].listIds).toEqual(["list-1"]);
  });

  it("accepts backup with missing preferences (optional)", async () => {
    const backup = makeValidBackup();
    delete (backup as unknown as Record<string, unknown>).preferences;
    const file = makeFile(JSON.stringify(backup));
    const result = await parseBackupFile(file);

    expect(result.preferences).toBeUndefined();
    expect(result.tasks).toEqual([sampleTask]);
  });
});

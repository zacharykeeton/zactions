import { format } from "date-fns";
import type { BackupData, BackupPreferences, Task, TaskList, Tag } from "./types";
import {
  BACKUP_VERSION,
  ACTIVE_LIST_KEY,
  TODAY_SORT_ORDER_KEY,
  TOMORROW_SORT_ORDER_KEY,
  COLLAPSED_TASKS_KEY,
  TODAY_RECURRING_SECTION_KEY,
  TODAY_NON_RECURRING_SECTION_KEY,
  TOMORROW_RECURRING_SECTION_KEY,
  TOMORROW_NON_RECURRING_SECTION_KEY,
  TODAY_OPTIONAL_SECTION_KEY,
  TOMORROW_OPTIONAL_SECTION_KEY,
} from "./constants";

export function createBackupData(
  tasks: Task[],
  lists: TaskList[],
  tags: Tag[],
  preferences?: BackupPreferences
): BackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
    lists,
    tags,
    preferences,
  };
}

export function gatherPreferences(): BackupPreferences {
  const prefs: BackupPreferences = {};

  const activeListId = localStorage.getItem(ACTIVE_LIST_KEY);
  if (activeListId) prefs.activeListId = activeListId;

  const todaySortOrder = localStorage.getItem(TODAY_SORT_ORDER_KEY);
  if (todaySortOrder) {
    try {
      prefs.todaySortOrder = JSON.parse(todaySortOrder);
    } catch {
      /* ignore corrupt */
    }
  }

  const tomorrowSortOrder = localStorage.getItem(TOMORROW_SORT_ORDER_KEY);
  if (tomorrowSortOrder) {
    try {
      prefs.tomorrowSortOrder = JSON.parse(tomorrowSortOrder);
    } catch {
      /* ignore corrupt */
    }
  }

  const collapsedTaskIds = localStorage.getItem(COLLAPSED_TASKS_KEY);
  if (collapsedTaskIds) {
    try {
      prefs.collapsedTaskIds = JSON.parse(collapsedTaskIds);
    } catch {
      /* ignore corrupt */
    }
  }

  const sectionKeys = [
    [TODAY_RECURRING_SECTION_KEY, "todayRecurringSectionOpen"],
    [TODAY_NON_RECURRING_SECTION_KEY, "todayNonRecurringSectionOpen"],
    [TOMORROW_RECURRING_SECTION_KEY, "tomorrowRecurringSectionOpen"],
    [TOMORROW_NON_RECURRING_SECTION_KEY, "tomorrowNonRecurringSectionOpen"],
    [TODAY_OPTIONAL_SECTION_KEY, "todayOptionalSectionOpen"],
    [TOMORROW_OPTIONAL_SECTION_KEY, "tomorrowOptionalSectionOpen"],
  ] as const;

  for (const [storageKey, prefKey] of sectionKeys) {
    const val = localStorage.getItem(storageKey);
    if (val !== null) {
      prefs[prefKey] = val === "true";
    }
  }

  return prefs;
}

export function restorePreferences(preferences: BackupPreferences): void {
  if (preferences.activeListId !== undefined) {
    localStorage.setItem(ACTIVE_LIST_KEY, preferences.activeListId);
  }
  if (preferences.todaySortOrder !== undefined) {
    localStorage.setItem(TODAY_SORT_ORDER_KEY, JSON.stringify(preferences.todaySortOrder));
  }
  if (preferences.tomorrowSortOrder !== undefined) {
    localStorage.setItem(TOMORROW_SORT_ORDER_KEY, JSON.stringify(preferences.tomorrowSortOrder));
  }
  if (preferences.collapsedTaskIds !== undefined) {
    localStorage.setItem(COLLAPSED_TASKS_KEY, JSON.stringify(preferences.collapsedTaskIds));
  }

  const sectionKeys = [
    [TODAY_RECURRING_SECTION_KEY, "todayRecurringSectionOpen"],
    [TODAY_NON_RECURRING_SECTION_KEY, "todayNonRecurringSectionOpen"],
    [TOMORROW_RECURRING_SECTION_KEY, "tomorrowRecurringSectionOpen"],
    [TOMORROW_NON_RECURRING_SECTION_KEY, "tomorrowNonRecurringSectionOpen"],
    [TODAY_OPTIONAL_SECTION_KEY, "todayOptionalSectionOpen"],
    [TOMORROW_OPTIONAL_SECTION_KEY, "tomorrowOptionalSectionOpen"],
  ] as const;

  for (const [storageKey, prefKey] of sectionKeys) {
    if (preferences[prefKey] !== undefined) {
      localStorage.setItem(storageKey, String(preferences[prefKey]));
    }
  }
}

export function downloadBackup(data: BackupData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const filename = `zactions-backup-${format(new Date(), "yyyy-MM-dd")}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function parseBackupFile(file: File): Promise<BackupData> {
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid backup file format");
  }

  const data = parsed as Record<string, unknown>;

  if (typeof data.version !== "number") {
    throw new Error("Missing or invalid version field");
  }

  if (!Array.isArray(data.tasks)) {
    throw new Error("Missing or invalid tasks field");
  }

  if (!Array.isArray(data.lists)) {
    throw new Error("Missing or invalid lists field");
  }

  if (!Array.isArray(data.tags)) {
    throw new Error("Missing or invalid tags field");
  }

  // Migrate legacy tags: default missing listIds to []
  const result = parsed as BackupData;
  result.tags = result.tags.map((tag) => ({
    ...tag,
    listIds: tag.listIds ?? [],
  }));

  return result;
}

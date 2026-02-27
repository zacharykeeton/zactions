import { format } from "date-fns";
import type { Task } from "./types";

/** Escape text per RFC 5545: backslash, semicolons, commas, newlines */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Convert milliseconds to an ICS DURATION value like PT45M or PT1H30M */
export function msToIcsDuration(ms: number): string {
  if (ms <= 0) return "PT0M";
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `PT${hours}H${minutes}M`;
  if (hours > 0) return `PT${hours}H`;
  return `PT${minutes}M`;
}

/** Resolve the event date: scheduledDate -> dueDate -> today */
export function getEventDate(task: Task): string {
  if (task.scheduledDate) return task.scheduledDate;
  if (task.dueDate) return task.dueDate;
  return format(new Date(), "yyyy-MM-dd");
}

/** Map task priority to ICS priority (RFC 5545: 1=high, 5=medium, 9=low) */
function mapPriority(priority: Task["priority"]): number {
  switch (priority) {
    case "high":
      return 1;
    case "medium":
      return 5;
    case "low":
      return 9;
  }
}

/** Strip characters not safe for filenames and truncate */
export function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

/** Generate a full ICS calendar string for a task */
export function generateIcsString(task: Task): string {
  if (task.timeEstimateMs === null) {
    throw new Error("Task must have a time estimate to generate an ICS file");
  }

  const dateStr = getEventDate(task).replace(/-/g, "");
  const dtstart = `${dateStr}T080000`;
  const duration = msToIcsDuration(task.timeEstimateMs);
  const summary = escapeIcsText(task.title);
  const priority = mapPriority(task.priority);
  const uid = `${task.id}@zactions`;
  const dtstamp = format(new Date(), "yyyyMMdd'T'HHmmss");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zactions//Task Export//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DURATION:${duration}`,
    `SUMMARY:${summary}`,
    `PRIORITY:${priority}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}

/** Download an ICS file for a task */
export function downloadTaskIcs(task: Task): void {
  const icsString = generateIcsString(task);
  const blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const filename = `${sanitizeFilename(task.title)}.ics`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

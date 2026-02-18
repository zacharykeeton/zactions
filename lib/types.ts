export type Priority = "low" | "medium" | "high";

export type RecurrenceInterval = "daily" | "weekly" | "monthly" | "yearly";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RecurrencePattern {
  interval: RecurrenceInterval;
  daysOfWeek?: DayOfWeek[];
}

export interface CompletionRecord {
  scheduledDate: string | null;
  dueDate: string | null;
  completedAt: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  dueDate: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  createdDate: string;
  children: Task[];
  recurrence?: RecurrencePattern;
  completionHistory?: CompletionRecord[];
  timeInvestedMs: number;
  archived: boolean;
}

export interface FlattenedTask extends Task {
  parentId: string | null;
  depth: number;
  index: number;
}

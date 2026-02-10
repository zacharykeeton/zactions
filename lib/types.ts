export type Priority = "low" | "medium" | "high";

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
}

export interface FlattenedTask extends Task {
  parentId: string | null;
  depth: number;
  index: number;
}

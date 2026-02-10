"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { Task, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface TaskFormProps {
  initialData?: Task;
  parentId: string | null;
  onSubmit: (data: {
    title: string;
    priority: Priority;
    dueDate: string | null;
    scheduledDate: string | null;
    parentId: string | null;
  }) => void;
  onCancel: () => void;
}

export function TaskForm({
  initialData,
  parentId,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [priority, setPriority] = useState<Priority>(
    initialData?.priority ?? "medium"
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    initialData?.dueDate ? new Date(initialData.dueDate) : undefined
  );
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    initialData?.scheduledDate ? new Date(initialData.scheduledDate) : undefined
  );
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [scheduledDateOpen, setScheduledDateOpen] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      priority,
      dueDate: dueDate ? dueDate.toISOString() : null,
      scheduledDate: scheduledDate ? scheduledDate.toISOString() : null,
      parentId,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title..."
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Due Date</Label>
        <div className="flex gap-2">
          <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dueDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={(date) => {
                  setDueDate(date ?? undefined);
                  setDueDateOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          {dueDate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDueDate(undefined)}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Scheduled Date</Label>
        <div className="flex gap-2">
          <Popover open={scheduledDateOpen} onOpenChange={setScheduledDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !scheduledDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={scheduledDate}
                onSelect={(date) => {
                  setScheduledDate(date ?? undefined);
                  setScheduledDateOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          {scheduledDate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setScheduledDate(undefined)}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          {initialData ? "Save" : "Add Task"}
        </Button>
      </div>
    </form>
  );
}

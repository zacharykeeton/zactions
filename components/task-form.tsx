"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Repeat, X } from "lucide-react";
import type { Task, Priority, RecurrenceInterval, DayOfWeek, RecurrencePattern } from "@/lib/types";
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
import { Checkbox } from "@/components/ui/checkbox";

interface TaskFormProps {
  initialData?: Task;
  parentId: string | null;
  onSubmit: (data: {
    title: string;
    priority: Priority;
    dueDate: string | null;
    scheduledDate: string | null;
    parentId: string | null;
    recurrence?: RecurrencePattern;
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
    initialData?.dueDate ? parseISO(initialData.dueDate) : undefined
  );
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    initialData?.scheduledDate ? parseISO(initialData.scheduledDate) : undefined
  );
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [scheduledDateOpen, setScheduledDateOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(!!initialData?.recurrence);
  const [recurrenceInterval, setRecurrenceInterval] = useState<RecurrenceInterval>(
    initialData?.recurrence?.interval ?? "weekly"
  );
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(
    initialData?.recurrence?.daysOfWeek ?? []
  );

  const isSubtask = parentId !== null;
  const canSubmit = title.trim() && !(isRecurring && !dueDate);

  function toggleDay(day: DayOfWeek) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const recurrence: RecurrencePattern | undefined =
      isRecurring && !isSubtask
        ? {
            interval: recurrenceInterval,
            daysOfWeek:
              recurrenceInterval === "weekly" && selectedDays.length > 0
                ? selectedDays
                : undefined,
          }
        : undefined;

    onSubmit({
      title: title.trim(),
      priority,
      dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      scheduledDate: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : null,
      parentId,
      recurrence,
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
        <div className="relative">
          <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  dueDate && "pr-8",
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
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50 hover:opacity-100"
              onClick={() => setDueDate(undefined)}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {!isSubtask && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="recurring"
              checked={isRecurring}
              onCheckedChange={(checked) => {
                setIsRecurring(!!checked);
                if (!checked) setSelectedDays([]);
              }}
            />
            <Label htmlFor="recurring" className="flex items-center gap-1.5">
              <Repeat className="h-4 w-4" />
              Recurring task
            </Label>
          </div>

          {isRecurring && (
            <div className="flex flex-col gap-3 pl-6">
              <Select
                value={recurrenceInterval}
                onValueChange={(v) => {
                  setRecurrenceInterval(v as RecurrenceInterval);
                  if (v !== "weekly") setSelectedDays([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>

              {recurrenceInterval === "weekly" && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm text-muted-foreground">
                    Repeat on
                  </Label>
                  <div className="flex gap-1">
                    {(
                      [
                        [0, "S"],
                        [1, "M"],
                        [2, "T"],
                        [3, "W"],
                        [4, "T"],
                        [5, "F"],
                        [6, "S"],
                      ] as [DayOfWeek, string][]
                    ).map(([value, label]) => (
                      <Button
                        key={value}
                        type="button"
                        variant={selectedDays.includes(value) ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => toggleDay(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {!dueDate && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  A due date is required for recurring tasks
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>Scheduled Date</Label>
        <div className="relative">
          <Popover open={scheduledDateOpen} onOpenChange={setScheduledDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  scheduledDate && "pr-8",
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
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50 hover:opacity-100"
              onClick={() => setScheduledDate(undefined)}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {initialData ? "Save" : "Add Task"}
        </Button>
      </div>
    </form>
  );
}

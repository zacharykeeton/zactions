"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, CalendarPlus, Check, ChevronsUpDown, Hourglass, Link, Repeat, Timer, X } from "lucide-react";
import type { Task, TaskList, Tag, Priority, RecurrenceInterval, DayOfWeek, RecurrencePattern } from "@/lib/types";
import { TAG_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getTagsForList } from "@/lib/tag-utils";
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
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface TaskFormProps {
  initialData?: Task;
  parentId: string | null;
  availableTags?: Tag[];
  availableLists?: TaskList[];
  availableDependencies?: Task[];
  defaultListId?: string;
  defaultScheduledDate?: string;
  onSubmit: (data: {
    title: string;
    priority: Priority;
    dueDate: string | null;
    scheduledDate: string | null;
    startDate: string | null;
    parentId: string | null;
    recurrence?: RecurrencePattern;
    tags?: string[];
    listId?: string;
    dependsOn?: string[];
    timeEstimateMs?: number | null;
    timeInvestedMs?: number;
  }) => void;
  onCancel: () => void;
}

export function TaskForm({
  initialData,
  parentId,
  availableTags = [],
  availableLists = [],
  availableDependencies = [],
  defaultListId,
  defaultScheduledDate,
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
    initialData?.scheduledDate ? parseISO(initialData.scheduledDate) : defaultScheduledDate ? parseISO(defaultScheduledDate) : undefined
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    initialData?.startDate ? parseISO(initialData.startDate) : undefined
  );
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [scheduledDateOpen, setScheduledDateOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(!!initialData?.recurrence);
  const [recurrenceInterval, setRecurrenceInterval] = useState<RecurrenceInterval>(
    initialData?.recurrence?.interval ?? "weekly"
  );
  const [recurrenceFrequency, setRecurrenceFrequency] = useState(
    initialData?.recurrence?.frequency ?? 1
  );
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(
    initialData?.recurrence?.daysOfWeek ?? []
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialData?.tags ?? []
  );
  const [selectedListId, setSelectedListId] = useState<string>(
    initialData?.listId ?? defaultListId ?? "__inbox__"
  );
  const [selectedDependency, setSelectedDependency] = useState<string | undefined>(
    initialData?.dependsOn?.[0]
  );
  const [depPickerOpen, setDepPickerOpen] = useState(false);

  const [estimateHours, setEstimateHours] = useState(() => {
    if (!initialData?.timeEstimateMs) return "";
    return String(Math.floor(initialData.timeEstimateMs / 3600000));
  });
  const [estimateMinutes, setEstimateMinutes] = useState(() => {
    if (!initialData?.timeEstimateMs) return "";
    return String(Math.round((initialData.timeEstimateMs % 3600000) / 60000));
  });

  const [investedHours, setInvestedHours] = useState(() => {
    if (!initialData?.timeInvestedMs) return "";
    return String(Math.floor(initialData.timeInvestedMs / 3600000));
  });
  const [investedMinutes, setInvestedMinutes] = useState(() => {
    if (!initialData?.timeInvestedMs) return "";
    return String(Math.round((initialData.timeInvestedMs % 3600000) / 60000));
  });

  const isSubtask = parentId !== null;
  const canSubmit = title.trim() && !(isRecurring && !dueDate);

  const filteredTags = useMemo(() => {
    const listId = selectedListId === "__inbox__" ? undefined : selectedListId;
    return getTagsForList(availableTags, listId);
  }, [availableTags, selectedListId]);

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

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
            ...(recurrenceFrequency > 1 ? { frequency: recurrenceFrequency } : {}),
            daysOfWeek:
              recurrenceInterval === "weekly" && selectedDays.length > 0
                ? selectedDays
                : undefined,
          }
        : undefined;

    const h = parseInt(estimateHours, 10) || 0;
    const m = parseInt(estimateMinutes, 10) || 0;
    const totalEstimateMs = (h * 3600000) + (m * 60000);

    const ih = parseInt(investedHours, 10) || 0;
    const im = parseInt(investedMinutes, 10) || 0;
    const totalInvestedMs = (ih * 3600000) + (im * 60000);

    onSubmit({
      title: title.trim(),
      priority,
      dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      scheduledDate: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : null,
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : null,
      parentId,
      recurrence,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      listId: selectedListId === "__inbox__" ? undefined : selectedListId,
      dependsOn: selectedDependency ? [selectedDependency] : undefined,
      timeEstimateMs: totalEstimateMs > 0 ? totalEstimateMs : null,
      timeInvestedMs: totalInvestedMs,
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
        <Label className="flex items-center gap-1.5">
          <Hourglass className="h-4 w-4" />
          Time Estimate
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={99}
            value={estimateHours}
            onChange={(e) => setEstimateHours(e.target.value)}
            placeholder="0"
            className="w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">h</span>
          <Input
            type="number"
            min={0}
            max={59}
            value={estimateMinutes}
            onChange={(e) => setEstimateMinutes(e.target.value)}
            placeholder="0"
            className="w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">m</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            ["15m", 0, 15],
            ["30m", 0, 30],
            ["1h", 1, 0],
            ["2h", 2, 0],
            ["4h", 4, 0],
          ] as [string, number, number][]).map(([label, h, m]) => (
            <Button
              key={label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setEstimateHours(h > 0 ? String(h) : "");
                setEstimateMinutes(m > 0 ? String(m) : "");
              }}
            >
              {label}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => {
              setEstimateHours("");
              setEstimateMinutes("");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {initialData && (
        <div className="flex flex-col gap-2">
          <Label className="flex items-center gap-1.5">
            <Timer className="h-4 w-4" />
            Time Invested
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={999}
              value={investedHours}
              onChange={(e) => setInvestedHours(e.target.value)}
              placeholder="0"
              className="w-20 text-center"
            />
            <span className="text-sm text-muted-foreground">h</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={investedMinutes}
              onChange={(e) => setInvestedMinutes(e.target.value)}
              placeholder="0"
              className="w-20 text-center"
            />
            <span className="text-sm text-muted-foreground">m</span>
          </div>
        </div>
      )}

      {filteredTags.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1.5">
            {filteredTags.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              const colorStyle = TAG_COLORS[tag.color];
              return (
                <Badge
                  key={tag.id}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer select-none transition-colors",
                    !isSelected && colorStyle?.badge
                  )}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>Start Date</Label>
        <div className="relative">
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  startDate && "pr-8",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                  setStartDate(date ?? undefined);
                  setStartDateOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          {startDate && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50 hover:opacity-100"
              onClick={() => setStartDate(undefined)}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

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
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">Every</span>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={recurrenceFrequency}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) setRecurrenceFrequency(v);
                  }}
                  className="w-16 text-center"
                />
                <Select
                  value={recurrenceInterval}
                  onValueChange={(v) => {
                    setRecurrenceInterval(v as RecurrenceInterval);
                    if (v !== "weekly") setSelectedDays([]);
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">day{recurrenceFrequency !== 1 ? "s" : ""}</SelectItem>
                    <SelectItem value="weekly">week{recurrenceFrequency !== 1 ? "s" : ""}</SelectItem>
                    <SelectItem value="monthly">month{recurrenceFrequency !== 1 ? "s" : ""}</SelectItem>
                    <SelectItem value="yearly">year{recurrenceFrequency !== 1 ? "s" : ""}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedDays([1, 2, 3, 4, 5] as DayOfWeek[])}
                    >
                      Weekdays
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedDays([0, 6] as DayOfWeek[])}
                    >
                      Weekends
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[])}
                    >
                      Every day
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => setSelectedDays([])}
                    >
                      Clear
                    </Button>
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

      {availableLists.length > 0 && !isSubtask && (
        <div className="flex flex-col gap-2">
          <Label>List</Label>
          <Select value={selectedListId} onValueChange={(v) => {
            setSelectedListId(v);
            setSelectedDependency(undefined); // deps are same-list only
            // Deselect tags that aren't available in the new list
            const newListId = v === "__inbox__" ? undefined : v;
            const newFilteredTags = getTagsForList(availableTags, newListId);
            const newFilteredIds = new Set(newFilteredTags.map((t) => t.id));
            setSelectedTags((prev) => prev.filter((id) => newFilteredIds.has(id)));
          }}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__inbox__">Inbox</SelectItem>
              {availableLists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-block h-2.5 w-2.5 rounded-full",
                        TAG_COLORS[list.color]?.dot
                      )}
                    />
                    {list.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {availableDependencies.length > 0 && !isSubtask && (
        <div className="flex flex-col gap-2">
          <Label>Depends On</Label>
          <Popover open={depPickerOpen} onOpenChange={setDepPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={depPickerOpen}
                className={cn(
                  "w-full justify-between text-left font-normal",
                  !selectedDependency && "text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <Link className="h-4 w-4 shrink-0" />
                  {selectedDependency
                    ? availableDependencies.find((t) => t.id === selectedDependency)?.title ?? "Unknown task"
                    : "None (no dependency)"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search tasks..." />
                <CommandList>
                  <CommandEmpty>No tasks found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__none__"
                      onSelect={() => {
                        setSelectedDependency(undefined);
                        setDepPickerOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          !selectedDependency ? "opacity-100" : "opacity-0"
                        )}
                      />
                      None (no dependency)
                    </CommandItem>
                    {availableDependencies.map((dep) => (
                      <CommandItem
                        key={dep.id}
                        value={dep.title}
                        onSelect={() => {
                          setSelectedDependency(dep.id);
                          setDepPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedDependency === dep.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate">{dep.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

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

"use client";

import { useMemo } from "react";
import { endOfMonth, format } from "date-fns";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import type { Task, Tag } from "@/lib/types";
import { useTimelineState } from "@/hooks/use-timeline-state";
import { TimelineGrid } from "@/components/timeline-grid";
import { Button } from "@/components/ui/button";

interface TimelineViewProps {
  tasks: Task[];
  listFilter?: (tasks: Task[]) => Task[];
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  updateTask: (
    id: string,
    updates: Partial<Omit<Task, "id" | "children">>
  ) => void;
  tagMap?: Record<string, Tag>;
  showFullMonth: boolean;
  onToggleFullMonth: () => void;
}

export function TimelineView({
  tasks,
  listFilter,
  onToggle,
  onEdit,
  updateTask,
  tagMap,
  showFullMonth,
  onToggleFullMonth,
}: TimelineViewProps) {

  const { currentMonth, goToPreviousMonth, goToNextMonth, goToToday } =
    useTimelineState();

  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  const filteredTasks = useMemo(() => {
    return listFilter ? listFilter(tasks) : tasks;
  }, [tasks, listFilter]);

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousMonth}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold w-44 text-center">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleFullMonth}
            title={showFullMonth ? "Fit to panel" : "Show full month"}
          >
            {showFullMonth ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
      </div>

      {/* Timeline grid */}
      <TimelineGrid
        tasks={filteredTasks}
        monthStart={currentMonth}
        monthEnd={monthEnd}
        onToggle={onToggle}
        onEdit={onEdit}
        updateTask={updateTask}
        tagMap={tagMap}
      />
    </div>
  );
}

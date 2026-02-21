"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { startOfDay, addDays } from "date-fns";
import { ListTodo, Plus, CalendarCheck, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  defaultDropAnimationSideEffects,
  type DragStartEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { preloadCompletionSound } from "@/lib/completion-sound";
import { useTaskStore } from "@/hooks/use-task-store";
import { useTagStore } from "@/hooks/use-tag-store";
import { useListStore } from "@/hooks/use-list-store";
import { useTimer } from "@/hooks/use-timer";
import { findItemDeep, flattenTree, excludeArchivedTasks, getChildCount } from "@/lib/tree-utils";
import { sidebarAwareCollision } from "@/lib/dnd-collision";
import { isSidebarDroppableId, getListIdFromDroppableId } from "@/lib/dnd-utils";
import { TaskTree } from "@/components/task-tree";
import { TaskItemOverlay } from "@/components/task-item";
import { TodayList } from "@/components/today-list";
import { ArchivedList } from "@/components/archived-list";
import { TaskForm } from "@/components/task-form";
import { TagManager } from "@/components/tag-manager";
import { ModeToggle } from "@/components/mode-toggle";
import { AppSidebar, type ActiveListFilter } from "@/components/app-sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { Task, Priority, RecurrencePattern } from "@/lib/types";
import {
  ACTIVE_LIST_KEY,
  TOMORROW_SORT_ORDER_KEY,
  TOMORROW_RECURRING_SECTION_KEY,
  TOMORROW_NON_RECURRING_SECTION_KEY,
} from "@/lib/constants";

const measuring = {
  droppable: { strategy: MeasuringStrategy.Always },
};

const dropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.4" } },
  }),
};

type SidebarView = "tasks" | "archived" | "tags";

export default function Home() {
  useEffect(() => {
    preloadCompletionSound();
  }, []);

  const {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    archiveTask,
    unarchiveTask,
    fastForwardTask,
    skipTodayTask,
    restoreTasks,
  } = useTaskStore();

  const {
    tags,
    addTag,
    updateTag: updateTagDef,
    deleteTag: deleteTagDef,
    restoreTags,
  } = useTagStore();

  const {
    lists,
    addList,
    updateList,
    deleteList,
    restoreLists,
  } = useListStore();

  const tagMap = useMemo(
    () => Object.fromEntries(tags.map((t) => [t.id, t])),
    [tags]
  );

  // --- Active list filter (persisted to localStorage) ---
  // Deferred localStorage read to avoid hydration mismatch (same pattern as useTaskStore)
  const [activeFilter, setActiveFilter] = useState<ActiveListFilter>("all");
  const isFilterLoaded = useRef(false);

  useEffect(() => {
    if (!isFilterLoaded.current) return;
    localStorage.setItem(ACTIVE_LIST_KEY, activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_LIST_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveFilter(stored as ActiveListFilter);
    }
    isFilterLoaded.current = true;
  }, []);

  const [sidebarView, setSidebarView] = useState<SidebarView>("tasks");

  function handleFilterChange(filter: ActiveListFilter) {
    setActiveFilter(filter);
    setSidebarView("tasks");
  }

  function handleShowArchived() {
    setSidebarView("archived");
  }

  function handleShowTags() {
    setSidebarView("tags");
  }

  // --- Timer ---
  const handleSaveElapsed = useCallback(
    (taskId: string, elapsedMs: number) => {
      const task = findItemDeep(tasks, taskId);
      if (task) {
        updateTask(taskId, { timeInvestedMs: task.timeInvestedMs + elapsedMs });
      }
    },
    [tasks, updateTask]
  );

  const saveElapsedRef = useRef(handleSaveElapsed);
  useEffect(() => {
    saveElapsedRef.current = handleSaveElapsed;
  }, [handleSaveElapsed]);

  const stableSaveElapsed = useCallback(
    (taskId: string, elapsedMs: number) => {
      saveElapsedRef.current(taskId, elapsedMs);
    },
    []
  );

  const { activeTimerId, currentElapsedMs, startTimer, pauseTimer, stopTimerForTask } =
    useTimer(stableSaveElapsed);

  function handleToggleWithTimer(id: string) {
    stopTimerForTask(id);
    toggleTask(id);
  }

  function handleDeleteWithTimer(id: string) {
    stopTimerForTask(id);
    const taskToDelete = findItemDeep(tasks, id);
    const snapshot = tasks;
    deleteTask(id);

    toast.dismiss();
    const title = taskToDelete?.title;
    toast(title ? `"${title}" deleted` : "Task deleted", {
      action: {
        label: "Undo",
        onClick: () => restoreTasks(snapshot),
      },
      duration: 5000,
    });
  }

  function handleArchiveWithTimer(id: string) {
    stopTimerForTask(id);
    archiveTask(id);
  }

  // --- Filtering ---
  const activeTasks = useMemo(() => excludeArchivedTasks(tasks), [tasks]);

  // Filter root-level tasks by active list
  const filteredTasks = useMemo(() => {
    if (activeFilter === "all") return activeTasks;
    if (activeFilter === "inbox") return activeTasks.filter((t) => !t.listId);
    return activeTasks.filter((t) => t.listId === activeFilter);
  }, [activeTasks, activeFilter]);

  // For TodayList, filter the flattened results by listId
  const filterTasksByList = useCallback(
    (taskList: Task[]): Task[] => {
      if (activeFilter === "all") return taskList;
      if (activeFilter === "inbox") return taskList.filter((t) => !t.listId);
      return taskList.filter((t) => t.listId === activeFilter);
    },
    [activeFilter]
  );

  // Task counts for sidebar badges (count root-level non-archived tasks)
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let inboxCount = 0;
    function countTasks(items: Task[]) {
      for (const task of items) {
        if (task.archived) {
          // don't count archived, but look at children
          countTasks(task.children);
          continue;
        }
        if (task.listId) {
          counts[task.listId] = (counts[task.listId] ?? 0) + 1;
        } else {
          inboxCount++;
        }
        countTasks(task.children);
      }
    }
    countTasks(tasks);
    counts["inbox"] = inboxCount;
    return counts;
  }, [tasks]);

  // --- Delete list handler: clear listId from tasks ---
  function handleDeleteList(id: string) {
    // Clear listId from tasks that belong to this list
    function clearListId(items: Task[]) {
      for (const task of items) {
        if (task.listId === id) {
          updateTask(task.id, { listId: undefined });
        }
        clearListId(task.children);
      }
    }
    clearListId(tasks);
    deleteList(id);
  }

  // --- Dialog state ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null);

  function handleAddRootTask() {
    setEditingTask(null);
    setParentIdForNew(null);
    setDialogOpen(true);
  }

  function handleAddSubtask(parentId: string) {
    setEditingTask(null);
    setParentIdForNew(parentId);
    setDialogOpen(true);
  }

  function handleEdit(task: Task) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  // Default listId for new tasks: use active filter if it's a specific list
  const defaultListId = activeFilter !== "all" && activeFilter !== "inbox"
    ? activeFilter
    : undefined;

  function handleFormSubmit(data: {
    title: string;
    priority: Priority;
    dueDate: string | null;
    scheduledDate: string | null;
    parentId: string | null;
    recurrence?: RecurrencePattern;
    tags?: string[];
    listId?: string;
  }) {
    if (editingTask) {
      updateTask(editingTask.id, {
        title: data.title,
        priority: data.priority,
        dueDate: data.dueDate,
        scheduledDate: data.scheduledDate,
        recurrence: data.recurrence,
        tags: data.tags,
        listId: data.listId,
      });
    } else {
      addTask(
        data.title,
        data.priority,
        data.dueDate,
        data.scheduledDate,
        data.parentId,
        data.recurrence,
        data.tags,
        data.listId
      );
    }
    setDialogOpen(false);
  }

  // Determine the heading based on the active filter
  const heading = useMemo(() => {
    if (sidebarView === "archived") return "Archived";
    if (sidebarView === "tags") return "Tags";
    if (activeFilter === "all") return "All Tasks";
    if (activeFilter === "inbox") return "Inbox";
    const list = lists.find((l) => l.id === activeFilter);
    return list?.name ?? "Tasks";
  }, [activeFilter, lists, sidebarView]);

  // --- DnD state (lifted to page level) ---
  const [dndActiveId, setDndActiveId] = useState<UniqueIdentifier | null>(null);
  const [dndOverId, setDndOverId] = useState<UniqueIdentifier | null>(null);
  const [dndOffsetLeft, setDndOffsetLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Compute activeItem for DragOverlay
  const activeItem = useMemo(() => {
    if (!dndActiveId) return null;
    const flat = flattenTree(activeTasks);
    return flat.find(({ id }) => id === String(dndActiveId)) ?? null;
  }, [dndActiveId, activeTasks]);

  function handleDragStart(event: DragStartEvent) {
    setDndActiveId(event.active.id);
    setDndOverId(event.active.id);
  }

  function handleDragMove(event: DragMoveEvent) {
    setDndOffsetLeft(event.delta.x);
  }

  function handleDragOver(event: DragOverEvent) {
    setDndOverId(event.over?.id ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setDndActiveId(null);
    setDndOverId(null);
    setDndOffsetLeft(0);

    if (!over) return;

    const overIdStr = String(over.id);

    // Handle sidebar drops at page level
    if (isSidebarDroppableId(overIdStr)) {
      const targetListId = getListIdFromDroppableId(overIdStr);
      const taskId = String(active.id);
      const task = findItemDeep(tasks, taskId);

      if (!task) return;

      // No-op if dropping on the same list
      const currentListId = task.listId;
      if (targetListId === currentListId) return;
      if (!targetListId && !currentListId) return;

      updateTask(taskId, { listId: targetListId });

      const targetName = targetListId
        ? lists.find((l) => l.id === targetListId)?.name ?? "list"
        : "Inbox";

      toast(`Moved "${task.title}" to ${targetName}`);
      return;
    }

    // Non-sidebar drops are handled by child useDndMonitor handlers
  }

  function handleDragCancel() {
    setDndActiveId(null);
    setDndOverId(null);
    setDndOffsetLeft(0);
  }

  return (
    <SidebarProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={sidebarAwareCollision}
        measuring={measuring}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <AppSidebar
          lists={lists}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          onAddList={addList}
          onUpdateList={updateList}
          onDeleteList={handleDeleteList}
          taskCounts={taskCounts}
          onShowArchived={handleShowArchived}
          onShowTags={handleShowTags}
          isArchivedView={sidebarView === "archived"}
          isTagsView={sidebarView === "tags"}
          tasks={tasks}
          tags={tags}
          onRestoreTasks={restoreTasks}
          onRestoreLists={restoreLists}
          onRestoreTags={restoreTags}
        />
        <SidebarInset>
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-3xl px-4 py-8">
            <header className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
              </div>
              <div className="flex items-center gap-2">
                {sidebarView === "tasks" && (
                  <Button onClick={handleAddRootTask}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Task
                  </Button>
                )}
                <ModeToggle />
              </div>
            </header>

            {sidebarView === "archived" ? (
              <ArchivedList
                tasks={tasks}
                onUnarchive={unarchiveTask}
                onDelete={handleDeleteWithTimer}
              />
            ) : sidebarView === "tags" ? (
              <TagManager
                tags={tags}
                onAdd={addTag}
                onUpdate={updateTagDef}
                onDelete={deleteTagDef}
              />
            ) : (
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">
                    <ListTodo className="mr-2 h-4 w-4" />
                    All Tasks
                  </TabsTrigger>
                  <TabsTrigger value="today">
                    <CalendarCheck className="mr-2 h-4 w-4" />
                    Today
                  </TabsTrigger>
                  <TabsTrigger value="tomorrow">
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Tomorrow
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                  {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
                      <ListTodo className="h-12 w-12 text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-lg font-medium">No tasks yet</p>
                        <p className="text-sm text-muted-foreground">
                          Create your first task to get started
                        </p>
                      </div>
                      <Button variant="outline" onClick={handleAddRootTask}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Task
                      </Button>
                    </div>
                  ) : (
                    <TaskTree
                      tasks={filteredTasks}
                      onReorder={reorderTasks}
                      onToggle={handleToggleWithTimer}
                      onDelete={handleDeleteWithTimer}
                      onEdit={handleEdit}
                      onAddSubtask={handleAddSubtask}
                      onArchive={handleArchiveWithTimer}
                      onFastForward={fastForwardTask}
                      activeTimerId={activeTimerId}
                      currentElapsedMs={currentElapsedMs}
                      onStartTimer={startTimer}
                      onPauseTimer={pauseTimer}
                      tagMap={tagMap}
                      activeId={dndActiveId}
                      overId={dndOverId}
                      offsetLeft={dndOffsetLeft}
                    />
                  )}
                </TabsContent>

                <TabsContent value="today">
                  <TodayList
                    tasks={tasks}
                    listFilter={filterTasksByList}
                    onToggle={handleToggleWithTimer}
                    onDelete={handleDeleteWithTimer}
                    onEdit={handleEdit}
                    onArchive={handleArchiveWithTimer}
                    onFastForward={fastForwardTask}
                    onSkipToday={skipTodayTask}
                    activeTimerId={activeTimerId}
                    currentElapsedMs={currentElapsedMs}
                    onStartTimer={startTimer}
                    onPauseTimer={pauseTimer}
                    tagMap={tagMap}
                  />
                </TabsContent>

                <TabsContent value="tomorrow">
                  <TodayList
                    tasks={tasks}
                    listFilter={filterTasksByList}
                    date={startOfDay(addDays(new Date(), 1))}
                    storageKey={TOMORROW_SORT_ORDER_KEY}
                    recurringSectionKey={TOMORROW_RECURRING_SECTION_KEY}
                    nonRecurringSectionKey={TOMORROW_NON_RECURRING_SECTION_KEY}
                    emptyMessage="Nothing scheduled for tomorrow"
                    progressLabel="Tomorrow's Progress"
                    onToggle={handleToggleWithTimer}
                    onDelete={handleDeleteWithTimer}
                    onEdit={handleEdit}
                    onArchive={handleArchiveWithTimer}
                    onFastForward={fastForwardTask}
                    activeTimerId={activeTimerId}
                    currentElapsedMs={currentElapsedMs}
                    onStartTimer={startTimer}
                    onPauseTimer={pauseTimer}
                    tagMap={tagMap}
                  />
                </TabsContent>
              </Tabs>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTask
                      ? "Edit Task"
                      : parentIdForNew
                        ? "Add Subtask"
                        : "New Task"}
                  </DialogTitle>
                </DialogHeader>
                <TaskForm
                  key={editingTask?.id ?? parentIdForNew ?? "new"}
                  initialData={editingTask ?? undefined}
                  parentId={editingTask ? null : parentIdForNew}
                  availableTags={tags}
                  availableLists={lists}
                  defaultListId={defaultListId}
                  onSubmit={handleFormSubmit}
                  onCancel={() => setDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        </SidebarInset>
        <DragOverlay dropAnimation={dropAnimation}>
          {dndActiveId && activeItem ? (
            <TaskItemOverlay
              task={activeItem}
              childCount={getChildCount(tasks, String(dndActiveId))}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </SidebarProvider>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import {
  Inbox,
  List,
  Plus,
  Archive,
  Tags,
  Download,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Task, TaskList, Tag, TagColor } from "@/lib/types";
import { TAG_COLORS, SIDEBAR_INBOX_DROPPABLE_ID } from "@/lib/constants";
import {
  createBackupData,
  downloadBackup,
  parseBackupFile,
  gatherPreferences,
  restorePreferences,
} from "@/lib/backup-utils";
import { makeListDroppableId } from "@/lib/dnd-utils";
import { cn } from "@/lib/utils";
import { DroppableSidebarItem } from "@/components/droppable-sidebar-item";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListForm } from "@/components/list-form";

// "all" = show all lists combined, "inbox" = no listId, string = specific list id
export type ActiveListFilter = "all" | "inbox" | string;

interface AppSidebarProps {
  lists: TaskList[];
  activeFilter: ActiveListFilter;
  onFilterChange: (filter: ActiveListFilter) => void;
  onAddList: (name: string, color: TagColor) => TaskList;
  onUpdateList: (id: string, updates: Partial<Omit<TaskList, "id" | "createdDate">>) => void;
  onDeleteList: (id: string) => void;
  taskCounts: Record<string, number>; // listId -> count, "inbox" -> count for unassigned
  onShowArchived: () => void;
  onShowTags: () => void;
  isArchivedView: boolean;
  isTagsView: boolean;
  // Backup/restore
  tasks: Task[];
  tags: Tag[];
  onRestoreTasks: (snapshot: Task[]) => void;
  onRestoreLists: (snapshot: TaskList[]) => void;
  onRestoreTags: (snapshot: Tag[]) => void;
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function AppSidebar({
  lists,
  activeFilter,
  onFilterChange,
  onAddList,
  onUpdateList,
  onDeleteList,
  taskCounts,
  onShowArchived,
  onShowTags,
  isArchivedView,
  isTagsView,
  tasks,
  tags,
  onRestoreTasks,
  onRestoreLists,
  onRestoreTags,
  searchQuery,
  onSearchChange,
}: AppSidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<TaskList | null>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<Awaited<ReturnType<typeof parseBackupFile>> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const totalCount = Object.values(taskCounts).reduce((sum, n) => sum + n, 0);

  function handleCreateSubmit(data: { name: string; color: TagColor }) {
    const newList = onAddList(data.name, data.color);
    setCreateDialogOpen(false);
    onFilterChange(newList.id);
  }

  function handleEditSubmit(data: { name: string; color: TagColor }) {
    if (!editingList) return;
    onUpdateList(editingList.id, data);
    setEditingList(null);
  }

  function handleDeleteList(id: string) {
    onDeleteList(id);
    if (activeFilter === id) {
      onFilterChange("all");
    }
  }

  function handleExport() {
    const preferences = gatherPreferences();
    const data = createBackupData(tasks, lists, tags, preferences);
    downloadBackup(data);
    toast.success("Backup exported");
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be selected again
    e.target.value = "";

    try {
      const data = await parseBackupFile(file);
      setPendingImport(data);
      setImportConfirmOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read backup file");
    }
  }

  function handleImportConfirm() {
    if (!pendingImport) return;

    onRestoreTasks(pendingImport.tasks);
    onRestoreLists(pendingImport.lists);
    onRestoreTags(pendingImport.tags);
    if (pendingImport.preferences) {
      restorePreferences(pendingImport.preferences);
    }

    setImportConfirmOpen(false);
    setPendingImport(null);
    toast.success("Backup imported successfully");
  }

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <div className="relative px-2 pt-2">
            <Search className="absolute left-4 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 pr-8 h-8"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-4 top-1/2 mt-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={activeFilter === "all" && !isArchivedView && !isTagsView}
                onClick={() => onFilterChange("all")}
                tooltip="All Tasks"
              >
                <List className="h-4 w-4" />
                <span>All Tasks</span>
              </SidebarMenuButton>
              {totalCount > 0 && (
                <SidebarMenuBadge>{totalCount}</SidebarMenuBadge>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <DroppableSidebarItem droppableId={SIDEBAR_INBOX_DROPPABLE_ID}>
                <SidebarMenuButton
                  isActive={activeFilter === "inbox" && !isArchivedView && !isTagsView}
                  onClick={() => onFilterChange("inbox")}
                  tooltip="Inbox"
                >
                  <Inbox className="h-4 w-4" />
                  <span>Inbox</span>
                </SidebarMenuButton>
              </DroppableSidebarItem>
              {(taskCounts["inbox"] ?? 0) > 0 && (
                <SidebarMenuBadge className="top-1.5">{taskCounts["inbox"]}</SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Lists</SidebarGroupLabel>
            <SidebarGroupAction title="New list" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {lists.map((list) => (
                  <SidebarMenuItem key={list.id}>
                    <DroppableSidebarItem droppableId={makeListDroppableId(list.id)}>
                      <SidebarMenuButton
                        isActive={activeFilter === list.id && !isArchivedView && !isTagsView}
                        onClick={() => onFilterChange(list.id)}
                        tooltip={list.name}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 shrink-0 rounded-full",
                            TAG_COLORS[list.color]?.dot
                          )}
                        />
                        <span>{list.name}</span>
                      </SidebarMenuButton>
                    </DroppableSidebarItem>
                    {(taskCounts[list.id] ?? 0) > 0 && (
                      <SidebarMenuBadge className="top-1.5">{taskCounts[list.id]}</SidebarMenuBadge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction showOnHover>
                          <MoreHorizontal className="h-4 w-4" />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem onClick={() => setEditingList(list)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteList(list.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}

                {lists.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    No lists yet
                  </p>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isArchivedView}
                    onClick={onShowArchived}
                    tooltip="Archived"
                  >
                    <Archive className="h-4 w-4" />
                    <span>Archived</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isTagsView}
                    onClick={onShowTags}
                    tooltip="Tags"
                  >
                    <Tags className="h-4 w-4" />
                    <span>Tags</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleExport} tooltip="Export Data">
                    <Download className="h-4 w-4" />
                    <span>Export Data</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => fileInputRef.current?.click()}
                    tooltip="Import Data"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Import Data</span>
                  </SidebarMenuButton>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileSelected}
                  />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New List</DialogTitle>
          </DialogHeader>
          <ListForm
            onSubmit={handleCreateSubmit}
            onCancel={() => setCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingList} onOpenChange={(open) => !open && setEditingList(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List</DialogTitle>
          </DialogHeader>
          {editingList && (
            <ListForm
              key={editingList.id}
              initialData={editingList}
              onSubmit={handleEditSubmit}
              onCancel={() => setEditingList(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Backup</DialogTitle>
            <DialogDescription>
              This will replace all your current tasks, lists, and tags with the data from the backup file. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleImportConfirm}>
              Replace All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import type { Tag, TagColor, TaskList } from "@/lib/types";
import { TAG_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLOR_OPTIONS: TagColor[] = [
  "red",
  "blue",
  "green",
  "amber",
  "purple",
  "pink",
  "cyan",
  "slate",
];

interface TagManagerProps {
  tags: Tag[];
  lists: TaskList[];
  onAdd: (name: string, color: TagColor, listIds: string[]) => void;
  onUpdate: (id: string, updates: Partial<Omit<Tag, "id">>) => void;
  onDelete: (id: string) => void;
}

function ColorDot({ color, className }: { color: string; className?: string }) {
  const colorStyle = TAG_COLORS[color];
  return (
    <span
      className={cn("inline-block h-3 w-3 rounded-full", colorStyle?.dot, className)}
    />
  );
}

const ALL_LISTS_SENTINEL = "__all__";

export function TagManager({ tags, lists, onAdd, onUpdate, onDelete }: TagManagerProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<TagColor>("blue");
  const [newListScope, setNewListScope] = useState(ALL_LISTS_SENTINEL);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<TagColor>("blue");
  const [editListScope, setEditListScope] = useState(ALL_LISTS_SENTINEL);

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const listIds = newListScope === ALL_LISTS_SENTINEL ? [] : [newListScope];
    onAdd(trimmed, newColor, listIds);
    setNewName("");
    setNewListScope(ALL_LISTS_SENTINEL);
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditListScope(tag.listIds[0] ?? ALL_LISTS_SENTINEL);
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    const listIds = editListScope === ALL_LISTS_SENTINEL ? [] : [editListScope];
    onUpdate(editingId, { name: editName.trim(), color: editColor, listIds });
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {tags.length > 0 && (
        <div className="flex flex-col gap-2">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2">
              {editingId === tag.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  <Select
                    value={editColor}
                    onValueChange={(v) => setEditColor(v as TagColor)}
                  >
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          <div className="flex items-center gap-1.5">
                            <ColorDot color={c} />
                            {c}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lists.length > 0 && (
                    <Select
                      value={editListScope}
                      onValueChange={setEditListScope}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_LISTS_SENTINEL}>All Lists</SelectItem>
                        {lists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            <div className="flex items-center gap-1.5">
                              <ColorDot color={list.color} className="h-2.5 w-2.5" />
                              {list.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={saveEdit}
                    title="Save"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={cancelEdit}
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Badge
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start gap-1.5 text-sm",
                      TAG_COLORS[tag.color]?.badge
                    )}
                  >
                    <ColorDot color={tag.color} />
                    {tag.name}
                    {tag.listIds.length > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({lists.find((l) => l.id === tag.listIds[0])?.name ?? "Unknown list"})
                      </span>
                    )}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => startEdit(tag)}
                    title="Edit tag"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(tag.id)}
                    title="Delete tag"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {tags.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No tags yet. Create one below.
        </p>
      )}

      <div className="border-t pt-4">
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tag name..."
            className="h-8 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Select
            value={newColor}
            onValueChange={(v) => setNewColor(v as TagColor)}
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  <div className="flex items-center gap-1.5">
                    <ColorDot color={c} />
                    {c}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lists.length > 0 && (
            <Select
              value={newListScope}
              onValueChange={setNewListScope}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LISTS_SENTINEL}>All Lists</SelectItem>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    <div className="flex items-center gap-1.5">
                      <ColorDot color={list.color} className="h-2.5 w-2.5" />
                      {list.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            className="h-8"
            onClick={handleAdd}
            disabled={!newName.trim()}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

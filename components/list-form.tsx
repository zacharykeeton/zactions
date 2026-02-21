"use client";

import { useState } from "react";
import type { TaskList, TagColor } from "@/lib/types";
import { TAG_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

interface ListFormProps {
  initialData?: TaskList;
  onSubmit: (data: { name: string; color: TagColor }) => void;
  onCancel: () => void;
}

export function ListForm({ initialData, onSubmit, onCancel }: ListFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [color, setColor] = useState<TagColor>(initialData?.color ?? "blue");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, color });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="list-name">Name</Label>
        <Input
          id="list-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="List name..."
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-8 w-8 rounded-full transition-all",
                TAG_COLORS[c]?.dot,
                color === c
                  ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                  : "opacity-60 hover:opacity-100"
              )}
              title={c}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {initialData ? "Save" : "Create List"}
        </Button>
      </div>
    </form>
  );
}

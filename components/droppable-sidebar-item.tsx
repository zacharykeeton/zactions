"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableSidebarItemProps {
  droppableId: string;
  children: React.ReactNode;
}

export function DroppableSidebarItem({ droppableId, children }: DroppableSidebarItemProps) {
  const { isOver, setNodeRef, active } = useDroppable({
    id: droppableId,
    data: { type: "sidebar-list" },
  });

  const showHighlight = isOver && active != null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md transition-colors duration-150",
        showHighlight && "ring-2 ring-primary/50 bg-primary/10"
      )}
    >
      {children}
    </div>
  );
}

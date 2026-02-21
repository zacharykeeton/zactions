import { SIDEBAR_DROPPABLE_PREFIX, SIDEBAR_INBOX_DROPPABLE_ID } from "./constants";

export function isSidebarDroppableId(id: string): boolean {
  return id.startsWith(SIDEBAR_DROPPABLE_PREFIX) || id === SIDEBAR_INBOX_DROPPABLE_ID;
}

export function getListIdFromDroppableId(droppableId: string): string | undefined {
  if (droppableId === SIDEBAR_INBOX_DROPPABLE_ID) return undefined;
  if (droppableId.startsWith(SIDEBAR_DROPPABLE_PREFIX)) {
    return droppableId.slice(SIDEBAR_DROPPABLE_PREFIX.length);
  }
  return undefined;
}

export function makeListDroppableId(listId: string): string {
  return `${SIDEBAR_DROPPABLE_PREFIX}${listId}`;
}

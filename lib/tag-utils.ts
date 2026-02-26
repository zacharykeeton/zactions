import type { Tag } from "./types";

/**
 * Returns tags available for a given list context.
 * - listId undefined (Inbox): only global tags (listIds is empty)
 * - listId is a string (named list): global tags + tags scoped to that list
 */
export function getTagsForList(tags: Tag[], listId: string | undefined): Tag[] {
  if (listId === undefined) {
    return tags.filter((tag) => tag.listIds.length === 0);
  }
  return tags.filter(
    (tag) => tag.listIds.length === 0 || tag.listIds.includes(listId)
  );
}

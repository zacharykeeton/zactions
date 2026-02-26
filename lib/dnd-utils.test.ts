import { describe, it, expect } from "vitest";
import { isSidebarDroppableId, getListIdFromDroppableId, makeListDroppableId } from "./dnd-utils";
import { SIDEBAR_DROPPABLE_PREFIX, SIDEBAR_INBOX_DROPPABLE_ID } from "./constants";

describe("isSidebarDroppableId", () => {
  it("returns true for inbox droppable ID", () => {
    expect(isSidebarDroppableId(SIDEBAR_INBOX_DROPPABLE_ID)).toBe(true);
  });

  it("returns true for sidebar list droppable ID", () => {
    expect(isSidebarDroppableId(`${SIDEBAR_DROPPABLE_PREFIX}list-123`)).toBe(true);
  });

  it("returns false for a regular task ID", () => {
    expect(isSidebarDroppableId("some-task-uuid")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isSidebarDroppableId("")).toBe(false);
  });

  it("returns false for a partial prefix match that isn't the full prefix", () => {
    // "sidebar-" is a prefix of SIDEBAR_DROPPABLE_PREFIX ("sidebar-list-")
    // but it shouldn't match unless it's the full prefix or the inbox ID
    expect(isSidebarDroppableId("sidebar-other")).toBe(false);
  });
});

describe("getListIdFromDroppableId", () => {
  it("returns undefined for inbox droppable", () => {
    expect(getListIdFromDroppableId(SIDEBAR_INBOX_DROPPABLE_ID)).toBeUndefined();
  });

  it("extracts list ID from sidebar droppable", () => {
    expect(getListIdFromDroppableId(`${SIDEBAR_DROPPABLE_PREFIX}abc-123`)).toBe("abc-123");
  });

  it("returns undefined for non-sidebar droppable", () => {
    expect(getListIdFromDroppableId("some-task-id")).toBeUndefined();
  });

  it("returns empty string when prefix is immediately followed by nothing", () => {
    expect(getListIdFromDroppableId(SIDEBAR_DROPPABLE_PREFIX)).toBe("");
  });
});

describe("makeListDroppableId", () => {
  it("creates a droppable ID with the sidebar prefix", () => {
    expect(makeListDroppableId("my-list")).toBe(`${SIDEBAR_DROPPABLE_PREFIX}my-list`);
  });

  it("round-trips with getListIdFromDroppableId", () => {
    const listId = "uuid-456";
    const droppableId = makeListDroppableId(listId);
    expect(getListIdFromDroppableId(droppableId)).toBe(listId);
  });

  it("round-trip droppable is recognized as sidebar", () => {
    const droppableId = makeListDroppableId("any-list");
    expect(isSidebarDroppableId(droppableId)).toBe(true);
  });
});

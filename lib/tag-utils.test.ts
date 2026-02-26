import { describe, it, expect } from "vitest";
import { getTagsForList } from "./tag-utils";
import type { Tag } from "./types";

const globalTag: Tag = { id: "g1", name: "global", color: "blue", listIds: [] };
const workTag: Tag = { id: "w1", name: "work", color: "red", listIds: ["list-work"] };
const personalTag: Tag = { id: "p1", name: "personal", color: "green", listIds: ["list-personal"] };

const allTags = [globalTag, workTag, personalTag];

describe("getTagsForList", () => {
  it("returns only global tags for Inbox (undefined listId)", () => {
    const result = getTagsForList(allTags, undefined);
    expect(result).toEqual([globalTag]);
  });

  it("returns global + scoped tags for a named list", () => {
    const result = getTagsForList(allTags, "list-work");
    expect(result).toEqual([globalTag, workTag]);
  });

  it("returns only global tags for an unknown list ID", () => {
    const result = getTagsForList(allTags, "list-unknown");
    expect(result).toEqual([globalTag]);
  });

  it("returns empty array when tags array is empty", () => {
    expect(getTagsForList([], undefined)).toEqual([]);
    expect(getTagsForList([], "list-work")).toEqual([]);
  });

  it("returns all tags when all are global", () => {
    const globals = [globalTag, { ...workTag, listIds: [] }];
    expect(getTagsForList(globals, undefined)).toEqual(globals);
    expect(getTagsForList(globals, "any-list")).toEqual(globals);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  escapeIcsText,
  msToIcsDuration,
  getEventDate,
  generateIcsString,
  sanitizeFilename,
} from "./ics-utils";
import type { Task } from "./types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "test-id-123",
    title: "Test Task",
    completed: false,
    priority: "medium",
    dueDate: null,
    scheduledDate: null,
    startDate: null,
    completedDate: null,
    createdDate: "2026-02-27",
    children: [],
    timeInvestedMs: 0,
    timeEstimateMs: 2_700_000, // 45 minutes
    archived: false,
    ...overrides,
  };
}

describe("escapeIcsText", () => {
  it("escapes backslashes", () => {
    expect(escapeIcsText("path\\to\\file")).toBe("path\\\\to\\\\file");
  });

  it("escapes semicolons", () => {
    expect(escapeIcsText("a;b;c")).toBe("a\\;b\\;c");
  });

  it("escapes commas", () => {
    expect(escapeIcsText("one, two, three")).toBe("one\\, two\\, three");
  });

  it("escapes newlines", () => {
    expect(escapeIcsText("line1\nline2")).toBe("line1\\nline2");
  });

  it("escapes combined special characters", () => {
    expect(escapeIcsText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });
});

describe("msToIcsDuration", () => {
  it("converts 15 minutes", () => {
    expect(msToIcsDuration(15 * 60_000)).toBe("PT15M");
  });

  it("converts 45 minutes", () => {
    expect(msToIcsDuration(45 * 60_000)).toBe("PT45M");
  });

  it("converts 1 hour", () => {
    expect(msToIcsDuration(60 * 60_000)).toBe("PT1H");
  });

  it("converts 1 hour 30 minutes", () => {
    expect(msToIcsDuration(90 * 60_000)).toBe("PT1H30M");
  });

  it("converts 3 hours 15 minutes", () => {
    expect(msToIcsDuration(195 * 60_000)).toBe("PT3H15M");
  });

  it("rounds to nearest minute", () => {
    expect(msToIcsDuration(45 * 60_000 + 30_000)).toBe("PT46M");
  });

  it("returns PT0M for zero", () => {
    expect(msToIcsDuration(0)).toBe("PT0M");
  });
});

describe("getEventDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:00:00.000Z"));
  });

  it("returns scheduledDate when present", () => {
    const task = makeTask({ scheduledDate: "2026-03-01", dueDate: "2026-03-05" });
    expect(getEventDate(task)).toBe("2026-03-01");
  });

  it("falls back to dueDate when no scheduledDate", () => {
    const task = makeTask({ scheduledDate: null, dueDate: "2026-03-05" });
    expect(getEventDate(task)).toBe("2026-03-05");
  });

  it("falls back to today when no dates set", () => {
    const task = makeTask({ scheduledDate: null, dueDate: null });
    expect(getEventDate(task)).toBe("2026-02-27");
  });
});

describe("generateIcsString", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:00:00.000Z"));
  });

  it("generates correct DTSTART from scheduledDate", () => {
    const task = makeTask({ scheduledDate: "2026-03-01" });
    const ics = generateIcsString(task);
    expect(ics).toContain("DTSTART:20260301T080000");
  });

  it("includes correct DURATION", () => {
    const task = makeTask({ timeEstimateMs: 2_700_000 }); // 45 min
    const ics = generateIcsString(task);
    expect(ics).toContain("DURATION:PT45M");
  });

  it("escapes SUMMARY", () => {
    const task = makeTask({ title: "Meeting; review, discuss\nfollowup" });
    const ics = generateIcsString(task);
    expect(ics).toContain("SUMMARY:Meeting\\; review\\, discuss\\nfollowup");
  });

  it("maps high priority to 1", () => {
    const task = makeTask({ priority: "high" });
    const ics = generateIcsString(task);
    expect(ics).toContain("PRIORITY:1");
  });

  it("maps medium priority to 5", () => {
    const task = makeTask({ priority: "medium" });
    const ics = generateIcsString(task);
    expect(ics).toContain("PRIORITY:5");
  });

  it("maps low priority to 9", () => {
    const task = makeTask({ priority: "low" });
    const ics = generateIcsString(task);
    expect(ics).toContain("PRIORITY:9");
  });

  it("includes UID with @zactions suffix", () => {
    const task = makeTask({ id: "abc-123" });
    const ics = generateIcsString(task);
    expect(ics).toContain("UID:abc-123@zactions");
  });

  it("wraps in VCALENDAR envelope", () => {
    const task = makeTask();
    const ics = generateIcsString(task);
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("uses CRLF line endings", () => {
    const task = makeTask();
    const ics = generateIcsString(task);
    expect(ics).toContain("\r\n");
    // No bare LF (not preceded by CR)
    const withoutCrlf = ics.replace(/\r\n/g, "");
    expect(withoutCrlf).not.toContain("\n");
  });

  it("throws when timeEstimateMs is null", () => {
    const task = makeTask({ timeEstimateMs: null });
    expect(() => generateIcsString(task)).toThrow("time estimate");
  });
});

describe("sanitizeFilename", () => {
  it("strips invalid filename characters", () => {
    expect(sanitizeFilename('task: "review" <files>')).toBe("task review files");
  });

  it("collapses whitespace", () => {
    expect(sanitizeFilename("a   b\t c")).toBe("a b c");
  });

  it("truncates to 50 characters", () => {
    const long = "a".repeat(100);
    expect(sanitizeFilename(long).length).toBe(50);
  });
});

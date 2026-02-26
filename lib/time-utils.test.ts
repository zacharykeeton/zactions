import { describe, it, expect } from "vitest";
import { formatDuration } from "./time-utils";

describe("formatDuration", () => {
  it("returns 0:00 for 0 milliseconds", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("returns 0:01 for 1 second", () => {
    expect(formatDuration(1000)).toBe("0:01");
  });

  it("returns 0:59 for 59 seconds", () => {
    expect(formatDuration(59_000)).toBe("0:59");
  });

  it("returns 1:00 for exactly 60 seconds", () => {
    expect(formatDuration(60_000)).toBe("1:00");
  });

  it("returns 1:05 with zero-padded seconds", () => {
    expect(formatDuration(65_000)).toBe("1:05");
  });

  it("returns 59:59 for just under an hour", () => {
    expect(formatDuration(3_599_000)).toBe("59:59");
  });

  it("switches to H:MM:SS format at exactly 1 hour", () => {
    expect(formatDuration(3_600_000)).toBe("1:00:00");
  });

  it("pads minutes and seconds in hour format", () => {
    expect(formatDuration(3_661_000)).toBe("1:01:01");
  });

  it("handles multi-hour durations", () => {
    // 12h 5m 30s = 43,530,000 ms
    expect(formatDuration(43_530_000)).toBe("12:05:30");
  });

  it("truncates sub-second precision (rounds down)", () => {
    expect(formatDuration(1_999)).toBe("0:01");
  });

  it("handles large durations (100+ hours)", () => {
    // 100h 0m 0s
    expect(formatDuration(360_000_000)).toBe("100:00:00");
  });
});

import { describe, expect, it } from "vitest";

import { formatClock, formatMinutes, formatSpan } from "./format";

describe("formatClock", () => {
  it("rounds countdowns up and elapsed time down", () => {
    expect(formatClock(1_500_000, "up")).toBe("25:00");
    expect(formatClock(1_499_001, "up")).toBe("25:00");
    expect(formatClock(1_499_001, "down")).toBe("24:59");
    expect(formatClock(0, "up")).toBe("00:00");
  });

  it("includes hours only when needed", () => {
    expect(formatClock(3_600_000, "down")).toBe("1:00:00");
    expect(formatClock(5_430_000, "down")).toBe("1:30:30");
  });
});

describe("formatSpan", () => {
  it("formats seconds, minutes, and hours", () => {
    expect(formatSpan(0)).toBe("0s");
    expect(formatSpan(42_000)).toBe("42s");
    expect(formatSpan(728_000)).toBe("12m 08s");
    expect(formatSpan(3_840_000)).toBe("1h 04m");
  });
});

describe("formatMinutes", () => {
  it("formats durations for display", () => {
    expect(formatMinutes(25)).toBe("25 min");
    expect(formatMinutes(60)).toBe("1 hour");
    expect(formatMinutes(90)).toBe("1 hr 30 min");
  });
});

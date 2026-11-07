import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFocusSession } from "./useFocusSession";

describe("useFocusSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T09:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down and completes automatically", () => {
    const { result } = renderHook(() => useFocusSession());

    act(() => {
      result.current.start({ intention: "Study DBMS", plannedMinutes: 1 });
    });

    expect(result.current.remainingMs).toBe(60_000);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.remainingMs).toBe(30_000);
    expect(result.current.progress).toBeCloseTo(0.5);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.state.status).toBe("completed");
    expect(result.current.elapsedMs).toBe(60_000);
    expect(result.current.remainingMs).toBe(0);
  });

  it("freezes the elapsed time while paused and resumes from it", () => {
    const { result } = renderHook(() => useFocusSession());

    act(() => {
      result.current.start({ intention: "Read", plannedMinutes: 10 });
      vi.advanceTimersByTime(60_000);
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.state.status).toBe("paused");
    expect(result.current.elapsedMs).toBe(60_000);

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(result.current.elapsedMs).toBe(60_000);

    act(() => {
      result.current.resume();
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.elapsedMs).toBe(90_000);
    expect(result.current.remainingMs).toBe(510_000);
  });
});

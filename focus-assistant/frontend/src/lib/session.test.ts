import { describe, expect, it } from "vitest";

import {
  getElapsedMs,
  getProgress,
  getRemainingMs,
  initialSessionState,
  isValidDuration,
  isValidIntention,
  sessionReducer,
} from "./session";

const T0 = 1_700_000_000_000;
const MINUTE = 60_000;

function start(minutes = 25, intention = "  Study DBMS  ") {
  return sessionReducer(initialSessionState, {
    type: "start",
    config: { intention, plannedMinutes: minutes },
    now: T0,
  });
}

describe("sessionReducer", () => {
  it("starts a session with a trimmed intention and planned time", () => {
    const state = start();

    expect(state.status).toBe("running");
    expect(state.intention).toBe("Study DBMS");
    expect(state.plannedMinutes).toBe(25);
    expect(state.plannedMs).toBe(25 * MINUTE);
    expect(state.sessionStartedAt).toBe(T0);
    expect(state.startedAt).toBe(T0);
  });

  it("excludes paused wall-clock time from elapsed time", () => {
    const started = start();
    const paused = sessionReducer(
      started,
      { type: "pause", now: T0 + 10 * MINUTE },
    );
    const resumed = sessionReducer(
      paused,
      { type: "resume", now: T0 + 15 * MINUTE },
    );

    expect(paused.status).toBe("paused");
    expect(paused.accumulatedMs).toBe(10 * MINUTE);
    expect(paused.startedAt).toBeNull();
    expect(paused.sessionStartedAt).toBe(T0);

    expect(getElapsedMs(resumed, T0 + 17 * MINUTE)).toBe(12 * MINUTE);
    expect(getRemainingMs(resumed, T0 + 17 * MINUTE)).toBe(13 * MINUTE);
    expect(getProgress(resumed, T0 + 17 * MINUTE)).toBeCloseTo(12 / 25);
  });

  it("completes automatically when the planned duration is reached", () => {
    const started = start(1);

    const justBefore = sessionReducer(
      started,
      { type: "tick", now: T0 + MINUTE - 1 },
    );
    expect(justBefore.status).toBe("running");

    const finished = sessionReducer(
      started,
      { type: "tick", now: T0 + MINUTE },
    );

    expect(finished.status).toBe("completed");
    expect(finished.endReason).toBe("completed");
    expect(finished.accumulatedMs).toBe(MINUTE);
    expect(finished.startedAt).toBeNull();
    expect(getRemainingMs(finished, T0 + 5 * MINUTE)).toBe(0);
  });

  it("ends early and keeps the active time", () => {
    const started = start(25);
    const ended = sessionReducer(
      started,
      { type: "end", now: T0 + 4 * MINUTE },
    );

    expect(ended.status).toBe("completed");
    expect(ended.endReason).toBe("ended");
    expect(ended.accumulatedMs).toBe(4 * MINUTE);
    expect(ended.endedAt).toBe(T0 + 4 * MINUTE);
  });

  it("ends a paused session without adding paused time", () => {
    const started = start(25);
    const paused = sessionReducer(
      started,
      { type: "pause", now: T0 + 3 * MINUTE },
    );
    const ended = sessionReducer(
      paused,
      { type: "end", now: T0 + 30 * MINUTE },
    );

    expect(ended.accumulatedMs).toBe(3 * MINUTE);
    expect(ended.endReason).toBe("ended");
  });

  it("completes instead of pausing if the planned time has elapsed", () => {
    const started = start(1);
    const paused = sessionReducer(
      started,
      { type: "pause", now: T0 + MINUTE + 500 },
    );

    expect(paused.status).toBe("completed");
    expect(paused.accumulatedMs).toBe(MINUTE);
    expect(paused.endReason).toBe("completed");
  });

  it("clamps out-of-range durations", () => {
    expect(start(999).plannedMinutes).toBe(480);
    expect(start(0).plannedMinutes).toBe(1);
  });

  it("ignores pause, resume, and end while idle", () => {
    expect(
      sessionReducer(initialSessionState, { type: "pause", now: T0 }).status,
    ).toBe("idle");
    expect(
      sessionReducer(initialSessionState, { type: "resume", now: T0 }).status,
    ).toBe("idle");
    expect(
      sessionReducer(initialSessionState, { type: "end", now: T0 }).status,
    ).toBe("idle");
  });

  it("ends a session as lost when the hangman completes", () => {
    const started = start(25);
    const lost = sessionReducer(
      started,
      { type: "lose", now: T0 + 6 * MINUTE },
    );

    expect(lost.status).toBe("completed");
    expect(lost.endReason).toBe("lost");
    expect(lost.accumulatedMs).toBe(6 * MINUTE);
    expect(lost.endedAt).toBe(T0 + 6 * MINUTE);
  });

  it("ignores lose while idle", () => {
    expect(
      sessionReducer(initialSessionState, { type: "lose", now: T0 }).status,
    ).toBe("idle");
  });

  it("resets to the initial state", () => {
    const ended = sessionReducer(start(), { type: "end", now: T0 + MINUTE });
    expect(sessionReducer(ended, { type: "reset" })).toEqual(initialSessionState);
  });
});

describe("validation helpers", () => {
  it("accepts whole minutes from 1 to 480", () => {
    expect(isValidDuration(1)).toBe(true);
    expect(isValidDuration(480)).toBe(true);
    expect(isValidDuration(0)).toBe(false);
    expect(isValidDuration(481)).toBe(false);
    expect(isValidDuration(2.5)).toBe(false);
    expect(isValidDuration(Number.NaN)).toBe(false);
  });

  it("requires a non-empty intention within the limit", () => {
    expect(isValidIntention("Read chapter 4")).toBe(true);
    expect(isValidIntention("   ")).toBe(false);
    expect(isValidIntention("x".repeat(161))).toBe(false);
  });
});

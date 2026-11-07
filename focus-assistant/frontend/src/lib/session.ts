import type { SessionAction, SessionState } from "../types/session";

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 480;
export const MAX_INTENTION_LENGTH = 160;

export const initialSessionState: SessionState = {
  status: "idle",
  intention: "",
  plannedMinutes: 0,
  plannedMs: 0,
  startedAt: null,
  accumulatedMs: 0,
  endedAt: null,
  endReason: null,
};

export function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(minutes)));
}

export function isValidIntention(intention: string): boolean {
  const trimmed = intention.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_INTENTION_LENGTH;
}

export function isValidDuration(minutes: number): boolean {
  return (
    Number.isInteger(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES
  );
}

export function getElapsedMs(state: SessionState, now: number): number {
  if (state.status === "idle") return 0;

  if (state.status === "completed") {
    return state.accumulatedMs;
  }

  if (state.status === "paused" || state.startedAt === null) {
    return state.accumulatedMs;
  }

  const currentSegment = Math.max(0, now - state.startedAt);
  return Math.min(state.accumulatedMs + currentSegment, state.plannedMs);
}

export function getRemainingMs(state: SessionState, now: number): number {
  if (state.status === "idle") return 0;
  return Math.max(0, state.plannedMs - getElapsedMs(state, now));
}

export function getProgress(state: SessionState, now: number): number {
  if (state.status === "idle" || state.plannedMs <= 0) return 0;
  return Math.min(1, getElapsedMs(state, now) / state.plannedMs);
}

function complete(
  state: SessionState,
  accumulatedMs: number,
  now: number,
  reason: SessionState["endReason"],
): SessionState {
  return {
    ...state,
    status: "completed",
    startedAt: null,
    accumulatedMs: Math.min(accumulatedMs, state.plannedMs),
    endedAt: now,
    endReason: reason,
  };
}

/**
 * Pure session state machine. Durations are based on active time only:
 * time spent paused never counts towards the session.
 */
export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "start": {
      const minutes = clampMinutes(action.config.plannedMinutes);
      return {
        status: "running",
        intention: action.config.intention.trim(),
        plannedMinutes: minutes,
        plannedMs: minutes * 60_000,
        startedAt: action.now,
        accumulatedMs: 0,
        endedAt: null,
        endReason: null,
      };
    }

    case "pause": {
      if (state.status !== "running" || state.startedAt === null) return state;

      const accumulatedMs = Math.min(
        state.accumulatedMs + Math.max(0, action.now - state.startedAt),
        state.plannedMs,
      );

      if (accumulatedMs >= state.plannedMs) {
        return complete(state, state.plannedMs, action.now, "completed");
      }

      return {
        ...state,
        status: "paused",
        startedAt: null,
        accumulatedMs,
      };
    }

    case "resume": {
      if (state.status !== "paused") return state;
      return { ...state, status: "running", startedAt: action.now };
    }

    case "tick": {
      if (state.status !== "running" || state.startedAt === null) return state;

      const elapsed =
        state.accumulatedMs + Math.max(0, action.now - state.startedAt);

      if (elapsed >= state.plannedMs) {
        return complete(state, state.plannedMs, action.now, "completed");
      }

      return state;
    }

    case "end": {
      if (state.status === "idle" || state.status === "completed") return state;

      const elapsed =
        state.status === "running" && state.startedAt !== null
          ? state.accumulatedMs + Math.max(0, action.now - state.startedAt)
          : state.accumulatedMs;

      return complete(
        state,
        elapsed,
        action.now,
        elapsed >= state.plannedMs ? "completed" : "ended",
      );
    }

    case "reset":
      return initialSessionState;

    default:
      return state;
  }
}

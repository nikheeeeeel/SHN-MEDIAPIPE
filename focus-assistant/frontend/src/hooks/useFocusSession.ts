import { useCallback, useEffect, useReducer, useState } from "react";

import {
  getElapsedMs,
  getProgress,
  getRemainingMs,
  initialSessionState,
  sessionReducer,
} from "../lib/session";
import type { SessionConfig, SessionState } from "../types/session";

const TICK_INTERVAL_MS = 250;

export interface UseFocusSessionResult {
  state: SessionState;
  elapsedMs: number;
  remainingMs: number;
  progress: number;
  start: (config: SessionConfig) => void;
  pause: () => void;
  resume: () => void;
  end: () => void;
  reset: () => void;
}

/**
 * Owns the session clock. Wall-clock time while paused is excluded, and the
 * session completes automatically when the planned duration is reached.
 */
export function useFocusSession(): UseFocusSessionResult {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state.status !== "running") return;

    setNow(Date.now());

    const id = window.setInterval(() => {
      const tickedAt = Date.now();
      setNow(tickedAt);
      dispatch({ type: "tick", now: tickedAt });
    }, TICK_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [state.status]);

  const start = useCallback((config: SessionConfig) => {
    const startedAt = Date.now();
    setNow(startedAt);
    dispatch({ type: "start", config, now: startedAt });
  }, []);

  const pause = useCallback(() => {
    const pausedAt = Date.now();
    setNow(pausedAt);
    dispatch({ type: "pause", now: pausedAt });
  }, []);

  const resume = useCallback(() => {
    const resumedAt = Date.now();
    setNow(resumedAt);
    dispatch({ type: "resume", now: resumedAt });
  }, []);

  const end = useCallback(() => {
    const endedAt = Date.now();
    setNow(endedAt);
    dispatch({ type: "end", now: endedAt });
  }, []);

  const reset = useCallback(() => {
    setNow(Date.now());
    dispatch({ type: "reset" });
  }, []);

  return {
    state,
    elapsedMs: getElapsedMs(state, now),
    remainingMs: getRemainingMs(state, now),
    progress: getProgress(state, now),
    start,
    pause,
    resume,
    end,
    reset,
  };
}

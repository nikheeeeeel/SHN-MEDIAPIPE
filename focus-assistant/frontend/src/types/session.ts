export type SessionStatus = "idle" | "running" | "paused" | "completed";

export type SessionEndReason = "completed" | "ended" | "lost";

export interface SessionConfig {
  intention: string;
  plannedMinutes: number;
}

export interface SessionState {
  status: SessionStatus;
  intention: string;
  plannedMinutes: number;
  plannedMs: number;
  /** Wall-clock timestamp when this session first began. Stable across pauses. */
  sessionStartedAt: number | null;
  /** Timestamp when the current running segment began. */
  startedAt: number | null;
  /** Active time accumulated across previous running segments. */
  accumulatedMs: number;
  endedAt: number | null;
  endReason: SessionEndReason | null;
}

export type SessionAction =
  | { type: "start"; config: SessionConfig; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "tick"; now: number }
  | { type: "end"; now: number }
  | { type: "lose"; now: number }
  | { type: "reset" };

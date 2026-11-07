export type StoredSessionOutcome = "completed" | "ended" | "lost";

export type SessionSaveState = "idle" | "saving" | "saved" | "error";

export interface StoredSession {
  id?: number;
  intention: string;
  plannedSeconds: number;
  actualSeconds: number;
  attentiveSeconds: number | null;
  awaySeconds: number | null;
  reminders: number;
  hangmanParts: number;
  outcome: StoredSessionOutcome;
  startedAt: string;
  endedAt: string;
}

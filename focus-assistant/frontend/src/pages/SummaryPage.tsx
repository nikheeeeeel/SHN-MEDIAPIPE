import {
  CheckCircle2,
  Flag,
  Info,
  RotateCcw,
  Skull,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

import { Hangman } from "../components/Hangman";
import { formatMinutes, formatSpan } from "../lib/format";
import { HANGMAN_MAX_PARTS, hangmanParts } from "../lib/hangman";
import type { SessionSaveState } from "../types/history";
import type { SessionState } from "../types/session";

interface SummaryPageProps {
  state: SessionState;
  elapsedMs: number;
  reminders: number;
  awayMs: number;
  monitoredMs: number;
  monitoringError: string | null;
  gazeWasAvailable: boolean;
  saveState: SessionSaveState;
  onRestart: () => void;
}

function SummaryStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="bg-panel px-5 py-6 sm:px-6">
      <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
        {label}
      </dt>
      <dd className="mt-2 text-lg font-medium tracking-[-0.02em] text-ink/90">
        {value}
      </dd>
      {detail && <p className="mt-1 text-[10px] text-faint">{detail}</p>}
    </div>
  );
}

export function SummaryPage({
  state,
  elapsedMs,
  reminders,
  awayMs,
  monitoredMs,
  monitoringError,
  gazeWasAvailable,
  saveState,
  onRestart,
}: SummaryPageProps) {
  const lost = state.endReason === "lost";
  const completed = state.endReason === "completed";
  const measured = monitoredMs >= 1000;
  const coverage = Math.min(1, monitoredMs / Math.max(1, elapsedMs));
  const attentiveMs = Math.max(0, monitoredMs - awayMs);
  const estimateDetail = gazeWasAvailable
    ? "Approximate · face presence + gaze"
    : "Approximate · face presence only";
  const saveMessage =
    saveState === "saving"
      ? "Saving to local history…"
      : saveState === "saved"
        ? "Saved to local history"
        : saveState === "error"
          ? "Could not save to local history"
          : "Not saved yet";

  const endedAt = state.endedAt
    ? new Date(state.endedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="eyebrow">
        {lost ? (
          <Skull aria-hidden="true" className="size-3.5 text-danger" />
        ) : completed ? (
          <CheckCircle2 aria-hidden="true" className="size-3.5" />
        ) : (
          <Flag aria-hidden="true" className="size-3.5" />
        )}
        {lost
          ? "Hangman complete"
          : completed
            ? "Session complete"
            : "Session ended early"}
      </p>

      <h1 className="mt-3 text-[clamp(1.9rem,4vw,2.6rem)] font-semibold leading-tight tracking-[-0.035em] text-ink">
        {lost
          ? "You lost."
          : completed
            ? "You made it to the end."
            : "That's okay — you stopped."}
      </h1>
      <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-muted">
        {lost
          ? `Six flags completed the hangman, so the session ended automatically. The time and your intention are below.`
          : completed
            ? "Take a moment before moving on. Here's what this session looked like."
            : "A short session still counts. Come back to it when you're ready."}
      </p>

      {lost && (
        <section className="panel mt-5 flex items-center gap-5 p-5">
          <Hangman
            flags={reminders}
            tone="danger"
            className="h-28 w-28 text-danger"
          />
          <div>
            <p className="text-sm font-medium text-danger">
              {hangmanParts(reminders)}/{HANGMAN_MAX_PARTS} flags
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Every away or gaze flag drew another part. The sixth flag ended
              the session on its own.
            </p>
          </div>
        </section>
      )}

      <section className="panel mt-7 overflow-hidden">
        <div className="border-b border-line/70 px-6 py-6 sm:px-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-faint">
            Your intention
          </p>
          <p className="mt-2 text-xl font-medium leading-snug tracking-[-0.02em] text-ink">
            “{state.intention}”
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-px bg-line/60 sm:grid-cols-3">
          <SummaryStat
            label="Planned duration"
            value={formatMinutes(state.plannedMinutes)}
          />
          <SummaryStat
            label="Actual session"
            value={formatSpan(elapsedMs)}
            detail="Active time, pauses excluded"
          />
          <SummaryStat label="Reminders displayed" value={String(reminders)} />
          <SummaryStat
            label="Estimated attentive"
            value={
              measured ? (
                formatSpan(attentiveMs)
              ) : (
                <span className="text-muted">Not measured</span>
              )
            }
            detail={measured ? estimateDetail : undefined}
          />
          <SummaryStat
            label="Estimated time away"
            value={
              measured ? (
                formatSpan(awayMs)
              ) : (
                <span className="text-muted">Not measured</span>
              )
            }
            detail={measured ? estimateDetail : undefined}
          />
          <SummaryStat label="Ended at" value={endedAt} />
        </dl>

        {measured && (
          <div className="border-t border-line/60 px-6 py-3 text-[10px] leading-relaxed text-faint sm:px-8">
            Monitoring covered about {Math.round(coverage * 100)}% of this
            session&apos;s active time. Face presence and approximate gaze
            direction are not measures of concentration.
          </div>
        )}
      </section>

      {monitoringError && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-warn/20 bg-warn/[0.045] p-4">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warn"
          />
          <p className="text-[11px] leading-relaxed text-muted">
            Monitoring stopped before the session ended: {monitoringError}
          </p>
        </div>
      )}

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line/70 bg-white/[0.015] p-4">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-focus/70" />
        <p className="text-[11px] leading-relaxed text-muted">
          Attention statistics are approximate and describe estimated attention,
          never task completion or productivity. In this build, attentive time
          is inferred from face presence and, when calibration succeeds,
          approximate iris-based gaze direction. They do not measure
          concentration. No camera footage was recorded, stored, or sent
          anywhere.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p
          aria-live="polite"
          className={`text-[11px] ${
            saveState === "error" ? "text-danger" : "text-faint"
          }`}
        >
          {saveMessage}
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="flex h-11 items-center gap-2 rounded-xl bg-focus px-5 text-sm font-semibold text-canvas transition-colors hover:bg-focus-strong"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Start another session
        </button>
      </div>
    </div>
  );
}

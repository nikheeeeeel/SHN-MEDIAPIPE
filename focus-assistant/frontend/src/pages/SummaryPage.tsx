import {
  CheckCircle2,
  Flag,
  Info,
  RotateCcw,
} from "lucide-react";
import type { ReactNode } from "react";

import { formatMinutes, formatSpan } from "../lib/format";
import type { SessionState } from "../types/session";

interface SummaryPageProps {
  state: SessionState;
  elapsedMs: number;
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

export function SummaryPage({ state, elapsedMs, onRestart }: SummaryPageProps) {
  const completed = state.endReason === "completed";
  const endedAt = state.endedAt
    ? new Date(state.endedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="eyebrow">
        {completed ? (
          <CheckCircle2 aria-hidden="true" className="size-3.5" />
        ) : (
          <Flag aria-hidden="true" className="size-3.5" />
        )}
        {completed ? "Session complete" : "Session ended early"}
      </p>

      <h1 className="mt-3 text-[clamp(1.9rem,4vw,2.6rem)] font-semibold leading-tight tracking-[-0.035em] text-ink">
        {completed ? "You made it to the end." : "That's okay — you stopped."}
      </h1>
      <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-muted">
        {completed
          ? "Take a moment before moving on. Here's what this session looked like."
          : "A short session still counts. Come back to it when you're ready."}
      </p>

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
          <SummaryStat label="Reminders displayed" value="0" />
          <SummaryStat
            label="Estimated attentive"
            value={<span className="text-muted">Not measured</span>}
            detail="Requires face monitoring"
          />
          <SummaryStat
            label="Estimated time away"
            value={<span className="text-muted">Not measured</span>}
            detail="Requires face monitoring"
          />
          <SummaryStat label="Ended at" value={endedAt} />
        </dl>
      </section>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line/70 bg-white/[0.015] p-4">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-focus/70" />
        <p className="text-[11px] leading-relaxed text-muted">
          Attention statistics are approximate and describe estimated attention,
          never task completion or productivity. In this build face monitoring
          is not connected, so attentive time could not be estimated. No camera
          footage was recorded, stored, or sent anywhere.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-faint">
          This session was not saved to history in this build.
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

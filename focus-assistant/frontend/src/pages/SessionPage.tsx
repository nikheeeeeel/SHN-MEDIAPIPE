import {
  CameraOff,
  Info,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ProgressRing } from "../components/ProgressRing";
import type { UseFocusSessionResult } from "../hooks/useFocusSession";
import { formatClock, formatMinutes } from "../lib/format";

interface SessionPageProps {
  session: UseFocusSessionResult;
}

export function SessionPage({ session }: SessionPageProps) {
  const {
    state,
    elapsedMs,
    remainingMs,
    progress,
    pause,
    resume,
    end,
  } = session;
  const running = state.status === "running";
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  useEffect(() => {
    setConfirmingEnd(false);
  }, [state.status]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <section className="panel relative flex flex-col items-center justify-center overflow-hidden px-6 py-8 sm:px-10 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-focus/[0.035] blur-3xl"
        />

        <div
          role="status"
          className={`relative flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] ${
            running
              ? "border-focus/20 bg-focus/[0.06] text-focus/90"
              : "border-warn/20 bg-warn/[0.06] text-warn"
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${
              running ? "animate-pulse bg-focus" : "bg-warn"
            }`}
          />
          {running ? "Focus session in progress" : "Session paused"}
        </div>

        <div className="relative mt-6">
          <ProgressRing progress={progress} paused={!running}>
            <span className="text-[10px] font-medium uppercase tracking-[0.26em] text-faint">
              {running ? "remaining" : "paused"}
            </span>
            <span
              role="timer"
              aria-live="off"
              className="mt-1.5 font-mono text-[clamp(2.8rem,6vw,3.8rem)] font-light leading-none tracking-[-0.05em] tabular-nums text-ink"
            >
              {formatClock(remainingMs, "up")}
            </span>
            <span className="mt-2.5 text-[11px] text-muted">
              of {formatMinutes(state.plannedMinutes)}
            </span>
          </ProgressRing>
        </div>

        <div className="relative mt-7 w-full max-w-sm">
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={running ? pause : resume}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-focus text-sm font-semibold text-canvas transition-colors hover:bg-focus-strong"
            >
              {running ? (
                <Pause aria-hidden="true" className="size-4" />
              ) : (
                <Play aria-hidden="true" className="size-4" />
              )}
              {running ? "Pause session" : "Resume session"}
            </button>

            <button
              type="button"
              onClick={() => setConfirmingEnd(true)}
              disabled={confirmingEnd}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.02] px-4 text-sm text-muted transition-colors hover:border-danger/30 hover:bg-danger/[0.05] hover:text-danger disabled:pointer-events-none disabled:opacity-40"
            >
              <Square aria-hidden="true" className="size-3.5" />
              End
            </button>
          </div>

          {confirmingEnd && (
            <div className="mt-3 rounded-2xl border border-danger/20 bg-danger/[0.045] p-4">
              <p className="text-xs leading-relaxed text-muted">
                End this session now? You&apos;ll see a summary of the time so
                far.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={end}
                  className="h-9 flex-1 rounded-lg bg-danger text-xs font-semibold text-canvas transition-colors hover:bg-danger/90"
                >
                  End session
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingEnd(false)}
                  className="h-9 flex-1 rounded-lg border border-line bg-white/[0.02] text-xs text-muted transition-colors hover:text-ink"
                >
                  Keep going
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-5">
        <section className="panel p-6">
          <p className="eyebrow">You&apos;re here to</p>
          <p className="mt-2.5 text-xl font-medium leading-snug tracking-[-0.02em] text-ink">
            {state.intention}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-line/70 bg-canvas/40 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
                Elapsed
              </p>
              <p className="mt-1 font-mono text-lg tabular-nums text-ink/90">
                {formatClock(elapsedMs)}
              </p>
            </div>
            <div className="rounded-xl border border-line/70 bg-canvas/40 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
                Planned
              </p>
              <p className="mt-1 font-mono text-lg tabular-nums text-ink/90">
                {formatMinutes(state.plannedMinutes)}
              </p>
            </div>
          </div>
        </section>

        <section className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Monitoring
            </h2>
            <span className="flex items-center gap-1.5 rounded-full border border-line/80 px-2.5 py-1 text-[10px] text-faint">
              <CameraOff aria-hidden="true" className="size-3" />
              Camera off
            </span>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Face and gaze monitoring is not connected in this build. The camera
            is not in use and no footage is captured.
          </p>

          <p className="mt-4 flex items-start gap-2 border-t border-line/60 pt-3 text-[10px] leading-relaxed text-faint">
            <Info aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
            The timer keeps running when you switch windows.
          </p>
        </section>
      </aside>
    </div>
  );
}

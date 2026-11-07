import {
  Camera,
  CameraOff,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  Pause,
  Play,
  ShieldCheck,
  Square,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Hangman } from "../components/Hangman";
import { ProgressRing } from "../components/ProgressRing";
import type { MonitoringResult } from "../hooks/useMonitoring";
import type { UseFocusSessionResult } from "../hooks/useFocusSession";
import { formatClock, formatMinutes } from "../lib/format";
import {
  hangmanParts,
  hangmanRemaining,
  HANGMAN_MAX_PARTS,
} from "../lib/hangman";

interface SessionPageProps {
  session: UseFocusSessionResult;
  monitoring: MonitoringResult;
  flags: number;
  absenceThresholdSeconds: number;
  gazeThresholdSeconds: number;
}

export function SessionPage({
  session,
  monitoring,
  flags,
  absenceThresholdSeconds,
  gazeThresholdSeconds,
}: SessionPageProps) {
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

  const cameraActive = monitoring.status === "active";
  const cameraCalibrating = monitoring.status === "calibrating";
  const cameraStarting = monitoring.status === "starting";
  const cameraError = monitoring.status === "error";

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
            <MonitoringBadge
              active={cameraActive}
              calibrating={cameraCalibrating}
              starting={cameraStarting}
              failed={cameraError}
            />
          </div>

          <div className="mt-3 min-h-[58px]">
            {cameraCalibrating && (
              <>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${
                      monitoring.facePresent
                        ? "animate-pulse bg-focus"
                        : "animate-pulse bg-warn"
                    }`}
                  />
                  <p className="text-sm font-medium text-ink/90">
                    {monitoring.facePresent
                      ? "Calibrating gaze"
                      : "Waiting for your face"}
                  </p>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  Look at the centre of the screen and hold still for a few
                  seconds. Face monitoring is already running.
                </p>
                <div
                  role="progressbar"
                  aria-label="Gaze calibration progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(
                    monitoring.calibrationProgress * 100,
                  )}
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
                >
                  <div
                    className="h-full rounded-full bg-focus transition-[width] duration-200"
                    style={{
                      width: `${Math.round(
                        monitoring.calibrationProgress * 100,
                      )}%`,
                    }}
                  />
                </div>
              </>
            )}

            {cameraActive && (
              <>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${
                      monitoring.facePresent
                        ? "bg-focus"
                        : "animate-pulse bg-warn"
                    }`}
                  />
                  <p className="text-sm font-medium text-ink/90">
                    {monitoring.facePresent
                      ? "Face detected"
                      : "No face detected"}
                  </p>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  {monitoring.facePresent
                    ? "Frames are processed locally and never saved."
                    : `Away for ${formatClock(
                        monitoring.absenceSeconds * 1000,
                      )}. A gentle nudge appears after ${
                        absenceThresholdSeconds
                      } sec without a face.`}
                </p>

                <div className="mt-3 border-t border-line/60 pt-3">
                  {monitoring.gazeAvailable ? (
                    <>
                      <div className="flex items-center gap-2">
                        {monitoring.gazeAway ? (
                          <EyeOff
                            aria-hidden="true"
                            className="size-3.5 text-warn"
                          />
                        ) : (
                          <Eye
                            aria-hidden="true"
                            className="size-3.5 text-focus/80"
                          />
                        )}
                        <p className="text-sm font-medium text-ink/90">
                          {!monitoring.facePresent
                            ? "Gaze paused"
                            : monitoring.gazeAway
                              ? "Estimated gaze away"
                              : "Gaze toward screen"}
                        </p>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                        {!monitoring.facePresent
                          ? "Gaze estimation resumes when your face returns."
                          : monitoring.gazeAway
                            ? `Estimated gaze away for ${formatClock(
                                monitoring.gazeAwaySeconds * 1000,
                              )}. A focus reminder appears after ${gazeThresholdSeconds} sec.`
                            : "Approximate iris tracking is active. Small movements and blinks are ignored."}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <EyeOff
                          aria-hidden="true"
                          className="size-3.5 text-faint"
                        />
                        <p className="text-sm font-medium text-ink/80">
                          Gaze estimation unavailable
                        </p>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                        {monitoring.gazeReason ||
                          "Using face presence only for this session."}
                      </p>
                      <p className="mt-1.5 text-[10px] text-faint">
                        Pause and resume to try calibration again, or end the
                        session to change settings.
                      </p>
                    </>
                  )}
                </div>
              </>
            )}

            {cameraStarting && (
              <p className="text-[11px] leading-relaxed text-muted">
                Opening the local camera and loading the face model. This can
                take a moment.
              </p>
            )}

            {cameraError && (
              <>
                <p className="text-sm font-medium text-danger">
                  Monitoring stopped
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  {monitoring.error ??
                    "The local monitoring process could not start."}
                </p>
                <p className="mt-2 text-[10px] text-faint">
                  Your timer keeps running. Pause and resume to retry, or end
                  the session to change settings.
                </p>
              </>
            )}

            {!cameraActive &&
              !cameraCalibrating &&
              !cameraStarting &&
              !cameraError && (
                <>
                  <p className="text-sm font-medium text-ink/80">
                    Monitoring inactive
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                    Face and gaze monitoring are available in the desktop app.
                    The camera is not in use.
                  </p>
                </>
              )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/60 pt-3 text-[10px] text-faint">
            <span className="flex items-center gap-1.5">
              <ShieldCheck aria-hidden="true" className="size-3" />
              Local processing only
            </span>
            <span>
              {monitoring.reminders > 0
                ? `${monitoring.reminders} reminder${
                    monitoring.reminders === 1 ? "" : "s"
                  } shown`
                : "No reminders yet"}
            </span>
          </div>

          <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-faint">
            <Info aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
            The timer keeps running when you switch windows. The camera is
            released when you pause or end.
          </p>
        </section>

        <section className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Hangman
            </h2>
            <span
              className={`font-mono text-[11px] tabular-nums ${
                flags >= HANGMAN_MAX_PARTS - 1 ? "text-danger" : "text-faint"
              }`}
            >
              {hangmanParts(flags)}/{HANGMAN_MAX_PARTS} flags
            </span>
          </div>

          <div className="mt-3 flex items-center gap-5">
            <Hangman
              flags={flags}
              tone={flags >= HANGMAN_MAX_PARTS - 1 ? "danger" : "warn"}
              className="h-28 w-28 text-warn"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink/90">
                {flags === 0
                  ? "No flags yet"
                  : hangmanRemaining(flags) === 0
                    ? "Hangman complete"
                    : `${hangmanRemaining(flags)} part${
                        hangmanRemaining(flags) === 1 ? "" : "s"
                      } left`}
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
                Each away or gaze flag draws one part. Six flags end the
                session automatically.
              </p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

function MonitoringBadge({
  active,
  calibrating,
  starting,
  failed,
}: {
  active: boolean;
  calibrating: boolean;
  starting: boolean;
  failed: boolean;
}) {
  if (failed) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-danger/20 bg-danger/[0.05] px-2.5 py-1 text-[10px] text-danger">
        <TriangleAlert aria-hidden="true" className="size-3" />
        Camera unavailable
      </span>
    );
  }

  if (active) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-focus/20 bg-focus/[0.06] px-2.5 py-1 text-[10px] text-focus/90">
        <Camera aria-hidden="true" className="size-3" />
        Camera on
      </span>
    );
  }

  if (calibrating) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-focus/20 bg-focus/[0.06] px-2.5 py-1 text-[10px] text-focus/90">
        <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
        Calibrating gaze
      </span>
    );
  }

  if (starting) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-warn/20 bg-warn/[0.06] px-2.5 py-1 text-[10px] text-warn">
        <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
        Starting camera
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 rounded-full border border-line/80 px-2.5 py-1 text-[10px] text-faint">
      <CameraOff aria-hidden="true" className="size-3" />
      Camera off
    </span>
  );
}

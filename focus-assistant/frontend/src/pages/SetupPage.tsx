import {
  ArrowRight,
  CameraOff,
  Check,
  LockKeyhole,
  Target,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { formatMinutes } from "../lib/format";
import {
  isValidDuration,
  isValidIntention,
  MAX_INTENTION_LENGTH,
} from "../lib/session";
import type { SessionConfig } from "../types/session";

const DURATION_PRESETS = [15, 25, 45, 60, 90];

interface SetupPageProps {
  onStart: (config: SessionConfig) => void;
}

export function SetupPage({ onStart }: SetupPageProps) {
  const [intention, setIntention] = useState("");
  const [duration, setDuration] = useState("25");

  const plannedMinutes = Number(duration);
  const durationValid = isValidDuration(plannedMinutes);
  const intentionValid = isValidIntention(intention);
  const canStart = intentionValid && durationValid;
  const preview = intention.trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStart) return;
    onStart({ intention: intention.trim(), plannedMinutes });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)] lg:items-start">
      <form className="panel p-6 sm:p-9" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">
          <Target aria-hidden="true" className="size-3.5" />
          New focus session
        </p>

        <h1 className="mt-4 max-w-lg text-[clamp(2rem,4.2vw,2.85rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-ink">
          What are you <span className="text-focus">here to do?</span>
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          One clear intention. Focus will help you notice when you drift and
          gently guide you back.
        </p>

        <div className="mt-8">
          <div className="flex items-baseline justify-between gap-4">
            <label
              htmlFor="intention"
              className="text-xs font-medium uppercase tracking-[0.14em] text-muted"
            >
              Your intention
            </label>
            <span className="font-mono text-[10px] tabular-nums text-faint">
              {intention.length}/{MAX_INTENTION_LENGTH}
            </span>
          </div>
          <textarea
            id="intention"
            name="intention"
            rows={2}
            autoFocus
            maxLength={MAX_INTENTION_LENGTH}
            value={intention}
            onChange={(event) => setIntention(event.target.value)}
            placeholder="Study DBMS — chapters 4 and 5"
            className="mt-2.5 w-full resize-none rounded-2xl border border-line bg-canvas/60 px-4 py-3.5 text-[15px] leading-relaxed text-ink placeholder:text-faint transition-colors hover:border-line/90 focus:border-focus/45 focus:bg-canvas/80 focus:outline-none"
          />
        </div>

        <div className="mt-7">
          <div className="flex items-baseline justify-between gap-4">
            <label
              htmlFor="duration"
              className="text-xs font-medium uppercase tracking-[0.14em] text-muted"
            >
              For how long?
            </label>
            <span className="text-[11px] text-faint">1–480 minutes</span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map((preset) => {
              const selected = plannedMinutes === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDuration(String(preset))}
                  className={`h-9 rounded-xl border px-3.5 text-sm transition-colors ${
                    selected
                      ? "border-focus/40 bg-focus/[0.12] text-focus"
                      : "border-line bg-white/[0.015] text-muted hover:border-line/90 hover:bg-white/[0.035] hover:text-ink"
                  }`}
                >
                  {preset} min
                </button>
              );
            })}

            <div className="relative ml-auto">
              <input
                id="duration"
                name="duration"
                type="number"
                inputMode="numeric"
                min={1}
                max={480}
                step={1}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                aria-invalid={!durationValid}
                className="h-9 w-28 rounded-xl border border-line bg-canvas/60 pl-3 pr-11 font-mono text-sm tabular-nums text-ink transition-colors hover:border-line/90 focus:border-focus/45 focus:outline-none aria-[invalid=true]:border-danger/50"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-faint">
                min
              </span>
            </div>
          </div>

          {!durationValid && (
            <p role="alert" className="mt-2.5 text-xs text-danger">
              Choose a whole number between 1 and 480 minutes.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canStart}
          className="group mt-8 flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-focus text-sm font-semibold text-canvas transition-colors hover:bg-focus-strong disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-faint"
        >
          Start focus session
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform group-enabled:group-hover:translate-x-0.5"
          />
        </button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-faint">
          <LockKeyhole aria-hidden="true" className="size-3" />
          You can pause or end at any time.
        </p>
      </form>

      <aside className="space-y-5">
        <section className="panel p-6">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Session brief
          </h2>

          <dl className="mt-4 space-y-3.5 text-sm">
            <div className="flex items-start justify-between gap-5">
              <dt className="shrink-0 text-muted">Intention</dt>
              <dd className="max-w-[62%] text-right leading-snug text-ink/90">
                {preview || <span className="text-faint">Not set</span>}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-5">
              <dt className="text-muted">Duration</dt>
              <dd className="font-mono text-[13px] tabular-nums text-ink/90">
                {durationValid ? formatMinutes(plannedMinutes) : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-5">
              <dt className="text-muted">Camera</dt>
              <dd className="flex items-center gap-1.5 text-[13px] text-faint">
                <CameraOff aria-hidden="true" className="size-3.5" />
                Off
              </dd>
            </div>
          </dl>

          <div className="mt-5 rounded-2xl border border-line/70 bg-canvas/40 p-4">
            <p className="text-xs font-medium text-ink/85">Timer only</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Face and gaze monitoring is not connected in this build. The
              camera is not opened or used during your session.
            </p>
          </div>
        </section>

        <section className="panel p-6">
          <div className="flex items-center gap-2">
            <LockKeyhole aria-hidden="true" className="size-3.5 text-focus/80" />
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Private by design
            </h2>
          </div>
          <ul className="mt-4 space-y-3 text-[11px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-focus/70" />
              Camera frames never leave your computer.
            </li>
            <li className="flex gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-focus/70" />
              Nothing is recorded, saved, or uploaded.
            </li>
            <li className="flex gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-focus/70" />
              The camera will be released whenever monitoring stops.
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

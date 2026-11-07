import {
  ArrowLeft,
  Eye,
  RotateCcw,
  Settings2,
  Timer,
  Video,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  DEFAULT_SETTINGS,
  MAX_ABSENCE_SECONDS,
  MAX_CAMERA_INDEX,
  MAX_COOLDOWN_SECONDS,
  MAX_GAZE_SECONDS,
  MIN_ABSENCE_SECONDS,
  MIN_COOLDOWN_SECONDS,
  MIN_GAZE_SECONDS,
  validateSettings,
} from "../lib/settings";
import type { MonitoringSettings } from "../types/monitoring";

interface SettingsPageProps {
  settings: MonitoringSettings;
  onSave: (settings: MonitoringSettings) => Promise<void>;
  onCancel: () => void;
}

export function SettingsPage({ settings, onSave, onCancel }: SettingsPageProps) {
  const [absenceSeconds, setAbsenceSeconds] = useState(
    String(settings.absenceSeconds),
  );
  const [gazeSeconds, setGazeSeconds] = useState(
    String(settings.gazeAwaySeconds),
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(
    String(settings.cooldownSeconds),
  );
  const [cameraIndex, setCameraIndex] = useState(
    String(settings.cameraIndex),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next: MonitoringSettings = {
      absenceSeconds: Number(absenceSeconds),
      gazeAwaySeconds: Number(gazeSeconds),
      cooldownSeconds: Number(cooldownSeconds),
      cameraIndex: Number(cameraIndex),
    };

    const validationError = validateSettings(next);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(next);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  function restoreDefaults() {
    setAbsenceSeconds(String(DEFAULT_SETTINGS.absenceSeconds));
    setGazeSeconds(String(DEFAULT_SETTINGS.gazeAwaySeconds));
    setCooldownSeconds(String(DEFAULT_SETTINGS.cooldownSeconds));
    setCameraIndex(String(DEFAULT_SETTINGS.cameraIndex));
    setError(null);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        Back to session setup
      </button>

      <p className="eyebrow mt-5">
        <Settings2 aria-hidden="true" className="size-3.5" />
        Monitoring settings
      </p>
      <h1 className="mt-3 text-[clamp(1.8rem,3.6vw,2.3rem)] font-semibold tracking-[-0.035em] text-ink">
        Make the nudges fit you.
      </h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
        These settings apply to your next session. Monitoring only runs while a
        focus session is active.
      </p>

      <form className="panel mt-6 p-6 sm:p-8" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <label
              htmlFor="absence-threshold"
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted"
            >
              <Timer aria-hidden="true" className="size-3.5 text-focus/70" />
              Face absence threshold
            </label>
            <div className="relative mt-2.5">
              <input
                id="absence-threshold"
                type="number"
                inputMode="numeric"
                min={MIN_ABSENCE_SECONDS}
                max={MAX_ABSENCE_SECONDS}
                step={1}
                value={absenceSeconds}
                onChange={(event) => {
                  setAbsenceSeconds(event.target.value);
                  setError(null);
                }}
                className="h-11 w-full rounded-xl border border-line bg-canvas/60 pl-4 pr-14 font-mono text-sm tabular-nums text-ink transition-colors hover:border-line/90 focus:border-focus/45 focus:outline-none"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[11px] text-faint">
                sec
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              How long no face must be detected before the away reminder.
              Default: 120 seconds.
            </p>
          </div>

          <div>
            <label
              htmlFor="gaze-threshold"
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted"
            >
              <Eye aria-hidden="true" className="size-3.5 text-focus/70" />
              Gaze-away threshold
            </label>
            <div className="relative mt-2.5">
              <input
                id="gaze-threshold"
                type="number"
                inputMode="numeric"
                min={MIN_GAZE_SECONDS}
                max={MAX_GAZE_SECONDS}
                step={1}
                value={gazeSeconds}
                onChange={(event) => {
                  setGazeSeconds(event.target.value);
                  setError(null);
                }}
                className="h-11 w-full rounded-xl border border-line bg-canvas/60 pl-4 pr-14 font-mono text-sm tabular-nums text-ink transition-colors hover:border-line/90 focus:border-focus/45 focus:outline-none"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[11px] text-faint">
                sec
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              Continuous estimated gaze-away before a focus reminder. Requires
              calibration. Default: 180 seconds.
            </p>
          </div>

          <div>
            <label
              htmlFor="cooldown-threshold"
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted"
            >
              <Timer aria-hidden="true" className="size-3.5 text-focus/70" />
              Reminder cooldown
            </label>
            <div className="relative mt-2.5">
              <input
                id="cooldown-threshold"
                type="number"
                inputMode="numeric"
                min={MIN_COOLDOWN_SECONDS}
                max={MAX_COOLDOWN_SECONDS}
                step={1}
                value={cooldownSeconds}
                onChange={(event) => {
                  setCooldownSeconds(event.target.value);
                  setError(null);
                }}
                className="h-11 w-full rounded-xl border border-line bg-canvas/60 pl-4 pr-14 font-mono text-sm tabular-nums text-ink transition-colors hover:border-line/90 focus:border-focus/45 focus:outline-none"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[11px] text-faint">
                sec
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              Minimum time between reminders. Default: 300 seconds.
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-line/60 pt-6">
          <label
            htmlFor="camera-index"
            className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted"
          >
            <Video aria-hidden="true" className="size-3.5 text-focus/70" />
            Camera
          </label>
          <div className="mt-2.5 flex items-center gap-3">
            <input
              id="camera-index"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_CAMERA_INDEX}
              step={1}
              value={cameraIndex}
              onChange={(event) => {
                setCameraIndex(event.target.value);
                setError(null);
              }}
              className="h-11 w-24 rounded-xl border border-line bg-canvas/60 px-4 font-mono text-sm tabular-nums text-ink transition-colors hover:border-line/90 focus:border-focus/45 focus:outline-none"
            />
            <p className="max-w-sm text-[10px] leading-relaxed text-faint">
              Camera index. Usually <span className="font-mono">0</span> for a
              built-in webcam. The camera is opened only while monitoring runs.
            </p>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-danger/20 bg-danger/[0.05] px-3.5 py-2.5 text-xs text-danger"
          >
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={restoreDefaults}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white/[0.02] px-3.5 text-xs text-muted transition-colors hover:text-ink"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Restore defaults
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-xl border border-line px-4 text-xs text-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-xl bg-focus px-5 text-xs font-semibold text-canvas transition-colors hover:bg-focus-strong disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

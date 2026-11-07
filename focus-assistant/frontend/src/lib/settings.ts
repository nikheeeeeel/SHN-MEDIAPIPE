import type { MonitoringSettings } from "../types/monitoring";

export const SETTINGS_STORAGE_KEY = "focus.settings.v1";

export const DEFAULT_SETTINGS: MonitoringSettings = {
  absenceSeconds: 120,
  gazeAwaySeconds: 180,
  cooldownSeconds: 300,
  cameraIndex: 0,
};

export const MIN_ABSENCE_SECONDS = 5;
export const MAX_ABSENCE_SECONDS = 3600;
export const MIN_GAZE_SECONDS = 5;
export const MAX_GAZE_SECONDS = 3600;
export const MIN_COOLDOWN_SECONDS = 5;
export const MAX_COOLDOWN_SECONDS = 3600;
export const MAX_CAMERA_INDEX = 8;

export function validateSettings(settings: MonitoringSettings): string | null {
  if (
    !Number.isFinite(settings.absenceSeconds) ||
    settings.absenceSeconds < MIN_ABSENCE_SECONDS ||
    settings.absenceSeconds > MAX_ABSENCE_SECONDS
  ) {
    return `Face absence threshold must be between ${MIN_ABSENCE_SECONDS} and ${MAX_ABSENCE_SECONDS} seconds.`;
  }

  if (
    !Number.isFinite(settings.gazeAwaySeconds) ||
    settings.gazeAwaySeconds < MIN_GAZE_SECONDS ||
    settings.gazeAwaySeconds > MAX_GAZE_SECONDS
  ) {
    return `Gaze-away threshold must be between ${MIN_GAZE_SECONDS} and ${MAX_GAZE_SECONDS} seconds.`;
  }

  if (
    !Number.isFinite(settings.cooldownSeconds) ||
    settings.cooldownSeconds < MIN_COOLDOWN_SECONDS ||
    settings.cooldownSeconds > MAX_COOLDOWN_SECONDS
  ) {
    return `Reminder cooldown must be between ${MIN_COOLDOWN_SECONDS} and ${MAX_COOLDOWN_SECONDS} seconds.`;
  }

  if (
    !Number.isInteger(settings.cameraIndex) ||
    settings.cameraIndex < 0 ||
    settings.cameraIndex > MAX_CAMERA_INDEX
  ) {
    return `Camera index must be a whole number between 0 and ${MAX_CAMERA_INDEX}.`;
  }

  return null;
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function numberOrDefault(
  value: unknown,
  fallback: number,
): number {
  return typeof value === "number" ? value : fallback;
}

export function loadSettings(
  storage: Pick<Storage, "getItem"> | null = defaultStorage(),
): MonitoringSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };

  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw) as Partial<MonitoringSettings>;
    const candidate: MonitoringSettings = {
      absenceSeconds: numberOrDefault(
        parsed.absenceSeconds,
        DEFAULT_SETTINGS.absenceSeconds,
      ),
      gazeAwaySeconds: numberOrDefault(
        parsed.gazeAwaySeconds,
        DEFAULT_SETTINGS.gazeAwaySeconds,
      ),
      cooldownSeconds: numberOrDefault(
        parsed.cooldownSeconds,
        DEFAULT_SETTINGS.cooldownSeconds,
      ),
      cameraIndex: numberOrDefault(
        parsed.cameraIndex,
        DEFAULT_SETTINGS.cameraIndex,
      ),
    };

    return validateSettings(candidate) === null
      ? candidate
      : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(
  settings: MonitoringSettings,
  storage: Pick<Storage, "setItem"> | null = defaultStorage(),
): void {
  if (!storage || validateSettings(settings) !== null) return;
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

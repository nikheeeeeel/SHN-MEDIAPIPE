import { invoke } from "@tauri-apps/api/core";

import {
  DEFAULT_SETTINGS,
  loadSettings as loadLocalSettings,
  saveSettings as saveLocalSettings,
  validateSettings,
} from "../lib/settings";
import type { MonitoringSettings } from "../types/monitoring";
import { isDesktopRuntime } from "./monitoring";

/**
 * Loads settings from SQLite in the desktop app. Browser previews and first-run
 * migrations use the local-storage fallback.
 */
export async function loadSettingsFromStore(): Promise<MonitoringSettings> {
  const local = loadLocalSettings();
  if (!isDesktopRuntime()) return local;

  try {
    const stored = await invoke<MonitoringSettings | null>("load_settings");
    if (!stored) {
      await saveSettingsToStore(local);
      return local;
    }

    const candidate: MonitoringSettings = {
      absenceSeconds: stored.absenceSeconds,
      gazeAwaySeconds: stored.gazeAwaySeconds,
      cooldownSeconds: stored.cooldownSeconds,
      cameraIndex: stored.cameraIndex,
    };
    if (validateSettings(candidate) !== null) {
      await saveSettingsToStore({ ...DEFAULT_SETTINGS });
      return { ...DEFAULT_SETTINGS };
    }

    saveLocalSettings(candidate);
    return candidate;
  } catch {
    return local;
  }
}

export async function saveSettingsToStore(
  settings: MonitoringSettings,
): Promise<void> {
  const validationError = validateSettings(settings);
  if (validationError) throw new Error(validationError);

  if (isDesktopRuntime()) {
    await invoke("save_settings", { settings });
  }
  saveLocalSettings(settings);
}

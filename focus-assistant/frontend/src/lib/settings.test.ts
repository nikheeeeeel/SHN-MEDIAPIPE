import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
  validateSettings,
} from "./settings";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe("monitoring settings", () => {
  it("returns defaults when storage is empty or unavailable", () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips valid settings", () => {
    const storage = memoryStorage();
    const settings = {
      absenceSeconds: 180,
      gazeAwaySeconds: 240,
      cooldownSeconds: 600,
      cameraIndex: 1,
    };

    saveSettings(settings, storage);

    expect(loadSettings(storage)).toEqual(settings);
  });

  it("adds the gaze default to settings saved before gaze existed", () => {
    const storage = memoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        absenceSeconds: 180,
        cooldownSeconds: 600,
        cameraIndex: 0,
      }),
    });

    expect(loadSettings(storage)).toEqual({
      absenceSeconds: 180,
      gazeAwaySeconds: 180,
      cooldownSeconds: 600,
      cameraIndex: 0,
    });
  });

  it("falls back to defaults for corrupt or out-of-range data", () => {
    const corrupt = memoryStorage({ [SETTINGS_STORAGE_KEY]: "not-json" });
    expect(loadSettings(corrupt)).toEqual(DEFAULT_SETTINGS);

    const invalid = memoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        absenceSeconds: 1,
        gazeAwaySeconds: 180,
        cooldownSeconds: 300,
        cameraIndex: 0,
      }),
    });
    expect(loadSettings(invalid)).toEqual(DEFAULT_SETTINGS);
  });

  it("does not save invalid settings", () => {
    const storage = memoryStorage();
    saveSettings(
      {
        absenceSeconds: 0,
        gazeAwaySeconds: 180,
        cooldownSeconds: 300,
        cameraIndex: 0,
      },
      storage,
    );
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it("validates each setting", () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toBeNull();
    expect(
      validateSettings({
        absenceSeconds: 120,
        gazeAwaySeconds: 1,
        cooldownSeconds: 300,
        cameraIndex: 0,
      }),
    ).toMatch(/gaze-away/i);
    expect(
      validateSettings({
        absenceSeconds: 120,
        gazeAwaySeconds: 180,
        cooldownSeconds: 300,
        cameraIndex: -1,
      }),
    ).toMatch(/camera/i);
    expect(
      validateSettings({
        absenceSeconds: 120,
        gazeAwaySeconds: 180,
        cooldownSeconds: 300,
        cameraIndex: 1.5,
      }),
    ).toMatch(/whole number/i);
  });
});

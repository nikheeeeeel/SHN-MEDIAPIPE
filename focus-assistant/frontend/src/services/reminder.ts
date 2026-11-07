import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type { ReminderPayload } from "../types/monitoring";
import { isDesktopRuntime } from "./monitoring";

export async function getReminderPayload(): Promise<ReminderPayload | null> {
  if (!isDesktopRuntime()) {
    throw new Error("The reminder window is only available in the desktop app.");
  }
  return invoke<ReminderPayload | null>("get_reminder_payload");
}

export async function dismissReminder(): Promise<void> {
  if (!isDesktopRuntime()) return;
  await invoke("dismiss_reminder");
}

export async function subscribeToReminderUpdates(
  handler: (payload: ReminderPayload) => void,
): Promise<() => void> {
  if (!isDesktopRuntime()) return () => {};

  const unlisten = await listen<ReminderPayload>("reminder:update", (event) =>
    handler(event.payload),
  );
  return unlisten;
}

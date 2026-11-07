import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  MonitoringErrorPayload,
  MonitoringRequest,
  MonitoringStatusPayload,
  ReminderPayload,
} from "../types/monitoring";

export interface MonitoringHandlers {
  onStatus: (payload: MonitoringStatusPayload) => void;
  onError: (payload: MonitoringErrorPayload) => void;
  onReminder: (payload: ReminderPayload) => void;
}

/** Tauri injects this object into the webview; it is absent in a browser. */
export function isDesktopRuntime(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

export async function startMonitoring(
  request: MonitoringRequest,
): Promise<void> {
  if (!isDesktopRuntime()) {
    throw new Error("Monitoring is only available in the desktop app.");
  }
  await invoke("start_monitoring", { request });
}

export async function stopMonitoring(): Promise<void> {
  if (!isDesktopRuntime()) return;
  await invoke("stop_monitoring");
}

export async function subscribeToMonitoring(
  handlers: MonitoringHandlers,
): Promise<() => void> {
  if (!isDesktopRuntime()) {
    return () => {};
  }

  const unlisteners: UnlistenFn[] = await Promise.all([
    listen<MonitoringStatusPayload>("monitoring:status", (event) =>
      handlers.onStatus(event.payload),
    ),
    listen<MonitoringErrorPayload>("monitoring:error", (event) =>
      handlers.onError(event.payload),
    ),
    listen<ReminderPayload>("monitoring:reminder", (event) =>
      handlers.onReminder(event.payload),
    ),
  ]);

  return () => {
    for (const unlisten of unlisteners) unlisten();
  };
}

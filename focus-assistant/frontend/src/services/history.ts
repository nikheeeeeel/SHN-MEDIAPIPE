import { invoke } from "@tauri-apps/api/core";

import type { StoredSession } from "../types/history";
import { isDesktopRuntime } from "./monitoring";

export async function saveSessionRecord(
  session: StoredSession,
): Promise<number> {
  if (!isDesktopRuntime()) {
    throw new Error("Session history requires the desktop app.");
  }
  return invoke<number>("save_session", { session });
}

export async function listSessionHistory(
  limit = 50,
): Promise<StoredSession[]> {
  if (!isDesktopRuntime()) return [];
  return invoke<StoredSession[]>("list_sessions", { limit });
}

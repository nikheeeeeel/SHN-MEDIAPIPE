import { LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppHeader } from "./components/AppHeader";
import { useFocusSession } from "./hooks/useFocusSession";
import { useMonitoring } from "./hooks/useMonitoring";
import { HANGMAN_MAX_PARTS, hangmanParts } from "./lib/hangman";
import { loadSettings as loadLocalSettings } from "./lib/settings";
import { HistoryPage } from "./pages/HistoryPage";
import { SessionPage } from "./pages/SessionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupPage } from "./pages/SetupPage";
import { SummaryPage } from "./pages/SummaryPage";
import { saveSessionRecord } from "./services/history";
import {
  loadSettingsFromStore,
  saveSettingsToStore,
} from "./services/settings";
import type {
  SessionSaveState,
  StoredSession,
  StoredSessionOutcome,
} from "./types/history";
import type { MonitoringSettings } from "./types/monitoring";

export default function App() {
  const session = useFocusSession();
  const { state } = session;
  const [settings, setSettings] = useState<MonitoringSettings>(() =>
    loadLocalSettings(),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saveState, setSaveState] = useState<SessionSaveState>("idle");
  const savedSessionRef = useRef<number | null>(null);
  const [demoFlags, setDemoFlags] = useState(0);

  const monitoring = useMonitoring({
    sessionStatus: state.status,
    sessionStartedAt: state.sessionStartedAt,
    intention: state.intention,
    settings,
  });
  const flagCount = monitoring.reminders + demoFlags;

  useEffect(() => {
    let cancelled = false;
    loadSettingsFromStore()
      .then((stored) => {
        if (!cancelled) setSettings(stored);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSaveState("idle");
    savedSessionRef.current = null;
    setDemoFlags(0);
  }, [state.sessionStartedAt]);

  // Demo shortcut: Ctrl+Shift+D draws a flag without changing the automatic
  // detection, threshold, or cooldown rules.
  useEffect(() => {
    if (state.status !== "running") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "d"
      ) {
        event.preventDefault();
        setDemoFlags((value) => value + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.status]);

  // The sixth flag completes the hangman and ends the session automatically.
  useEffect(() => {
    if (state.status === "running" && flagCount >= HANGMAN_MAX_PARTS) {
      session.lose();
    }
  }, [state.status, flagCount, session.lose]);

  useEffect(() => {
    if (
      state.status !== "completed" ||
      state.endedAt === null ||
      state.sessionStartedAt === null ||
      savedSessionRef.current === state.endedAt
    ) {
      return;
    }

    savedSessionRef.current = state.endedAt;
    setSaveState("saving");

    const measured = monitoring.monitoredMs >= 1000;
    const outcome: StoredSessionOutcome =
      state.endReason === "lost"
        ? "lost"
        : state.endReason === "completed"
          ? "completed"
          : "ended";
    const record: StoredSession = {
      intention: state.intention,
      plannedSeconds: Math.round(state.plannedMs / 1000),
      actualSeconds: Math.round(session.elapsedMs / 1000),
      attentiveSeconds: measured
        ? Math.round(
            Math.max(0, monitoring.monitoredMs - monitoring.awayMs) / 1000,
          )
        : null,
      awaySeconds: measured
        ? Math.round(monitoring.awayMs / 1000)
        : null,
      reminders: flagCount,
      hangmanParts: hangmanParts(flagCount),
      outcome,
      startedAt: new Date(state.sessionStartedAt).toISOString(),
      endedAt: new Date(state.endedAt).toISOString(),
    };

    saveSessionRecord(record)
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  }, [
    state.status,
    state.endedAt,
    state.sessionStartedAt,
    state.intention,
    state.plannedMs,
    state.endReason,
    session.elapsedMs,
    monitoring.monitoredMs,
    monitoring.awayMs,
    flagCount,
  ]);

  async function handleSaveSettings(next: MonitoringSettings) {
    await saveSettingsToStore(next);
    setSettings(next);
    setShowSettings(false);
  }

  const canBrowse = state.status === "idle" && !showSettings && !showHistory;

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 top-[-220px] size-[520px] rounded-full bg-focus/[0.045] blur-[120px]" />
        <div className="absolute -right-40 bottom-[-260px] size-[560px] rounded-full bg-[#5f8f72]/[0.055] blur-[130px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-5 py-5 sm:px-9 sm:py-7">
        <AppHeader
          onOpenSettings={
            canBrowse
              ? () => {
                  setShowHistory(false);
                  setShowSettings(true);
                }
              : undefined
          }
          onOpenHistory={
            canBrowse
              ? () => {
                  setShowSettings(false);
                  setShowHistory(true);
                }
              : undefined
          }
        />

        <main className="flex flex-1 flex-col justify-center py-7 sm:py-9">
          {state.status === "idle" &&
            (showSettings ? (
              <SettingsPage
                settings={settings}
                onSave={handleSaveSettings}
                onCancel={() => setShowSettings(false)}
              />
            ) : showHistory ? (
              <HistoryPage onBack={() => setShowHistory(false)} />
            ) : (
              <SetupPage onStart={session.start} settings={settings} />
            ))}

          {(state.status === "running" || state.status === "paused") && (
            <SessionPage
              session={session}
              monitoring={monitoring}
              flags={flagCount}
              absenceThresholdSeconds={settings.absenceSeconds}
              gazeThresholdSeconds={settings.gazeAwaySeconds}
            />
          )}

          {state.status === "completed" && (
            <SummaryPage
              state={state}
              elapsedMs={session.elapsedMs}
              reminders={flagCount}
              awayMs={monitoring.awayMs}
              monitoredMs={monitoring.monitoredMs}
              monitoringError={monitoring.error}
              gazeWasAvailable={monitoring.gazeWasAvailable}
              saveState={saveState}
              onRestart={session.reset}
            />
          )}
        </main>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-4 text-[10px] text-faint">
          <span className="flex items-center gap-1.5">
            <LockKeyhole aria-hidden="true" className="size-3" />
            No footage is recorded or uploaded
          </span>
          <span>Focus v0.4.0</span>
        </footer>
      </div>
    </div>
  );
}

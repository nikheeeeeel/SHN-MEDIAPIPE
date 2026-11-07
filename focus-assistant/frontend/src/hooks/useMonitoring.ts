import { useEffect, useRef, useState } from "react";

import {
  isDesktopRuntime,
  startMonitoring,
  stopMonitoring,
  subscribeToMonitoring,
} from "../services/monitoring";
import type {
  MonitoringRuntimeStatus,
  MonitoringSettings,
  MonitoringStatusPayload,
} from "../types/monitoring";
import type { SessionStatus } from "../types/session";

const MAX_SAMPLE_MS = 2_500;

interface UseMonitoringOptions {
  sessionStatus: SessionStatus;
  sessionStartedAt: number | null;
  intention: string;
  settings: MonitoringSettings;
}

export interface MonitoringResult {
  status: MonitoringRuntimeStatus;
  facePresent: boolean;
  absenceSeconds: number;
  gazeAvailable: boolean;
  gazeWasAvailable: boolean;
  gazeAway: boolean;
  gazeAwaySeconds: number;
  gazeReason: string;
  calibrationProgress: number;
  reminders: number;
  awayMs: number;
  monitoredMs: number;
  error: string | null;
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "The local monitoring process could not be started.";
}

/**
 * Owns the Tauri/Python monitoring lifecycle. Sampling deltas between status
 * events gives an approximate away-time estimate without storing any frames.
 */
export function useMonitoring({
  sessionStatus,
  sessionStartedAt,
  intention,
  settings,
}: UseMonitoringOptions): MonitoringResult {
  const [status, setStatus] = useState<MonitoringRuntimeStatus>("idle");
  const [facePresent, setFacePresent] = useState(false);
  const [absenceSeconds, setAbsenceSeconds] = useState(0);
  const [gazeAvailable, setGazeAvailable] = useState(false);
  const [gazeWasAvailable, setGazeWasAvailable] = useState(false);
  const [gazeAway, setGazeAway] = useState(false);
  const [gazeAwaySeconds, setGazeAwaySeconds] = useState(0);
  const [gazeReason, setGazeReason] = useState("");
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [reminders, setReminders] = useState(0);
  const [awayMs, setAwayMs] = useState(0);
  const [monitoredMs, setMonitoredMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runningRef = useRef(false);
  const lastSampleRef = useRef<number | null>(null);

  // A new session starts with fresh stats. Pauses keep the same session id.
  useEffect(() => {
    setReminders(0);
    setAwayMs(0);
    setMonitoredMs(0);
    setError(null);
    setFacePresent(false);
    setAbsenceSeconds(0);
    setGazeAvailable(false);
    setGazeWasAvailable(false);
    setGazeAway(false);
    setGazeAwaySeconds(0);
    setGazeReason("");
    setCalibrationProgress(0);
    setStatus("idle");
  }, [sessionStartedAt]);

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | undefined;

    function handleStatus(payload: MonitoringStatusPayload) {
      if (disposed) return;

      setStatus(payload.status === "calibrating" ? "calibrating" : "active");
      setFacePresent(payload.facePresent);
      setAbsenceSeconds(payload.absenceSeconds);
      setCalibrationProgress(
        payload.calibrationProgress ??
          (payload.status === "calibrating" ? 0 : 1),
      );
      setGazeAvailable(Boolean(payload.gazeAvailable));
      setGazeAway(Boolean(payload.gazeAway));
      setGazeAwaySeconds(payload.gazeAwaySeconds ?? 0);
      setGazeReason(payload.gazeReason ?? "");
      if (payload.gazeAvailable) setGazeWasAvailable(true);
      setError(null);

      const now = performance.now();
      if (runningRef.current) {
        const previous = lastSampleRef.current;
        if (previous !== null) {
          const delta = Math.min(MAX_SAMPLE_MS, Math.max(0, now - previous));
          setMonitoredMs((value) => value + delta);
          if (!payload.facePresent || payload.gazeAway) {
            setAwayMs((value) => value + delta);
          }
        }
        lastSampleRef.current = now;
      } else {
        lastSampleRef.current = null;
      }
    }

    if (isDesktopRuntime()) {
      subscribeToMonitoring({
        onStatus: handleStatus,
        onError: (payload) => {
          if (disposed) return;
          setStatus("error");
          setError(payload.message);
          setFacePresent(false);
          setAbsenceSeconds(0);
          setGazeAvailable(false);
          setGazeAway(false);
          setGazeAwaySeconds(0);
          setCalibrationProgress(0);
          lastSampleRef.current = null;
        },
        onReminder: () => {
          if (!disposed) setReminders((value) => value + 1);
        },
      })
        .then((unlisten) => {
          if (disposed) unlisten();
          else dispose = unlisten;
        })
        .catch((subscriptionError: unknown) => {
          if (!disposed) {
            setStatus("error");
            setError(errorMessage(subscriptionError));
          }
        });
    }

    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);

  useEffect(() => {
    runningRef.current = sessionStatus === "running";

    if (sessionStatus !== "running") {
      lastSampleRef.current = null;
      setStatus("idle");
      if (isDesktopRuntime()) {
        void stopMonitoring().catch(() => {});
      }
      return;
    }

    setStatus("starting");
    setError(null);
    setFacePresent(false);
    setAbsenceSeconds(0);
    setCalibrationProgress(0);
    setGazeAvailable(false);
    setGazeAway(false);
    setGazeAwaySeconds(0);
    setGazeReason("");
    lastSampleRef.current = null;

    if (!isDesktopRuntime()) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;
    startMonitoring({
      intention,
      absenceSeconds: settings.absenceSeconds,
      gazeAwaySeconds: settings.gazeAwaySeconds,
      cooldownSeconds: settings.cooldownSeconds,
      cameraIndex: settings.cameraIndex,
    }).catch((startError: unknown) => {
      if (cancelled) return;
      setStatus("error");
      setError(errorMessage(startError));
    });

    return () => {
      cancelled = true;
      lastSampleRef.current = null;
      void stopMonitoring().catch(() => {});
    };
  }, [
    sessionStatus,
    intention,
    settings.absenceSeconds,
    settings.gazeAwaySeconds,
    settings.cooldownSeconds,
    settings.cameraIndex,
  ]);

  return {
    status,
    facePresent,
    absenceSeconds,
    gazeAvailable,
    gazeWasAvailable,
    gazeAway,
    gazeAwaySeconds,
    gazeReason,
    calibrationProgress,
    reminders,
    awayMs,
    monitoredMs,
    error,
  };
}

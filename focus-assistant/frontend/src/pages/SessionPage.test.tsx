import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MonitoringResult } from "../hooks/useMonitoring";
import type { UseFocusSessionResult } from "../hooks/useFocusSession";
import type { SessionState } from "../types/session";
import { SessionPage } from "./SessionPage";

const runningState: SessionState = {
  status: "running",
  intention: "Study DBMS",
  plannedMinutes: 25,
  plannedMs: 25 * 60_000,
  sessionStartedAt: 1_700_000_000_000,
  startedAt: 1_700_000_000_000,
  accumulatedMs: 0,
  endedAt: null,
  endReason: null,
};

const session: UseFocusSessionResult = {
  state: runningState,
  elapsedMs: 60_000,
  remainingMs: 24 * 60_000,
  progress: 0.04,
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  end: vi.fn(),
  lose: vi.fn(),
  reset: vi.fn(),
};

const monitoring: MonitoringResult = {
  status: "active",
  facePresent: true,
  absenceSeconds: 0,
  gazeAvailable: true,
  gazeWasAvailable: true,
  gazeAway: false,
  gazeAwaySeconds: 0,
  gazeReason: "",
  calibrationProgress: 1,
  reminders: 0,
  awayMs: 0,
  monitoredMs: 60_000,
  error: null,
};

function renderPage(overrides: Partial<MonitoringResult> = {}) {
  render(
    <SessionPage
      session={session}
      monitoring={{ ...monitoring, ...overrides }}
      flags={0}
      absenceThresholdSeconds={120}
      gazeThresholdSeconds={180}
    />,
  );
}

describe("SessionPage monitoring", () => {
  it("shows the calibration prompt and progress", () => {
    renderPage({
      status: "calibrating",
      calibrationProgress: 0.5,
      gazeAvailable: false,
      gazeReason: "Calibration in progress.",
    });

    expect(screen.getAllByText("Calibrating gaze").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/look at the centre of the screen/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: /gaze calibration/i }),
    ).toHaveAttribute("aria-valuenow", "50");
  });

  it("shows stable gaze-away status with the configured threshold", () => {
    renderPage({ gazeAway: true, gazeAwaySeconds: 42 });

    expect(screen.getAllByText(/estimated gaze away/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/focus reminder appears after 180 sec/i)).toBeInTheDocument();
  });

  it("shows the face-presence fallback when gaze is unavailable", () => {
    renderPage({
      gazeAvailable: false,
      gazeReason:
        "Calibration was not steady enough. Using face presence only.",
    });

    expect(
      screen.getByText("Gaze estimation unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/calibration was not steady enough/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/pause and resume to try calibration/i)).toBeInTheDocument();
  });
});

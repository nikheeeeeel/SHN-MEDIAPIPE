import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MonitoringResult } from "./hooks/useMonitoring";

vi.mock("./hooks/useMonitoring", () => ({
  useMonitoring: vi.fn(),
}));

import App from "./App";
import { useMonitoring } from "./hooks/useMonitoring";

const losingMonitoring: MonitoringResult = {
  status: "active",
  facePresent: true,
  absenceSeconds: 0,
  gazeAvailable: true,
  gazeWasAvailable: true,
  gazeAway: false,
  gazeAwaySeconds: 0,
  gazeReason: "",
  calibrationProgress: 1,
  reminders: 6,
  awayMs: 120_000,
  monitoredMs: 300_000,
  error: null,
};

describe("Hangman session loss", () => {
  it("ends the session automatically on the sixth flag", async () => {
    vi.mocked(useMonitoring).mockReturnValue(losingMonitoring);
    window.localStorage.clear();

    render(<App />);

    fireEvent.change(screen.getByLabelText(/your intention/i), {
      target: { value: "Study DBMS" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /start focus session/i }),
    );

    expect(await screen.findByText("You lost.")).toBeInTheDocument();
    expect(screen.getByText(/hangman complete/i)).toBeInTheDocument();
    expect(screen.getByText(/6\/6 flags/i)).toBeInTheDocument();
  });
});

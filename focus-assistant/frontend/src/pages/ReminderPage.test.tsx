import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/reminder", () => ({
  getReminderPayload: vi.fn(),
  dismissReminder: vi.fn().mockResolvedValue(undefined),
  subscribeToReminderUpdates: vi.fn().mockResolvedValue(() => {}),
}));

import {
  dismissReminder,
  getReminderPayload,
  subscribeToReminderUpdates,
} from "../services/reminder";
import { ReminderPage } from "./ReminderPage";

describe("ReminderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(subscribeToReminderUpdates).mockResolvedValue(() => {});
  });

  it("shows the intention and message, then dismisses", async () => {
    vi.mocked(getReminderPayload).mockResolvedValue({
      kind: "away",
      intention: "Study DBMS",
      message: "Take a breath and come back when you're ready.",
      triggerSeconds: 125,
    });

    render(<ReminderPage />);

    expect(await screen.findByText("Study DBMS")).toBeInTheDocument();
    expect(
      screen.getByText("Take a breath and come back when you're ready."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to focus/i }));

    expect(dismissReminder).toHaveBeenCalledTimes(1);
  });

  it("shows a helpful message if the payload is unavailable", async () => {
    vi.mocked(getReminderPayload).mockResolvedValue(null);

    render(<ReminderPage />);

    expect(
      await screen.findByText(/no longer available/i),
    ).toBeInTheDocument();
  });
});

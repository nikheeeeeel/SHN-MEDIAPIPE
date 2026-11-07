import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../lib/settings";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("saves validated settings in seconds and whole camera indices", () => {
    const onSave = vi.fn();

    render(
      <SettingsPage
        settings={DEFAULT_SETTINGS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/face absence threshold/i), {
      target: { value: "45" },
    });
    fireEvent.change(screen.getByLabelText(/gaze-away threshold/i), {
      target: { value: "90" },
    });
    fireEvent.change(screen.getByLabelText(/reminder cooldown/i), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByLabelText(/^camera$/i), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    expect(onSave).toHaveBeenCalledWith({
      absenceSeconds: 45,
      gazeAwaySeconds: 90,
      cooldownSeconds: 120,
      cameraIndex: 1,
    });
  });

  it("rejects out-of-range values", () => {
    const onSave = vi.fn();

    render(
      <SettingsPage
        settings={DEFAULT_SETTINGS}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/gaze-away threshold/i), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/between 5 and 3600/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("restores defaults into the form", () => {
    render(
      <SettingsPage
        settings={{
          absenceSeconds: 600,
          gazeAwaySeconds: 900,
          cooldownSeconds: 1200,
          cameraIndex: 3,
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /restore defaults/i }));

    expect(screen.getByLabelText(/face absence threshold/i)).toHaveValue(120);
    expect(screen.getByLabelText(/gaze-away threshold/i)).toHaveValue(180);
    expect(screen.getByLabelText(/reminder cooldown/i)).toHaveValue(300);
    expect(screen.getByLabelText(/^camera$/i)).toHaveValue(0);
  });
});

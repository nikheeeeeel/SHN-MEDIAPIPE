import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("Focus app", () => {
  it("starts, pauses, and ends a session", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /what are you here to do/i }),
    ).toBeInTheDocument();

    const startButton = screen.getByRole("button", {
      name: /start focus session/i,
    });
    expect(startButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/your intention/i), {
      target: { value: "Study DBMS" },
    });
    expect(startButton).toBeEnabled();

    fireEvent.click(startButton);

    expect(screen.getByText("Study DBMS")).toBeInTheDocument();
    expect(screen.getByText("25:00")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /pause session/i }),
    );
    expect(screen.getByText("Session paused")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^end$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /end session/i }),
    );

    expect(
      screen.getByRole("heading", { name: /that's okay/i }),
    ).toBeInTheDocument();
  });

  it("rejects a custom duration outside the allowed range", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/your intention/i), {
      target: { value: "Write the report" },
    });
    fireEvent.change(screen.getByLabelText(/for how long/i), {
      target: { value: "0" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /between 1 and 480 minutes/i,
    );
    expect(
      screen.getByRole("button", { name: /start focus session/i }),
    ).toBeDisabled();
  });

  it("opens settings, saves them, and applies them to the next session", async () => {
    window.localStorage.clear();
    render(<App />);

    await screen.findByRole("heading", { name: /what are you here to do/i });

    fireEvent.click(
      screen.getByRole("button", { name: /open settings/i }),
    );

    expect(
      screen.getByRole("heading", { name: /make the nudges fit you/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/face absence threshold/i), {
      target: { value: "90" },
    });
    fireEvent.change(screen.getByLabelText(/gaze-away threshold/i), {
      target: { value: "150" },
    });
    fireEvent.change(screen.getByLabelText(/reminder cooldown/i), {
      target: { value: "240" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    expect(await screen.findByText(/after 90 sec/i)).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("focus.settings.v1") ?? "{}"),
    ).toEqual({
      absenceSeconds: 90,
      gazeAwaySeconds: 150,
      cooldownSeconds: 240,
      cameraIndex: 0,
    });
  });
});

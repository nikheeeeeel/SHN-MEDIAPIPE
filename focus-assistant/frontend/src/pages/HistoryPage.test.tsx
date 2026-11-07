import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/monitoring", () => ({
  isDesktopRuntime: () => true,
}));

vi.mock("../services/history", () => ({
  listSessionHistory: vi.fn(),
}));

import { listSessionHistory } from "../services/history";
import { HistoryPage } from "./HistoryPage";

describe("HistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders stored sessions including a lost hangman outcome", async () => {
    vi.mocked(listSessionHistory).mockResolvedValue([
      {
        id: 1,
        intention: "Study DBMS",
        plannedSeconds: 1500,
        actualSeconds: 620,
        attentiveSeconds: 480,
        awaySeconds: 140,
        reminders: 6,
        hangmanParts: 6,
        outcome: "lost",
        startedAt: "2026-11-07T10:00:00.000Z",
        endedAt: "2026-11-07T10:10:00.000Z",
      },
    ]);

    render(<HistoryPage onBack={vi.fn()} />);

    expect(await screen.findByText("Study DBMS")).toBeInTheDocument();
    expect(screen.getByText("Lost")).toBeInTheDocument();
    expect(screen.getByText("6 / 6")).toBeInTheDocument();
    expect(screen.getByText("8m 00s")).toBeInTheDocument();
  });
});

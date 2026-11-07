function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/** Formats milliseconds as a clock. Countdowns round up so they start at the full duration. */
export function formatClock(
  ms: number,
  rounding: "up" | "down" = "down",
): string {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math[rounding === "up" ? "ceil" : "floor"](
    safeMs / 1000,
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Human-friendly duration for summaries, e.g. "42s", "12m 08s", "1h 04m". */
export function formatSpan(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (remaining === 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${hours} hr ${remaining} min`;
}

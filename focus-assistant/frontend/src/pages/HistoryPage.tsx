import {
  ArrowLeft,
  CheckCircle2,
  Flag,
  History,
  LoaderCircle,
  Skull,
} from "lucide-react";
import { useEffect, useState } from "react";

import { formatMinutes, formatSpan } from "../lib/format";
import { isDesktopRuntime } from "../services/monitoring";
import { listSessionHistory } from "../services/history";
import type { StoredSession } from "../types/history";

interface HistoryPageProps {
  onBack: () => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OutcomeBadge({ outcome }: { outcome: StoredSession["outcome"] }) {
  if (outcome === "lost") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-danger/20 bg-danger/[0.05] px-2.5 py-1 text-[10px] text-danger">
        <Skull aria-hidden="true" className="size-3" />
        Lost
      </span>
    );
  }

  if (outcome === "completed") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-focus/20 bg-focus/[0.06] px-2.5 py-1 text-[10px] text-focus/90">
        <CheckCircle2 aria-hidden="true" className="size-3" />
        Completed
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[10px] text-muted">
      <Flag aria-hidden="true" className="size-3" />
      Ended early
    </span>
  );
}

export function HistoryPage({ onBack }: HistoryPageProps) {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isDesktopRuntime()) {
      setLoading(false);
      return;
    }

    listSessionHistory()
      .then((history) => {
        if (!cancelled) setSessions(history);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load session history.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-[11px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        Back to session setup
      </button>

      <p className="eyebrow mt-5">
        <History aria-hidden="true" className="size-3.5" />
        Local history
      </p>
      <h1 className="mt-3 text-[clamp(1.8rem,3.6vw,2.3rem)] font-semibold tracking-[-0.035em] text-ink">
        Previous sessions.
      </h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
        Stored locally in SQLite. Attention figures are approximate and never a
        productivity score.
      </p>

      {!isDesktopRuntime() && (
        <div className="panel mt-6 p-6 text-sm text-muted">
          Session history is stored in the desktop app. A browser preview does
          not have access to the local database.
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-danger/20 bg-danger/[0.05] px-4 py-3 text-xs text-danger"
        >
          {error}
        </p>
      )}

      {isDesktopRuntime() && loading && (
        <div className="mt-8 flex items-center gap-2 text-xs text-faint">
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          Loading sessions…
        </div>
      )}

      {isDesktopRuntime() && !loading && !error && sessions.length === 0 && (
        <div className="panel mt-6 p-8 text-center">
          <History
            aria-hidden="true"
            className="mx-auto size-6 text-faint"
          />
          <p className="mt-3 text-sm font-medium text-ink/80">
            No sessions yet.
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Complete or end a focus session and it will appear here.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {sessions.map((session) => (
          <article
            key={session.id ?? `${session.startedAt}-${session.endedAt}`}
            className="panel p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-faint">
                  {formatDate(session.endedAt)}
                </p>
                <p className="mt-1 break-words text-base font-medium leading-snug tracking-[-0.01em] text-ink">
                  {session.intention}
                </p>
              </div>
              <OutcomeBadge outcome={session.outcome} />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line/60 pt-4 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-[9px] uppercase tracking-[0.12em] text-faint">
                  Actual
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-ink/90">
                  {formatSpan(session.actualSeconds * 1000)}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase tracking-[0.12em] text-faint">
                  Planned
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-ink/90">
                  {formatMinutes(Math.round(session.plannedSeconds / 60))}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase tracking-[0.12em] text-faint">
                  Reminders / flags
                </dt>
                <dd className="mt-1 font-mono tabular-nums text-ink/90">
                  {session.reminders} / {session.hangmanParts}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase tracking-[0.12em] text-faint">
                  Estimated attentive
                </dt>
                <dd className="mt-1 text-ink/90">
                  {session.attentiveSeconds === null
                    ? "Not measured"
                    : formatSpan(session.attentiveSeconds * 1000)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

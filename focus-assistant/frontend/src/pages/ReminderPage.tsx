import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  dismissReminder,
  getReminderPayload,
  subscribeToReminderUpdates,
} from "../services/reminder";
import type { ReminderPayload } from "../types/monitoring";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The reminder could not be loaded.";
}

export function ReminderPage() {
  const [payload, setPayload] = useState<ReminderPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  const dismiss = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    try {
      await dismissReminder();
    } catch {
      closingRef.current = false;
      setClosing(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | undefined;

    getReminderPayload()
      .then((next) => {
        if (disposed) return;
        if (next) setPayload(next);
        else setError("This reminder is no longer available.");
      })
      .catch((loadError: unknown) => {
        if (!disposed) setError(errorMessage(loadError));
      });

    subscribeToReminderUpdates((next) => {
      if (!disposed) {
        setPayload(next);
        setError(null);
      }
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else dispose = unlisten;
      })
      .catch(() => {});

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") void dismiss();
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      disposed = true;
      dispose?.();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismiss]);

  return (
    <main className="reminder-enter flex h-screen flex-col overflow-hidden bg-canvas p-5 text-ink">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="eyebrow">
          <Sparkles aria-hidden="true" className="size-3.5" />
          A gentle nudge
        </p>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
          Focus
        </span>
      </div>

      <div className="min-h-0 flex-1 py-3">
        <div className="flex h-full flex-col justify-center">
          {payload ? (
            <>
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-faint">
                You started this session to
              </p>
              <p className="mt-1.5 line-clamp-2 text-[15px] font-medium leading-snug tracking-[-0.01em] text-ink">
                {payload.intention}
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                {payload.message}
              </p>
            </>
          ) : error ? (
            <p className="text-[12px] leading-relaxed text-muted">{error}</p>
          ) : (
            <p className="text-[12px] text-muted">Preparing your reminder…</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line/60 pt-3">
        <span className="flex items-center gap-1.5 text-[9px] text-faint">
          <ShieldCheck aria-hidden="true" className="size-3" />
          Local · no frames saved
        </span>
        <button
          type="button"
          onClick={() => void dismiss()}
          disabled={closing}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-focus px-3.5 text-[11px] font-semibold text-canvas transition-colors hover:bg-focus-strong disabled:opacity-60"
        >
          Back to focus
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </main>
  );
}

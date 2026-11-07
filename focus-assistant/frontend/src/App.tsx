import { LockKeyhole } from "lucide-react";

import { AppHeader } from "./components/AppHeader";
import { useFocusSession } from "./hooks/useFocusSession";
import { SessionPage } from "./pages/SessionPage";
import { SetupPage } from "./pages/SetupPage";
import { SummaryPage } from "./pages/SummaryPage";

export default function App() {
  const session = useFocusSession();
  const { state } = session;

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 top-[-220px] size-[520px] rounded-full bg-focus/[0.045] blur-[120px]" />
        <div className="absolute -right-40 bottom-[-260px] size-[560px] rounded-full bg-[#5f8f72]/[0.055] blur-[130px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-5 py-5 sm:px-9 sm:py-7">
        <AppHeader />

        <main className="flex flex-1 flex-col justify-center py-7 sm:py-9">
          {state.status === "idle" && <SetupPage onStart={session.start} />}

          {(state.status === "running" || state.status === "paused") && (
            <SessionPage session={session} />
          )}

          {state.status === "completed" && (
            <SummaryPage
              state={state}
              elapsedMs={session.elapsedMs}
              onRestart={session.reset}
            />
          )}
        </main>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-4 text-[10px] text-faint">
          <span className="flex items-center gap-1.5">
            <LockKeyhole aria-hidden="true" className="size-3" />
            No footage is recorded or uploaded
          </span>
          <span>Focus v0.1.0</span>
        </footer>
      </div>
    </div>
  );
}

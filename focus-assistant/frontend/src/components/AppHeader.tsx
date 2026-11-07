import { History, Settings, ShieldCheck } from "lucide-react";

interface AppHeaderProps {
  onOpenSettings?: () => void;
  onOpenHistory?: () => void;
}

export function AppHeader({
  onOpenSettings,
  onOpenHistory,
}: AppHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="relative grid size-10 place-items-center rounded-2xl border border-focus/20 bg-focus/[0.06]"
        >
          <div className="size-5 rounded-full border-[1.5px] border-focus/80" />
          <div className="absolute size-1.5 rounded-full bg-focus" />
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-[-0.02em] text-ink">
            Focus
          </span>
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.2em] text-faint sm:inline">
            local-first
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-line/80 bg-panel/60 px-3 py-1.5 text-[11px] text-muted sm:flex">
          <ShieldCheck aria-hidden="true" className="size-3.5 text-focus/80" />
          <span>Nothing leaves this device</span>
        </div>

        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            aria-label="Open session history"
            title="History"
            className="grid size-9 place-items-center rounded-full border border-line/80 bg-panel/60 text-muted transition-colors hover:border-line hover:bg-panel hover:text-ink"
          >
            <History aria-hidden="true" className="size-4" />
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
            className="grid size-9 place-items-center rounded-full border border-line/80 bg-panel/60 text-muted transition-colors hover:border-line hover:bg-panel hover:text-ink"
          >
            <Settings aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
    </header>
  );
}

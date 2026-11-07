# Focus

A local-first desktop focus assistant. Name an intention, choose a duration,
and Focus keeps a calm countdown while you work. When the vision engine lands
in Phase 2, it will gently nudge you back if you are away or looking away for
too long.

> **Current status: Phase 1 complete.** The desktop shell, session setup,
> countdown, pause/resume/end controls, and summary screen work. Face and gaze
> monitoring, reminders, SQLite history, and the settings screen are **not
> implemented yet**. The UI states this explicitly rather than pretending the
> camera is being used.

![Focus cover](../assets/cover.jpeg)

## What works

- Intention entry with validation (1–160 characters).
- Duration presets plus a custom 1–480 minute input.
- Start, pause, resume, and end a session.
- A pause-aware countdown that completes automatically at zero.
- An active-session view with intention, progress, elapsed/planned time, and
  clear session status.
- A two-step end confirmation so a session is not ended accidentally.
- A session summary with planned duration, actual active time, reminders
  displayed (0 in this phase), and explicitly unmeasured attention stats.
- Native Tauri window, dark interface, Lucide icons, no browser tab required.
- No network requests, no camera access, and no data leaves the machine.

## What is deliberately not here yet

Phase 1 stops before computer vision. There is no webcam feed, face detector,
gaze estimator, calibration, reminder popup, SQLite database, history view, or
monitoring settings screen. Those belong to Phases 2–4 and will be added on
top of this foundation.

## Stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri 2 |
| UI | React 19, TypeScript, Vite 8 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Tests | Vitest, Testing Library |
| Vision + storage (later phases) | Python, MediaPipe, OpenCV, SQLite |

## Project layout

```text
focus-assistant/
├── package.json                  # Tauri CLI and top-level scripts
├── src-tauri/                    # Rust shell, capabilities, icons, config
│   ├── src/
│   └── tauri.conf.json
├── frontend/
│   ├── src/
│   │   ├── components/           # AppHeader, ProgressRing
│   │   ├── pages/                # Setup, Session, Summary
│   │   ├── hooks/                # useFocusSession
│   │   ├── lib/                  # pure session state machine + formatting
│   │   ├── types/
│   │   └── test/
│   └── package.json
├── tests/                        # reserved for Python vision/storage tests
└── README.md
```

The session clock is a pure reducer (`frontend/src/lib/session.ts`) wrapped by
`useFocusSession`. Keeping the state machine free of React makes the timing
rules deterministic and unit-testable.

## Prerequisites (Arch Linux)

Tauri 2 needs WebKitGTK, GTK 3, libsoup 3, and a C toolchain:

```bash
sudo pacman -S --needed base-devel curl wget file openssl \
  webkit2gtk-4.1 gtk3 libsoup3 librsvg
```

Install Rust (if `cargo --version` fails):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

Node.js 20+ and npm are required. This project was developed with Node 24 and
npm 11.

## Install

```bash
cd focus-assistant
npm install
npm --prefix frontend install
```

## Run the desktop app

```bash
source "$HOME/.cargo/env"   # if Rust was installed with rustup
cd focus-assistant
npm run dev
```

Tauri starts Vite on `http://localhost:1420`, compiles the Rust shell, and opens
the native **Focus** window. The frontend can also be previewed alone with:

```bash
npm --prefix frontend run dev
```

## Build

Compile an optimized binary without creating installers (fastest verification):

```bash
cd focus-assistant
npm run build:dir
# binary: src-tauri/target/release/focus-assistant
```

Create Linux bundles (`.deb`, `.rpm`, AppImage):

```bash
npm run build
# output: src-tauri/target/release/bundle/
```

Installer generation is Phase 5 work and has not been fully verified yet,
especially AppImage packaging on Arch.

## Tests and checks

```bash
cd focus-assistant
npm --prefix frontend run check     # TypeScript, no emit
npm --prefix frontend test          # Vitest
cd src-tauri && cargo check         # Rust shell
```

## Privacy

- Phase 1 does not access the webcam at all.
- No analytics, telemetry, remote calls, accounts, or cloud storage.
- When monitoring arrives, frames will be processed in a local Python process,
  never recorded, and never uploaded. The camera will be released when a
  session is paused or ends.
- Completed session statistics will be stored only in a local SQLite database.

## Known limitations (Phase 1)

- No face/gaze monitoring, reminders, calibration, SQLite, history, or settings.
- Attention statistics are shown as **Not measured**, not as estimates.
- The countdown uses wall-clock time (`Date.now`). If the machine sleeps for a
  long period, the session can complete on wake. Pauses themselves are
  correctly excluded from active time.
- Native/system notifications are not used yet.
- Linux bundle generation is pending Phase 5 verification.
- Camera access on Arch is expected to use `/dev/video*` plus the user's
  `video` group or an ACL. This machine already has an ACL for the current
  user; other machines may need `sudo usermod -aG video "$USER"`.

## Roadmap

1. **Phase 1 — foundation (done):** Tauri + React shell, session flow, timer,
   summary.
2. **Phase 2 — face detection:** local Python/MediaPipe worker, absence timer,
   away reminder window.
3. **Phase 3 — gaze:** iris-based estimate, calibration, smoothing, focus
   reminders with cooldown.
4. **Phase 4 — persistence:** SQLite session history and summary statistics.
5. **Phase 5 — reliability:** camera permissions/errors, Python failure
   handling, packaging, Linux validation.

## Saturday Hack Night

Built with curiosity at Saturday Hack Night.

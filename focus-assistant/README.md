# Focus

A local-first desktop focus assistant. Name an intention, choose a duration,
and Focus keeps a calm countdown while a local Python/MediaPipe worker watches
for face presence and approximate gaze direction. If you have been away for two
minutes, or looking away from the screen for three, a small reminder window
gently asks you back. No camera frames are recorded or uploaded.

> **Current status: Phase 4 complete, with a hangman game and a working local package.**
> Session flow, face + gaze monitoring, reminders, calibration, SQLite settings,
> session history, and the hangman loss mechanic work. A `.deb` package with a
> frozen Python worker has been built; AppImage finalization is still pending.

![Focus cover](../assets/cover.jpeg)

## Demo on this machine

```bash
cd /home/nikeel/SHN-MEDIAPIPE/focus-assistant
./src-tauri/target/release/focus-assistant
```

Or start the development build:

```bash
cd /home/nikeel/SHN-MEDIAPIPE/focus-assistant
source "$HOME/.cargo/env"
npm run dev
```

The release binary uses the project venv for vision here. The packaged `.deb`
uses the frozen worker under `src-tauri/resources/vision-worker/`.

## Gamification: hangman

- Every away or gaze **flag** (a reminder that passes the existing thresholds
  and cooldown rules) draws one hangman part.
- The session view shows the gallows, the drawn parts, and the remaining count.
- There are **six parts**: head, body, two arms, two legs.
- On the sixth flag the hangman is complete, the app shows **“You lost.”**, and
  the session ends automatically.
- The loss is saved to history and includes the hangman flag count.
- The existing reminder thresholds, shared cooldown, and reminder window are
  unchanged. The cooldown still prevents rapid repeated flags.
- **Demo shortcut:** while a session is running, press **Ctrl+Shift+D** to draw
  one flag manually. Six presses show the loss flow immediately. This does not
  change automatic detection, thresholds, or cooldown rules.


## What works

### Focus sessions
- Intention entry with validation (1–160 characters).
- Duration presets plus a custom 1–480 minute input.
- Start, pause, resume, and two-step end.
- Pause-aware countdown that completes automatically at zero.
- Active view with intention, progress, elapsed/planned time, and clear status.
- Camera released on pause, end, app close, or worker failure.

### Local monitoring (Phases 2–3)
- Python worker opens the configured camera and runs MediaPipe Face Landmarker.
- Only face presence, approximate gaze state, and timing metadata leave the
  worker over a local stdio pipe. Frames stay in memory and are never written
  or transmitted.
- Face absence threshold defaults to **120 seconds** and is configurable.
- Gaze-away threshold defaults to **180 seconds** and is configurable.
- A short **3-second centre-screen calibration** builds a personal iris baseline.
- Iris offsets are smoothed and debounced so blinks and small head movements do
  not register as distractions.
- If calibration fails, iris landmarks are not reliable, or the eyes are not
  visible, the worker falls back to face-presence monitoring and says so.
- Two-second presence grace absorbs missed face detections and brief flicker.
- Reminder cooldown defaults to **300 seconds** and is shared by away and focus
  reminders.
- One reminder per episode; returning attention resets the matching episode.
- Camera index is configurable (usually `0`).
- Clear states: starting, calibrating gaze, camera on, face detected/no face,
  gaze toward screen/away, unavailable.
- Graceful failure: if the camera, model, or Python worker fails, the timer
  keeps running and the UI shows the error instead of pretending monitoring is
  active.

### Reminder window (Phases 2–3)
- Separate 410×264 Tauri window, borderless, always-on-top where the compositor
  supports it, and skipped from the taskbar.
- Shows the user's original intention and one of several calm, non-guilt
  motivational messages, with separate copy for away and gaze reminders.
- Dismiss with **Back to focus** or **Escape**; monitoring continues.
- Only one reminder window can exist at a time.
- Shared cooldown and per-episode logic prevent repeated nudges.

### Session summary and history
- Intended task, planned duration, actual active time, reminders/flags.
- **Estimated attentive time** and **estimated time away**, derived from face
  presence and, when calibration succeeds, approximate gaze direction. Clearly
  labelled as approximate.
- Coverage line shows how much of the session had monitoring available.
- Completed, ended, and lost sessions are saved to local SQLite.
- **History screen** lists previous sessions with outcome, durations, reminder
  count, hangman flags, and estimated attentive time.
- Settings are stored in SQLite and loaded on startup.
- Charts and productivity scores are deliberately absent.

## Deliberately not here yet

- AppImage finalization. A `.deb` bundle was generated, but the AppImage build
  was interrupted and has not been validated. The raw release binary is the
  supported demo path.
- System-wide `.deb` installation testing on a clean machine.
- A persistent per-user calibration profile. Calibration is redone for each
  monitoring start/resume.

## Stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri 2 |
| UI | React 19, TypeScript, Vite 8 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Vision worker | Python 3, MediaPipe Face Landmarker (face + iris), OpenCV |
| Transport | Child-process stdio, newline-delimited JSON |
| Tests | Vitest, Testing Library, Python `unittest` |
| Storage | SQLite (bundled via rusqlite) |

## Project layout

```text
focus-assistant/
├── package.json                  # Tauri CLI and top-level scripts
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                # App setup, commands, shutdown handling
│   │   ├── monitoring.rs         # Python lifecycle + JSON event bridge
│   │   └── reminder.rs           # Reminder window + motivational messages
│   ├── capabilities/default.json
│   └── tauri.conf.json
├── frontend/
│   ├── reminder.html             # Separate popup entry point
│   ├── src/
│   │   ├── components/
│   │   ├── pages/                # Setup, Session, Summary, Settings, Reminder
│   │   ├── hooks/                # useFocusSession, useMonitoring
│   │   ├── lib/                  # session reducer, formatting, settings
│   │   ├── services/             # Tauri invoke/event wrappers
│   │   └── types/
│   └── package.json
├── vision/
│   ├── main.py                   # Worker entry point and JSON protocol
│   ├── worker_entry.py           # PyInstaller entry point for packaging
│   ├── camera.py                 # OpenCV/V4L2 capture, no recording
│   ├── face_detector.py          # MediaPipe Face Landmarker wrapper
│   ├── gaze_estimator.py         # iris metrics, calibration, smoothing
│   ├── attention_monitor.py      # Pure absence/gaze/cooldown state machine
│   ├── models/face_landmarker.task
│   └── requirements.txt
├── scripts/
│   └── build_vision_worker.sh    # freeze the Python worker for packaging
├── tests/
│   ├── test_attention_monitor.py
│   └── test_gaze_estimator.py
└── README.md
```

### How the monitoring bridge works

```text
React session starts
        │  invoke("start_monitoring", settings)
        ▼
Rust MonitorState ──spawn──► python -m vision.main
        │                        │
        │◄──── JSON lines ───────┘
        │  ready / calibration / calibrated / status / reminder / error
        ├──► "monitoring:status" event ──► main window
        └──► reminder window + "monitoring:reminder"
```

The session reducer remains pure in `frontend/src/lib/session.ts`. The absence,
gaze, and cooldown rules are pure in `vision/attention_monitor.py`; iris
metrics/calibration/smoothing live in `vision/gaze_estimator.py`. Both are
tested without a camera. The MediaPipe model is bundled at
`vision/models/face_landmarker.task` and runs fully offline.

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

Python 3 with a local virtual environment and the vision dependencies:

```bash
cd focus-assistant
python3 -m venv ../venv
../venv/bin/pip install -r vision/requirements.txt
```

This machine's existing `/home/nikeel/SHN-MEDIAPIPE/venv` already contains the
required packages. Camera access uses `/dev/video*`; if permission is denied,
ensure your user can read the device (for example `sudo usermod -aG video "$USER"`).

The Tauri shell automatically looks for `../venv/bin/python`, `.venv/bin/python`,
or `venv/bin/python` relative to the project. Override with `FOCUS_PYTHON` and
`FOCUS_VISION_ROOT` if needed.

## Install

```bash
cd focus-assistant
npm install
npm --prefix frontend install
```

## Run the desktop app

```bash
source "$HOME/.cargo/env"
cd focus-assistant
npm run dev
```

Tauri starts Vite on `http://localhost:1420`, compiles the Rust shell, and opens
the native **Focus** window. Starting a session launches the Python worker,
which opens the camera, calibrates gaze for a few seconds, and emits face/gaze
status events.

The frontend can be previewed alone with `npm --prefix frontend run dev`, but
monitoring is disabled outside the desktop shell and the UI says so.

## Build

```bash
cd focus-assistant

# Fast release binary (uses the local venv for vision)
npm run build:dir

# Frozen single-folder vision worker for bundled installers
../venv/bin/pip install -r vision/requirements-packaging.txt
npm run build:vision

# Linux bundles (.deb / AppImage)
npm run build
# generated .deb: src-tauri/target/release/bundle/deb/
```

The `.deb` generated in this workspace is
`src-tauri/target/release/bundle/deb/Focus_0.4.0_amd64.deb`. It embeds the
frozen vision worker under `usr/lib/Focus/resources/vision-worker/`. The
AppImage build is not part of the validated demo path.

## Settings

Open the gear button on the setup screen:

- **Face absence threshold:** 5–3600 seconds (default 120).
- **Gaze-away threshold:** 5–3600 seconds (default 180). Requires calibration.
- **Reminder cooldown:** 5–3600 seconds (default 300).
- **Camera index:** 0–8 (default 0).

Settings are stored in SQLite in the app data directory
(`~/.local/share/com.focusassistant.focus/focus.db` on Linux) and apply to the
next session. Browser previews fall back to local storage.

## Tests and checks

```bash
cd focus-assistant

# TypeScript + React
npm --prefix frontend run check
npm --prefix frontend test

# Python attention, gaze, and calibration logic
../venv/bin/python -m unittest discover -s tests -v

# Rust shell
cd src-tauri && cargo check
```

## Privacy

- Camera frames are processed entirely on this machine by the local Python
  worker. They are never recorded, saved, or uploaded.
- The worker writes only JSON events (face present/absent, approximate gaze
  state, calibration result, timings, errors) to the parent process over a local
  pipe.
- Iris coordinates, gaze vectors, embeddings, and images never leave the worker
  process or get stored.
- No analytics, telemetry, accounts, cloud services, or remote databases.
- The camera is opened only when a session is actually running and is released
  on pause, end, window close, worker failure, or app exit.
- Session statistics and settings stay local in SQLite.

## Known limitations

- **Face presence and gaze direction are not attention.** The summary is
  explicitly approximate and does not measure concentration, productivity, or
  task completion.
- Iris-based gaze is a lightweight approximation, not eye tracking. It is
  sensitive to head pose, glasses, lighting, camera angle, and screen position.
  Turning the head far enough can move the gaze away from the camera while the
  iris remains centred in the eye, in which case gaze-away may not be detected.
- Calibration is a fixed 3-second centre-screen step at each monitoring start or
  resume. It is not persisted across pauses. Glancing away during calibration
  can produce a poor baseline; pause and resume to recalibrate.
- If calibration fails or iris landmarks remain unreliable for more than a few
  seconds, gaze monitoring disables itself and face presence continues. The UI
  states this clearly.
- Face and eye detection run at ~10 FPS and can miss faces at extreme angles, in
  very low light, when the face is partly outside the frame, or when eyes are
  closed.
- `always-on-top` depends on the Wayland compositor. It is tested on Hyprland,
  but other compositors may place the reminder differently.
- The Python worker is not bundled into the raw release binary; it uses the
  local venv there. The generated `.deb` includes a frozen PyInstaller worker
  (about 459 MB unpacked). The AppImage was not finalized.
- Settings and history are stored in SQLite at
  `~/.local/share/com.focusassistant.focus/focus.db`.
- The hangman mechanic intentionally ends the session at six flags. It uses the
  same reminder/cooldown rules as before; it does not add extra detection
  thresholds.
- The countdown uses wall-clock time. A long system sleep can complete a session
  on wake; paused time itself is excluded correctly.
- Camera selection is an index field rather than an enumerated device picker.

## Roadmap

1. **Phase 1 — foundation (done):** Tauri + React shell, session flow, timer,
   summary.
2. **Phase 2 — face detection (done):** local Python/MediaPipe worker, absence
   timer, away reminder window, configurable settings.
3. **Phase 3 — gaze (done):** iris-based estimate, calibration, smoothing,
   3-minute focus reminders with shared cooldown.
4. **Phase 4 — persistence and game (done):** SQLite session history/settings,
   hangman flags, automatic loss at six flags, history screen.
5. **Phase 5 — reliability and packaging (partial):** frozen vision worker and
   `.deb` bundle generated; AppImage and clean-machine install testing pending.

## Saturday Hack Night

Built with curiosity at Saturday Hack Night.

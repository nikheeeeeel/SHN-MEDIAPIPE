use std::collections::VecDeque;
use std::env;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::reminder::{show_reminder, ReminderPayload};

const STOP_GRACE: Duration = Duration::from_millis(700);

enum WorkerLauncher {
    Python {
        python: PathBuf,
        root: PathBuf,
        model: PathBuf,
    },
    Frozen {
        executable: PathBuf,
        root: PathBuf,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitoringRequest {
    pub intention: String,
    pub camera_index: u32,
    pub absence_seconds: f64,
    pub gaze_away_seconds: f64,
    pub cooldown_seconds: f64,
}

#[derive(Default)]
pub struct MonitorState {
    child: Mutex<Option<Child>>,
    intention: Mutex<String>,
    generation: AtomicU64,
}

pub fn stop_on_exit(app: &AppHandle) {
    if let Some(state) = app.try_state::<MonitorState>() {
        stop_internal(&state);
    }
}

#[tauri::command]
pub fn start_monitoring(
    app: AppHandle,
    state: State<'_, MonitorState>,
    request: MonitoringRequest,
) -> Result<(), String> {
    let intention = request.intention.trim().to_string();
    if intention.is_empty() {
        return Err("An intention is required before monitoring can start.".into());
    }
    if intention.chars().count() > 200 {
        return Err("The intention is too long.".into());
    }
    if request.camera_index > 16 {
        return Err("Camera index must be between 0 and 16.".into());
    }
    if !request.absence_seconds.is_finite()
        || !(1.0..=3600.0).contains(&request.absence_seconds)
    {
        return Err("Face absence threshold must be between 1 and 3600 seconds.".into());
    }
    if !request.gaze_away_seconds.is_finite()
        || !(1.0..=3600.0).contains(&request.gaze_away_seconds)
    {
        return Err("Gaze-away threshold must be between 1 and 3600 seconds.".into());
    }
    if !request.cooldown_seconds.is_finite()
        || !(0.0..=3600.0).contains(&request.cooldown_seconds)
    {
        return Err("Reminder cooldown must be between 0 and 3600 seconds.".into());
    }

    close_reminder_window(&app);
    stop_internal(&state);

    let launcher = resolve_runtime(&app)?;
    let generation = state.generation.fetch_add(1, Ordering::SeqCst) + 1;

    let mut command = match &launcher {
        WorkerLauncher::Python {
            python,
            root,
            model,
        } => {
            if !model.is_file() {
                return Err(format!(
                    "The local face model is missing at {}. Reinstall the application files.",
                    model.display()
                ));
            }
            let mut command = Command::new(python);
            command.arg("-m").arg("vision.main");
            command.current_dir(root);
            command
        }
        WorkerLauncher::Frozen { executable, root } => {
            let mut command = Command::new(executable);
            command.current_dir(root);
            command
        }
    };

    command
        .arg("--camera")
        .arg(request.camera_index.to_string())
        .arg("--absence-seconds")
        .arg(request.absence_seconds.to_string())
        .arg("--gaze-seconds")
        .arg(request.gaze_away_seconds.to_string())
        .arg("--cooldown-seconds")
        .arg(request.cooldown_seconds.to_string());

    if let WorkerLauncher::Python { model, .. } = &launcher {
        command.arg("--model").arg(model);
    }

    let launcher_label = match &launcher {
        WorkerLauncher::Python { python, .. } => python.display().to_string(),
        WorkerLauncher::Frozen { executable, .. } => executable.display().to_string(),
    };

    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            format!(
                "Could not start the local vision worker using {launcher_label}: {error}"
            )
        })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Could not read from the vision worker.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Could not read vision worker diagnostics.".to_string())?;

    *state
        .intention
        .lock()
        .map_err(|_| "Monitoring state is unavailable.".to_string())? = intention;
    *state
        .child
        .lock()
        .map_err(|_| "Monitoring state is unavailable.".to_string())? = Some(child);

    let stderr_tail = Arc::new(Mutex::new(VecDeque::<String>::new()));
    spawn_stderr_reader(stderr, Arc::clone(&stderr_tail));
    spawn_event_reader(app, generation, stdout, stderr_tail);

    Ok(())
}

#[tauri::command]
pub fn stop_monitoring(app: AppHandle, state: State<'_, MonitorState>) -> Result<(), String> {
    stop_internal(&state);
    close_reminder_window(&app);
    Ok(())
}

fn stop_internal(state: &MonitorState) {
    // Invalidate event handlers from the process being stopped before waiting.
    state.generation.fetch_add(1, Ordering::SeqCst);

    let Ok(mut guard) = state.child.lock() else {
        return;
    };
    let Some(mut child) = guard.take() else {
        return;
    };

    if let Some(stdin) = child.stdin.as_mut() {
        let _ = writeln!(stdin, "{}", json!({ "type": "stop" }));
        let _ = stdin.flush();
    }

    let deadline = Instant::now() + STOP_GRACE;
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => thread::sleep(Duration::from_millis(25)),
            Err(_) => break,
        }
    }

    // The worker is designed to exit on the stop message, but never leave the
    // camera held if it is stuck.
    let _ = child.kill();
    let _ = child.wait();
}

fn close_reminder_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("reminder") {
        let _ = window.close();
    }
}

fn spawn_event_reader(
    app: AppHandle,
    generation: u64,
    stdout: std::process::ChildStdout,
    stderr_tail: Arc<Mutex<VecDeque<String>>>,
) {
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut saw_error = false;

        for line in reader.lines() {
            let Ok(line) = line else { break };
            let Ok(event) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            if !is_current(&app, generation) {
                continue;
            }

            match event.get("type").and_then(Value::as_str) {
                Some("ready") => {
                    let _ = app.emit(
                        "monitoring:status",
                        json!({
                            "status": "calibrating",
                            "facePresent": false,
                            "absenceSeconds": 0.0,
                            "calibrationProgress": 0.0,
                            "gazeAvailable": false,
                            "gazeAway": false,
                            "gazeAwaySeconds": 0.0,
                            "gazeReason": "",
                            "cameraIndex": event.get("camera").cloned().unwrap_or(Value::Null),
                        }),
                    );
                }
                Some("calibration") => {
                    let _ = app.emit(
                        "monitoring:status",
                        json!({
                            "status": "calibrating",
                            "facePresent": event.get("facePresent").cloned().unwrap_or(Value::Bool(false)),
                            "absenceSeconds": 0.0,
                            "calibrationProgress": event.get("progress").cloned().unwrap_or(json!(0.0)),
                            "gazeAvailable": false,
                            "gazeAway": false,
                            "gazeAwaySeconds": 0.0,
                            "gazeReason": "Calibration in progress.",
                        }),
                    );
                }
                Some("calibrated") => {
                    let enabled = event
                        .get("enabled")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    let _ = app.emit(
                        "monitoring:status",
                        json!({
                            "status": "active",
                            "facePresent": event.get("facePresent").cloned().unwrap_or(Value::Bool(false)),
                            "absenceSeconds": 0.0,
                            "calibrationProgress": 1.0,
                            "gazeAvailable": enabled,
                            "gazeAway": false,
                            "gazeAwaySeconds": 0.0,
                            "gazeReason": event.get("reason").and_then(Value::as_str).unwrap_or(""),
                        }),
                    );
                }
                Some("status") => {
                    let _ = app.emit(
                        "monitoring:status",
                        json!({
                            "status": "active",
                            "facePresent": event.get("facePresent").cloned().unwrap_or(Value::Bool(false)),
                            "absenceSeconds": event.get("absenceSeconds").cloned().unwrap_or(json!(0.0)),
                            "gazeAvailable": event.get("gazeAvailable").cloned().unwrap_or(Value::Bool(false)),
                            "gazeAway": event.get("gazeAway").cloned().unwrap_or(Value::Bool(false)),
                            "gazeAwaySeconds": event.get("gazeAwaySeconds").cloned().unwrap_or(json!(0.0)),
                            "gazeReason": event.get("gazeReason").and_then(Value::as_str).unwrap_or(""),
                        }),
                    );
                }
                Some("reminder") => {
                    let intention = app
                        .state::<MonitorState>()
                        .intention
                        .lock()
                        .map(|value| value.clone())
                        .unwrap_or_default();
                    let kind = event
                        .get("kind")
                        .and_then(Value::as_str)
                        .unwrap_or("away")
                        .to_string();
                    let payload = ReminderPayload {
                        message: crate::reminder::next_message(&kind).to_string(),
                        kind,
                        intention,
                        trigger_seconds: event
                            .get("seconds")
                            .and_then(Value::as_f64)
                            .unwrap_or(0.0),
                    };
                    let _ = app.emit("monitoring:reminder", &payload);
                    show_reminder(&app, payload);
                }
                Some("error") => {
                    saw_error = true;
                    let _ = app.emit(
                        "monitoring:error",
                        json!({
                            "code": event.get("code").and_then(Value::as_str).unwrap_or("vision_failure"),
                            "message": event.get("message").and_then(Value::as_str).unwrap_or("The vision worker stopped unexpectedly."),
                        }),
                    );
                }
                _ => {}
            }
        }

        if is_current(&app, generation) && !saw_error {
            let detail = stderr_tail
                .lock()
                .map(|lines| {
                    lines
                        .iter()
                        .skip(lines.len().saturating_sub(2))
                        .cloned()
                        .collect::<Vec<_>>()
                        .join(" | ")
                })
                .unwrap_or_default();
            let mut message = String::from(
                "The local vision worker stopped unexpectedly. Check that the camera is still connected.",
            );
            if !detail.is_empty() {
                message.push(' ');
                message.extend(detail.chars().take(300));
            }
            let _ = app.emit(
                "monitoring:error",
                json!({ "code": "vision_exited", "message": message }),
            );
        }
    });
}

fn spawn_stderr_reader(
    stderr: std::process::ChildStderr,
    tail: Arc<Mutex<VecDeque<String>>>,
) {
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            // MediaPipe emits harmless initialization warnings on stderr. Keep
            // them out of the UI but visible to developers in the terminal.
            eprintln!("[vision] {line}");
            if let Ok(mut lines) = tail.lock() {
                if lines.len() == 6 {
                    lines.pop_front();
                }
                lines.push_back(line);
            }
        }
    });
}

fn is_current(app: &AppHandle, generation: u64) -> bool {
    app.state::<MonitorState>()
        .generation
        .load(Ordering::SeqCst)
        == generation
}

fn resolve_runtime(app: &AppHandle) -> Result<WorkerLauncher, String> {
    if let Ok(explicit) = env::var("FOCUS_VISION_WORKER") {
        let executable = PathBuf::from(explicit);
        if executable.is_file() {
            let root = executable
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| PathBuf::from("."));
            return Ok(WorkerLauncher::Frozen { executable, root });
        }
        return Err(format!(
            "FOCUS_VISION_WORKER points to {}, but that executable does not exist.",
            executable.display()
        ));
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        for relative in [
            Path::new("vision-worker").join("focus-vision"),
            Path::new("resources")
                .join("vision-worker")
                .join("focus-vision"),
        ] {
            let executable = resource_dir.join(relative);
            if executable.is_file() {
                let root = executable
                    .parent()
                    .map(Path::to_path_buf)
                    .unwrap_or_else(|| resource_dir.clone());
                return Ok(WorkerLauncher::Frozen { executable, root });
            }
        }
    }

    if let Ok(root) = env::var("FOCUS_VISION_ROOT") {
        let root = PathBuf::from(root);
        let python = resolve_python(&root)?;
        let model = root.join("vision").join("models").join("face_landmarker.task");
        return Ok(WorkerLauncher::Python {
            python,
            root,
            model,
        });
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(current_dir) = env::current_dir() {
        candidates.extend(current_dir.ancestors().take(6).map(Path::to_path_buf));
    }
    if let Ok(executable) = env::current_exe() {
        candidates.extend(executable.ancestors().take(6).map(Path::to_path_buf));
    }

    let root = candidates
        .into_iter()
        .find(|candidate| candidate.join("vision").join("main.py").is_file())
        .ok_or_else(|| {
            "Could not locate the local vision files. Run the app from the project directory, install the packaged worker, or set FOCUS_VISION_ROOT / FOCUS_VISION_WORKER."
                .to_string()
        })?;

    let python = resolve_python(&root)?;
    let model = root.join("vision").join("models").join("face_landmarker.task");
    Ok(WorkerLauncher::Python {
        python,
        root,
        model,
    })
}

fn resolve_python(root: &Path) -> Result<PathBuf, String> {
    if let Ok(explicit) = env::var("FOCUS_PYTHON") {
        let path = PathBuf::from(explicit);
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!(
            "FOCUS_PYTHON points to {}, but that executable does not exist.",
            path.display()
        ));
    }

    let mut candidates = vec![
        root.join(".venv").join("bin").join("python"),
        root.join("venv").join("bin").join("python"),
    ];
    if let Some(parent) = root.parent() {
        candidates.push(parent.join("venv").join("bin").join("python"));
    }

    if let Some(python) = candidates.into_iter().find(|path| path.is_file()) {
        return Ok(python);
    }

    // Fall back to PATH so a system Python with the right packages can be used.
    Ok(PathBuf::from("python3"))
}

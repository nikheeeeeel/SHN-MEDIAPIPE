use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

const AWAY_MESSAGES: &[&str] = &[
    "You've been away for a little while. Take a breath, get comfortable, and let's get back to it!",
    "Your intention is still here whenever you're ready. One small step is enough.",
    "Come back gently. A few focused minutes are worth more than a perfect plan.",
    "A short pause is part of the work. When you're ready, return to the next small step.",
    "No rush, no guilt. Your focus is waiting where you left it.",
    "Let's ease back in. Start with the easiest part of what you planned.",
    "You showed up once already. That counts — come back when you can.",
    "A quiet moment to reset, then back to the task you chose.",
];

const FOCUS_MESSAGES: &[&str] = &[
    "Your eyes have wandered for a little while. Bring them back to the screen when you're ready.",
    "A gentle reset: look back at your task and choose the next small step.",
    "Still here? Your intention is waiting. Take a breath and return when you can.",
    "Notice where your attention went, then guide it back. No judgement.",
    "A short look away is normal. Come back to the screen when it feels right.",
    "Your focus drifted, that's all. The next step is still there.",
    "Take a sip of water, then give the task another few minutes.",
    "Wherever your eyes went, your intention is right here.",
];

static MESSAGE_CURSOR: AtomicUsize = AtomicUsize::new(0);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderPayload {
    pub kind: String,
    pub intention: String,
    pub message: String,
    pub trigger_seconds: f64,
}

#[derive(Default)]
pub struct ReminderState {
    payload: Mutex<Option<ReminderPayload>>,
}

pub fn next_message(kind: &str) -> &'static str {
    let messages = if kind == "focus" {
        FOCUS_MESSAGES
    } else {
        AWAY_MESSAGES
    };
    let index = MESSAGE_CURSOR.fetch_add(1, Ordering::Relaxed) % messages.len();
    messages[index]
}

#[tauri::command]
pub fn get_reminder_payload(state: State<'_, ReminderState>) -> Option<ReminderPayload> {
    state.payload.lock().ok().and_then(|payload| payload.clone())
}

#[tauri::command]
pub fn dismiss_reminder(app: AppHandle) {
    if let Some(window) = app.get_webview_window("reminder") {
        let _ = window.close();
    }
    if let Some(state) = app.try_state::<ReminderState>() {
        if let Ok(mut payload) = state.payload.lock() {
            *payload = None;
        }
    }
}

pub fn show_reminder(app: &AppHandle, payload: ReminderPayload) {
    // Keep the main session alive if the reminder window is closed for any
    // reason. Only one reminder window is ever open at a time.
    if let Some(state) = app.try_state::<ReminderState>() {
        if let Ok(mut stored) = state.payload.lock() {
            *stored = Some(payload.clone());
        }
    }

    if let Some(window) = app.get_webview_window("reminder") {
        let _ = window.emit("reminder:update", &payload);
        let _ = window.show();
        return;
    }

    let result = WebviewWindowBuilder::new(
        app,
        "reminder",
        WebviewUrl::App("reminder.html".into()),
    )
    .title("Focus reminder")
    .inner_size(410.0, 264.0)
    .min_inner_size(360.0, 230.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .center()
    .focused(false)
    .background_color(tauri::window::Color(10, 12, 11, 255))
    .build();

    if let Err(error) = result {
        eprintln!("Could not open the reminder window: {error}");
        // The main window still receives the monitoring:reminder event so the
        // reminder count and status remain correct.
    }
}

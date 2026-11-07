mod database;
mod monitoring;
mod reminder;

use tauri::{Manager, WindowEvent};

pub fn run() {
    let app = tauri::Builder::default()
        .manage(monitoring::MonitorState::default())
        .manage(reminder::ReminderState::default())
        .setup(|app| {
            match database::init(app.handle()) {
                Ok(db) => {
                    eprintln!("[db] {}", db.path().display());
                    app.manage(db);
                    Ok(())
                }
                Err(error) => {
                    eprintln!("[db] {error}");
                    Err(error.into())
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            monitoring::start_monitoring,
            monitoring::stop_monitoring,
            reminder::get_reminder_payload,
            reminder::dismiss_reminder,
            database::load_settings,
            database::save_settings,
            database::save_session,
            database::list_sessions,
        ])
        .on_window_event(|window, event| {
            if window.label() == "main"
                && matches!(
                    event,
                    WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
                )
            {
                let app = window.app_handle();
                monitoring::stop_on_exit(app);
                if let Some(reminder) = app.get_webview_window("reminder") {
                    let _ = reminder.close();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Focus");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            monitoring::stop_on_exit(app_handle);
        }
    });
}

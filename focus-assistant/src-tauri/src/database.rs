use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredSettings {
    pub absence_seconds: i64,
    pub gaze_away_seconds: i64,
    pub cooldown_seconds: i64,
    pub camera_index: i64,
}

impl Default for StoredSettings {
    fn default() -> Self {
        Self {
            absence_seconds: 120,
            gaze_away_seconds: 180,
            cooldown_seconds: 300,
            camera_index: 0,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    #[serde(default)]
    pub id: Option<i64>,
    pub intention: String,
    pub planned_seconds: i64,
    pub actual_seconds: i64,
    pub attentive_seconds: Option<i64>,
    pub away_seconds: Option<i64>,
    pub reminders: i64,
    pub hangman_parts: i64,
    pub outcome: String,
    pub started_at: String,
    pub ended_at: String,
}

pub struct Database {
    conn: Mutex<Connection>,
    path: PathBuf,
}

impl Database {
    pub fn path(&self) -> &PathBuf {
        &self.path
    }

    fn connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.conn
            .lock()
            .map_err(|_| "The local database is unavailable.".to_string())
    }
}

pub fn init(app: &AppHandle) -> Result<Database, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not find the app data directory: {error}"))?;
    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("Could not create the app data directory: {error}"))?;

    let path = data_dir.join("focus.db");
    let conn = Connection::open(&path)
        .map_err(|error| format!("Could not open the local database: {error}"))?;

    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            absence_seconds INTEGER NOT NULL,
            gaze_away_seconds INTEGER NOT NULL,
            cooldown_seconds INTEGER NOT NULL,
            camera_index INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            intention TEXT NOT NULL,
            planned_seconds INTEGER NOT NULL,
            actual_seconds INTEGER NOT NULL,
            attentive_seconds INTEGER,
            away_seconds INTEGER,
            reminders INTEGER NOT NULL,
            hangman_parts INTEGER NOT NULL DEFAULT 0,
            outcome TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_ended_at
            ON sessions(ended_at DESC);
        ",
    )
    .map_err(|error| format!("Could not initialize the local database: {error}"))?;

    Ok(Database {
        conn: Mutex::new(conn),
        path,
    })
}

#[tauri::command]
pub fn load_settings(db: State<'_, Database>) -> Result<Option<StoredSettings>, String> {
    let connection = db.connection()?;
    connection
        .query_row(
            "SELECT absence_seconds, gaze_away_seconds, cooldown_seconds, camera_index
             FROM settings WHERE id = 1",
            [],
            |row| {
                Ok(StoredSettings {
                    absence_seconds: row.get(0)?,
                    gaze_away_seconds: row.get(1)?,
                    cooldown_seconds: row.get(2)?,
                    camera_index: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("Could not read settings: {error}"))
}

#[tauri::command]
pub fn save_settings(db: State<'_, Database>, settings: StoredSettings) -> Result<(), String> {
    if !(1..=86_400).contains(&settings.absence_seconds)
        || !(1..=86_400).contains(&settings.gaze_away_seconds)
        || !(0..=86_400).contains(&settings.cooldown_seconds)
        || !(0..=32).contains(&settings.camera_index)
    {
        return Err("Settings are outside the supported range.".into());
    }

    let connection = db.connection()?;
    connection
        .execute(
            "INSERT INTO settings
                (id, absence_seconds, gaze_away_seconds, cooldown_seconds, camera_index, updated_at)
             VALUES (1, ?1, ?2, ?3, ?4, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                absence_seconds = excluded.absence_seconds,
                gaze_away_seconds = excluded.gaze_away_seconds,
                cooldown_seconds = excluded.cooldown_seconds,
                camera_index = excluded.camera_index,
                updated_at = excluded.updated_at",
            params![
                settings.absence_seconds,
                settings.gaze_away_seconds,
                settings.cooldown_seconds,
                settings.camera_index,
            ],
        )
        .map_err(|error| format!("Could not save settings: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn save_session(db: State<'_, Database>, session: SessionRecord) -> Result<i64, String> {
    if session.intention.trim().is_empty() {
        return Err("Cannot save a session without an intention.".into());
    }
    if !matches!(session.outcome.as_str(), "completed" | "ended" | "lost") {
        return Err("Unknown session outcome.".into());
    }

    let connection = db.connection()?;
    connection
        .execute(
            "INSERT INTO sessions
                (intention, planned_seconds, actual_seconds, attentive_seconds,
                 away_seconds, reminders, hangman_parts, outcome, started_at, ended_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                session.intention.trim(),
                session.planned_seconds.max(0),
                session.actual_seconds.max(0),
                session.attentive_seconds,
                session.away_seconds,
                session.reminders.max(0),
                session.hangman_parts.max(0),
                session.outcome,
                session.started_at,
                session.ended_at,
            ],
        )
        .map_err(|error| format!("Could not save the session: {error}"))?;
    Ok(connection.last_insert_rowid())
}

#[tauri::command]
pub fn list_sessions(
    db: State<'_, Database>,
    limit: Option<u32>,
) -> Result<Vec<SessionRecord>, String> {
    let connection = db.connection()?;
    let limit = limit.unwrap_or(50).clamp(1, 200);
    let mut statement = connection
        .prepare(
            "SELECT id, intention, planned_seconds, actual_seconds, attentive_seconds,
                    away_seconds, reminders, hangman_parts, outcome, started_at, ended_at
             FROM sessions
             ORDER BY ended_at DESC, id DESC
             LIMIT ?1",
        )
        .map_err(|error| format!("Could not prepare history: {error}"))?;

    let rows = statement
        .query_map([limit as i64], |row| {
            Ok(SessionRecord {
                id: Some(row.get(0)?),
                intention: row.get(1)?,
                planned_seconds: row.get(2)?,
                actual_seconds: row.get(3)?,
                attentive_seconds: row.get(4)?,
                away_seconds: row.get(5)?,
                reminders: row.get(6)?,
                hangman_parts: row.get(7)?,
                outcome: row.get(8)?,
                started_at: row.get(9)?,
                ended_at: row.get(10)?,
            })
        })
        .map_err(|error| format!("Could not read history: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Could not read history: {error}"))
}

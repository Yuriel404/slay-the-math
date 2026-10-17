//! Desktop host for 数字尖塔.
//!
//! The game keeps every rule in TypeScript. Rust only owns durable storage:
//! the JSON save lives next to the app data directory, written through a
//! temporary file so a crash mid-write cannot corrupt the current run.

use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Saves are namespaced under this folder inside the platform app-data dir.
const STORE_DIR: &str = "store";

/// Only plain identifiers reach the filesystem, so a crafted save name can
/// never escape the store directory.
fn safe_name(name: &str) -> Result<&str, String> {
    let ok = !name.is_empty()
        && name.len() <= 64
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if ok {
        Ok(name)
    } else {
        Err(format!("非法的存档名：{name}"))
    }
}

fn store_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join(STORE_DIR);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join(format!("{}.json", safe_name(name)?)))
}

/// Read one stored document. A missing document is not an error: the caller
/// treats it as "no run yet" and starts a fresh game.
#[tauri::command]
fn store_read(app: tauri::AppHandle, name: String) -> Result<Option<String>, String> {
    let path = store_path(&app, &name)?;
    match fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

/// Write one stored document atomically (temp file + rename).
#[tauri::command]
fn store_write(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
    let path = store_path(&app, &name)?;
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, contents).map_err(|error| error.to_string())?;
    fs::rename(&temp, &path).map_err(|error| error.to_string())?;
    Ok(())
}

/// Absolute path of the save folder, for the "open folder" affordance.
#[tauri::command]
fn store_location(app: tauri::AppHandle) -> Result<String, String> {
    let path = store_path(&app, "current")?;
    Ok(path
        .parent()
        .map(|dir| dir.display().to_string())
        .unwrap_or_default())
}

/// Read a user-chosen JSON file (import). The dialog picks the path in the UI
/// layer; the host only reads what was chosen.
#[tauri::command]
fn file_read(path: String) -> Result<String, String> {
    let meta = fs::metadata(&path).map_err(|error| error.to_string())?;
    if meta.len() > 4 * 1024 * 1024 {
        return Err("存档文件过大（上限 4 MB）".into());
    }
    fs::read_to_string(PathBuf::from(path)).map_err(|error| error.to_string())
}

/// Write a user-chosen JSON file (export).
#[tauri::command]
fn file_write(path: String, contents: String) -> Result<(), String> {
    fs::write(PathBuf::from(path), contents).map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            store_read,
            store_write,
            store_location,
            file_read,
            file_write
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动数字尖塔失败");
}

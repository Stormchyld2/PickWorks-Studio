//! Native side of PickWorks Studio.
//!
//! Learning logic lives in TypeScript engines (src/lib/engines). Rust handles
//! what the WebView cannot: safe file storage, backups, printing and native
//! audio input where needed. Storage commands arrive in Milestone 5.

use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
    name: &'static str,
    version: &'static str,
}

pub fn app_info_value() -> AppInfo {
    AppInfo {
        name: "PickWorks Studio",
        version: env!("CARGO_PKG_VERSION"),
    }
}

#[tauri::command]
fn app_info() -> AppInfo {
    app_info_value()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running PickWorks Studio");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_name_and_version() {
        let info = app_info_value();
        assert_eq!(info.name, "PickWorks Studio");
        assert!(!info.version.is_empty());
    }
}

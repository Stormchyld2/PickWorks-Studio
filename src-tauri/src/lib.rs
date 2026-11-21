//! Native side of PickWorks Studio.
//!
//! Learning logic lives in TypeScript engines (src/lib/engines). Storage,
//! accounts, sessions and the audit log live in the `pickworks-core` crate,
//! which has no Tauri dependency and is tested on its own. This file wires it
//! into the app and adds platform checks.

mod commands;
mod platform;

use std::sync::Mutex;

use serde::Serialize;
use tauri::Manager;

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

/// Refuses navigation away from the app's own pages (no external browsing).
fn navigation_guard<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|_webview, url| platform::is_allowed_navigation(url.as_str()))
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(navigation_guard())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            let core = pickworks_core::Core::open(dir, pickworks_core::system_clock())?;
            app.manage(commands::CoreState(Mutex::new(core)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            commands::auth_needs_setup,
            commands::auth_setup_admin,
            commands::auth_list_profiles,
            commands::auth_sign_in_student,
            commands::auth_sign_in_admin,
            commands::auth_sign_out,
            commands::auth_change_password,
            commands::auth_recover_with_key,
            commands::auth_recover_with_windows_admin,
            commands::auth_launch_mode,
            commands::auth_relaunch_elevated,
            commands::admin_list_students,
            commands::admin_create_student,
            commands::admin_rename_student,
            commands::admin_reset_password,
            commands::admin_unlock,
            commands::admin_set_status,
            commands::admin_recent_audit,
            commands::admin_set_avatar,
            commands::admin_delete_student,
            commands::admin_list_backups,
            commands::admin_backup_student,
            commands::admin_backup_installation,
            commands::admin_restore_student,
            commands::admin_restore_installation,
            commands::admin_new_recovery_key,
            commands::data_read,
            commands::data_write,
            commands::data_append,
            commands::data_read_log,
        ])
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

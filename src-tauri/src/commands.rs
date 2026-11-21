//! Thin Tauri commands over `pickworks_core::Core`. No rules live here: every
//! check (sessions, ownership, throttling, admin rights) is enforced in core.

use std::sync::Mutex;

use pickworks_core::accounts::AccountStatus;
use pickworks_core::audit::AuditEntry;
use pickworks_core::{Core, ElevationProof, ErrorPayload, ProfileCard, SessionInfo, StudentAdminView};
use serde_json::Value;
use tauri::State;

pub struct CoreState(pub Mutex<Core>);

type Res<T> = Result<T, ErrorPayload>;

fn with<T>(state: &State<CoreState>, f: impl FnOnce(&mut Core) -> pickworks_core::Result<T>) -> Res<T> {
    let mut core = state.0.lock().unwrap_or_else(|p| p.into_inner());
    f(&mut core).map_err(ErrorPayload::from)
}

#[tauri::command]
pub fn auth_needs_setup(state: State<CoreState>) -> Res<bool> {
    with(&state, |c| c.needs_setup())
}

#[tauri::command]
pub fn auth_setup_admin(state: State<CoreState>, display_name: String, password: String) -> Res<String> {
    with(&state, |c| c.setup_admin(&display_name, &password))
}

#[tauri::command]
pub fn auth_list_profiles(state: State<CoreState>) -> Res<Vec<ProfileCard>> {
    with(&state, |c| c.list_profiles())
}

#[tauri::command]
pub fn auth_sign_in_student(state: State<CoreState>, student_id: String, password: String) -> Res<SessionInfo> {
    with(&state, |c| c.sign_in_student(&student_id, &password))
}

#[tauri::command]
pub fn auth_sign_in_admin(state: State<CoreState>, password: String) -> Res<SessionInfo> {
    with(&state, |c| c.sign_in_admin(&password))
}

#[tauri::command]
pub fn auth_sign_out(state: State<CoreState>, token: String) -> Res<()> {
    with(&state, |c| c.sign_out(&token))
}

#[tauri::command]
pub fn auth_change_password(state: State<CoreState>, token: String, current: String, new_password: String) -> Res<()> {
    with(&state, |c| c.change_own_password(&token, &current, &new_password))
}

#[tauri::command]
pub fn auth_recover_with_key(state: State<CoreState>, recovery_key: String, new_password: String) -> Res<String> {
    with(&state, |c| c.recover_with_key(&recovery_key, &new_password))
}

/// Works only when Windows has granted this process administrator rights.
#[tauri::command]
pub fn auth_recover_with_windows_admin(state: State<CoreState>, new_password: String) -> Res<String> {
    if !crate::platform::is_elevated_admin() {
        return Err(pickworks_core::CoreError::ElevationRequired.into());
    }
    with(&state, |c| c.recover_with_windows_admin(ElevationProof::verified_by_platform(), &new_password))
}

#[tauri::command]
pub fn admin_list_students(state: State<CoreState>, token: String) -> Res<Vec<StudentAdminView>> {
    with(&state, |c| c.admin_list_students(&token))
}

#[tauri::command]
pub fn admin_create_student(state: State<CoreState>, token: String, display_name: String, temp_password: String) -> Res<String> {
    with(&state, |c| c.admin_create_student(&token, &display_name, &temp_password))
}

#[tauri::command]
pub fn admin_rename_student(state: State<CoreState>, token: String, student_id: String, display_name: String) -> Res<()> {
    with(&state, |c| c.admin_rename_student(&token, &student_id, &display_name))
}

#[tauri::command]
pub fn admin_reset_password(state: State<CoreState>, token: String, student_id: String, temp_password: String) -> Res<()> {
    with(&state, |c| c.admin_reset_password(&token, &student_id, &temp_password))
}

#[tauri::command]
pub fn admin_unlock(state: State<CoreState>, token: String, student_id: String) -> Res<()> {
    with(&state, |c| c.admin_unlock(&token, &student_id))
}

#[tauri::command]
pub fn admin_set_status(state: State<CoreState>, token: String, student_id: String, status: AccountStatus) -> Res<()> {
    with(&state, |c| c.admin_set_status(&token, &student_id, status))
}

#[tauri::command]
pub fn admin_recent_audit(state: State<CoreState>, token: String, limit: usize) -> Res<Vec<AuditEntry>> {
    with(&state, |c| c.admin_recent_audit(&token, limit.min(500)))
}

#[tauri::command]
pub fn admin_new_recovery_key(state: State<CoreState>, token: String, admin_password: String) -> Res<String> {
    with(&state, |c| c.admin_new_recovery_key(&token, &admin_password))
}

#[tauri::command]
pub fn data_read(state: State<CoreState>, token: String, record: String) -> Res<Option<Value>> {
    with(&state, |c| c.read_record(&token, &record))
}

#[tauri::command]
pub fn data_write(state: State<CoreState>, token: String, record: String, envelope: Value) -> Res<()> {
    with(&state, |c| c.write_record(&token, &record, &envelope))
}

#[tauri::command]
pub fn data_append(state: State<CoreState>, token: String, log: String, entry: Value) -> Res<()> {
    with(&state, |c| c.append_log(&token, &log, &entry))
}

#[tauri::command]
pub fn data_read_log(state: State<CoreState>, token: String, log: String) -> Res<Vec<Value>> {
    with(&state, |c| c.read_log(&token, &log))
}

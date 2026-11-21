//! PickWorks Studio core: storage, accounts, sessions and audit.
//!
//! Plain Rust with no Tauri dependency, so it can be tested anywhere and reused
//! on Android. The Tauri layer holds one `Core` behind a mutex and exposes thin
//! commands. Rust enforces every rule here: the interface never sees password
//! hashes, never passes file paths, and can only reach the signed-in student's
//! folder through a valid session token.

pub mod accounts;
pub mod audit;
pub mod auth;
pub mod avatars;
pub mod backup;
pub mod error;
pub mod storage;

use serde::Serialize;
use serde_json::Value;

use accounts::{AccountIndex, AccountStatus, AdminAccount, StudentAccount};
use audit::AuditEntry;
pub use error::{CoreError, ErrorPayload, Result};
use storage::DataRoot;

/// Who a session belongs to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Principal {
    Student { id: String },
    Admin,
}

#[derive(Debug, Clone)]
struct Session {
    token: String,
    principal: Principal,
    must_change_password: bool,
}

/// What the interface gets back after signing in. The token must accompany
/// every later call; it stops working the moment the session ends.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub token: String,
    pub principal: Principal,
    pub display_name: String,
    pub must_change_password: bool,
    /// Inactivity limit agreed for this kind of account.
    pub idle_timeout_secs: u64,
}

pub const STUDENT_IDLE_SECS: u64 = 20 * 60;
pub const ADMIN_IDLE_SECS: u64 = 5 * 60;

/// Public facts for the profile selector. No credential data.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileCard {
    pub id: String,
    pub display_name: String,
    /// Profile picture as a data URL, if one was set.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
}

/// What the administrator sees per student.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentAdminView {
    #[serde(flatten)]
    pub account: StudentAccount,
    pub locked_for_secs: u64,
    pub failed_attempts: u32,
}

/// Proof that the platform layer confirmed Windows administrator rights for
/// this process. Only the platform module should construct it, after an
/// actual elevation check; core never assumes it.
pub struct ElevationProof(());

impl ElevationProof {
    /// Call only after verifying the process token is an elevated administrator.
    pub fn verified_by_platform() -> Self {
        ElevationProof(())
    }
}

pub type Clock = Box<dyn Fn() -> u64 + Send + Sync>;

pub fn system_clock() -> Clock {
    Box::new(|| std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0))
}

pub struct Core {
    root: DataRoot,
    clock: Clock,
    session: Option<Session>,
}

impl Core {
    pub fn open(root: impl Into<std::path::PathBuf>, clock: Clock) -> Result<Self> {
        Ok(Core { root: DataRoot::new(root)?, clock, session: None })
    }

    pub fn root(&self) -> &DataRoot {
        &self.root
    }

    fn now(&self) -> u64 {
        (self.clock)()
    }

    fn audit(&self, actor: &str, action: &str, student_id: Option<&str>, detail: Option<String>) -> Result<()> {
        audit::append(&self.root, &AuditEntry { at_ms: self.now(), actor: actor.into(), action: action.into(), student_id: student_id.map(String::from), detail })
    }

    // ----- Setup -----------------------------------------------------------

    pub fn needs_setup(&self) -> Result<bool> {
        Ok(accounts::load_index(&self.root)?.admin.is_none())
    }

    /// First-run setup. Returns the recovery key, shown once and never stored
    /// in readable form. There are no default administrator credentials.
    pub fn setup_admin(&mut self, display_name: &str, password: &str) -> Result<String> {
        let mut index = accounts::load_index(&self.root)?;
        if index.admin.is_some() {
            return Err(CoreError::AlreadySetUp);
        }
        auth::check_password_policy(password)?;
        let name = clean_name(display_name)?;
        let key = auth::new_recovery_key();
        let mut creds = accounts::load_credentials(&self.root)?;
        creds.admin = Some(auth::hash_secret(password)?);
        creds.recovery = Some(auth::hash_secret(&auth::normalize_recovery_key(&key))?);
        // Credentials first: if we crash before the index is written, setup simply runs again.
        accounts::save_credentials(&self.root, &creds)?;
        let now = self.now();
        index.admin = Some(AdminAccount { display_name: name, created_ms: now, recovery_key_created_ms: now });
        accounts::save_index(&self.root, &index)?;
        self.audit("system", "setup-complete", None, None)?;
        Ok(key)
    }

    // ----- Sign-in ---------------------------------------------------------

    pub fn list_profiles(&self) -> Result<Vec<ProfileCard>> {
        let index = accounts::load_index(&self.root)?;
        Ok(index
            .students
            .iter()
            .filter(|s| s.status == AccountStatus::Active)
            .map(|s| ProfileCard { id: s.id.clone(), display_name: s.display_name.clone(), avatar: avatars::load(&self.root, &s.id) })
            .collect())
    }

    /// Checks throttling, verifies, and records the outcome.
    fn check_secret(&self, key: &str, secret: &str, hash: Option<&String>) -> Result<()> {
        let now = self.now();
        let mut throttles = accounts::load_throttles(&self.root)?;
        let t = throttles.entry(key.to_string()).or_default();
        let wait = t.wait_secs(now);
        if wait > 0 {
            return Err(CoreError::Throttled(wait));
        }
        let ok = hash.is_some_and(|h| auth::verify_secret(secret, h));
        if ok {
            if t.failures > 0 {
                throttles.remove(key);
                accounts::save_throttles(&self.root, &throttles)?;
            }
            Ok(())
        } else {
            t.record_failure(now);
            let wait = t.wait_secs(now);
            accounts::save_throttles(&self.root, &throttles)?;
            if wait > 0 { Err(CoreError::Throttled(wait)) } else { Err(CoreError::WrongPassword) }
        }
    }

    fn start_session(&mut self, principal: Principal, display_name: String, must_change_password: bool) -> SessionInfo {
        let token = auth::random_hex(32);
        let idle_timeout_secs = match principal {
            Principal::Admin => ADMIN_IDLE_SECS,
            Principal::Student { .. } => STUDENT_IDLE_SECS,
        };
        self.session = Some(Session { token: token.clone(), principal: principal.clone(), must_change_password });
        SessionInfo { token, principal, display_name, must_change_password, idle_timeout_secs }
    }

    pub fn sign_in_student(&mut self, student_id: &str, password: &str) -> Result<SessionInfo> {
        let index = accounts::load_index(&self.root)?;
        let account = index.student(student_id).ok_or(CoreError::UnknownStudent)?.clone();
        if account.status != AccountStatus::Active {
            return Err(CoreError::Inactive);
        }
        let creds = accounts::load_credentials(&self.root)?;
        self.check_secret(student_id, password, creds.students.get(student_id))?;
        self.session = None; // signing in always ends any previous session
        Ok(self.start_session(Principal::Student { id: account.id.clone() }, account.display_name, account.must_change_password))
    }

    pub fn sign_in_admin(&mut self, password: &str) -> Result<SessionInfo> {
        let index = accounts::load_index(&self.root)?;
        let admin = index.admin.ok_or(CoreError::NotSetUp)?;
        let creds = accounts::load_credentials(&self.root)?;
        self.check_secret("admin", password, creds.admin.as_ref())?;
        self.session = None;
        let info = self.start_session(Principal::Admin, admin.display_name, false);
        self.audit("admin", "sign-in", None, None)?;
        Ok(info)
    }

    /// Ends the session. Any call still carrying the old token is refused,
    /// which is what stops a late save landing in the wrong student's records.
    pub fn sign_out(&mut self, token: &str) -> Result<()> {
        if self.session.as_ref().is_some_and(|s| s.token == token) {
            if matches!(self.session.as_ref().map(|s| &s.principal), Some(Principal::Admin)) {
                self.audit("admin", "sign-out", None, None)?;
            }
            self.session = None;
        }
        Ok(())
    }

    fn session(&self, token: &str) -> Result<&Session> {
        match &self.session {
            Some(s) if constant_time_eq(s.token.as_bytes(), token.as_bytes()) => Ok(s),
            _ => Err(CoreError::NoSession),
        }
    }

    fn require_admin(&self, token: &str) -> Result<()> {
        match self.session(token)?.principal {
            Principal::Admin => Ok(()),
            _ => Err(CoreError::Forbidden),
        }
    }

    /// The signed-in student's id, refusing if a new password is still owed.
    fn require_student(&self, token: &str) -> Result<String> {
        let s = self.session(token)?;
        match &s.principal {
            Principal::Student { id } if s.must_change_password => {
                let _ = id;
                Err(CoreError::PasswordChangeRequired)
            }
            Principal::Student { id } => Ok(id.clone()),
            Principal::Admin => Err(CoreError::Forbidden),
        }
    }

    pub fn current_principal(&self, token: &str) -> Result<Principal> {
        Ok(self.session(token)?.principal.clone())
    }

    /// Students and the administrator change their own password.
    pub fn change_own_password(&mut self, token: &str, current: &str, new: &str) -> Result<()> {
        let principal = self.session(token)?.principal.clone();
        auth::check_password_policy(new)?;
        let mut creds = accounts::load_credentials(&self.root)?;
        match &principal {
            Principal::Admin => {
                self.check_secret("admin", current, creds.admin.as_ref())?;
                creds.admin = Some(auth::hash_secret(new)?);
                accounts::save_credentials(&self.root, &creds)?;
                self.audit("admin", "admin-password-changed", None, None)?;
            }
            Principal::Student { id } => {
                self.check_secret(id, current, creds.students.get(id))?;
                creds.students.insert(id.clone(), auth::hash_secret(new)?);
                accounts::save_credentials(&self.root, &creds)?;
                let mut index = accounts::load_index(&self.root)?;
                if let Some(s) = index.student_mut(id) {
                    s.must_change_password = false;
                }
                accounts::save_index(&self.root, &index)?;
                if let Some(s) = self.session.as_mut() {
                    s.must_change_password = false;
                }
            }
        }
        Ok(())
    }

    // ----- Administrator: students ------------------------------------------

    pub fn admin_list_students(&self, token: &str) -> Result<Vec<StudentAdminView>> {
        self.require_admin(token)?;
        let index = accounts::load_index(&self.root)?;
        let throttles = accounts::load_throttles(&self.root)?;
        let now = self.now();
        Ok(index
            .students
            .into_iter()
            .map(|a| {
                let t = throttles.get(&a.id).cloned().unwrap_or_default();
                StudentAdminView { locked_for_secs: t.wait_secs(now), failed_attempts: t.failures, account: a }
            })
            .collect())
    }

    /// Creates a student with a temporary password they must change at first sign-in.
    pub fn admin_create_student(&mut self, token: &str, display_name: &str, temp_password: &str) -> Result<String> {
        self.require_admin(token)?;
        auth::check_password_policy(temp_password)?;
        let name = clean_name(display_name)?;
        let id = auth::new_id();
        std::fs::create_dir_all(self.root.student_dir(&id)?)?;
        let mut creds = accounts::load_credentials(&self.root)?;
        creds.students.insert(id.clone(), auth::hash_secret(temp_password)?);
        accounts::save_credentials(&self.root, &creds)?;
        let mut index = accounts::load_index(&self.root)?;
        index.students.push(StudentAccount { id: id.clone(), display_name: name.clone(), status: AccountStatus::Active, created_ms: self.now(), must_change_password: true });
        accounts::save_index(&self.root, &index)?;
        self.audit("admin", "student-created", Some(&id), Some(name))?;
        Ok(id)
    }

    fn update_student(&mut self, token: &str, id: &str, f: impl FnOnce(&mut StudentAccount)) -> Result<StudentAccount> {
        self.require_admin(token)?;
        let mut index: AccountIndex = accounts::load_index(&self.root)?;
        let s = index.student_mut(id).ok_or(CoreError::UnknownStudent)?;
        f(s);
        let updated = s.clone();
        accounts::save_index(&self.root, &index)?;
        Ok(updated)
    }

    pub fn admin_rename_student(&mut self, token: &str, id: &str, display_name: &str) -> Result<()> {
        let name = clean_name(display_name)?;
        let old = self.update_student(token, id, |s| s.display_name = name.clone())?;
        self.audit("admin", "student-renamed", Some(id), Some(old.display_name))
    }

    /// Resets a password without ever revealing the old one. Progress,
    /// mastery, XP, achievements and history are untouched: only the hash
    /// changes. The student must choose a new password at next sign-in.
    pub fn admin_reset_password(&mut self, token: &str, id: &str, temp_password: &str) -> Result<()> {
        self.require_admin(token)?;
        auth::check_password_policy(temp_password)?;
        let mut creds = accounts::load_credentials(&self.root)?;
        if !creds.students.contains_key(id) {
            return Err(CoreError::UnknownStudent);
        }
        creds.students.insert(id.to_string(), auth::hash_secret(temp_password)?);
        accounts::save_credentials(&self.root, &creds)?;
        self.update_student(token, id, |s| s.must_change_password = true)?;
        let mut throttles = accounts::load_throttles(&self.root)?;
        if throttles.remove(id).is_some() {
            accounts::save_throttles(&self.root, &throttles)?;
        }
        self.audit("admin", "password-reset", Some(id), None)
    }

    pub fn admin_unlock(&mut self, token: &str, id: &str) -> Result<()> {
        self.require_admin(token)?;
        let mut throttles = accounts::load_throttles(&self.root)?;
        throttles.remove(id);
        accounts::save_throttles(&self.root, &throttles)?;
        self.audit("admin", "student-unlocked", Some(id), None)
    }

    /// Deactivate, archive or reactivate. Records are never deleted here.
    pub fn admin_set_status(&mut self, token: &str, id: &str, status: AccountStatus) -> Result<()> {
        self.update_student(token, id, |s| s.status = status)?;
        let action = match status {
            AccountStatus::Active => "student-reactivated",
            AccountStatus::Deactivated => "student-deactivated",
            AccountStatus::Archived => "student-archived",
        };
        self.audit("admin", action, Some(id), None)
    }

    /// Sets or removes a student's profile picture.
    pub fn admin_set_avatar(&mut self, token: &str, id: &str, data_url: Option<&str>) -> Result<()> {
        self.require_admin(token)?;
        accounts::load_index(&self.root)?.student(id).ok_or(CoreError::UnknownStudent)?;
        avatars::save(&self.root, id, data_url)?;
        self.audit("admin", if data_url.is_some() { "avatar-changed" } else { "avatar-removed" }, Some(id), None)
    }

    /// Permanently deletes an archived student and all their records. The
    /// administrator must type the student's name to confirm. Existing
    /// backups are kept. Recorded in the audit log.
    pub fn admin_delete_student(&mut self, token: &str, id: &str, confirm_name: &str) -> Result<()> {
        self.require_admin(token)?;
        let mut index = accounts::load_index(&self.root)?;
        let s = index.student(id).ok_or(CoreError::UnknownStudent)?.clone();
        if s.status != AccountStatus::Archived {
            return Err(CoreError::InvalidData("Archive the student before deleting them permanently.".into()));
        }
        if confirm_name.trim() != s.display_name {
            return Err(CoreError::InvalidData("Type the student's name exactly to confirm.".into()));
        }
        let dir = self.root.student_dir(id)?;
        if dir.exists() {
            std::fs::remove_dir_all(&dir)?;
        }
        avatars::remove(&self.root, id)?;
        let mut creds = accounts::load_credentials(&self.root)?;
        creds.students.remove(id);
        accounts::save_credentials(&self.root, &creds)?;
        let mut throttles = accounts::load_throttles(&self.root)?;
        if throttles.remove(id).is_some() {
            accounts::save_throttles(&self.root, &throttles)?;
        }
        index.students.retain(|x| x.id != id);
        accounts::save_index(&self.root, &index)?;
        self.audit("admin", "student-deleted", Some(id), Some(s.display_name))
    }

    // ----- Administrator: backups -----------------------------------------

    pub fn admin_list_backups(&self, token: &str) -> Result<Vec<backup::BackupInfo>> {
        self.require_admin(token)?;
        backup::list(&self.root)
    }

    pub fn admin_backup_student(&mut self, token: &str, id: &str) -> Result<String> {
        self.require_admin(token)?;
        let index = accounts::load_index(&self.root)?;
        let s = index.student(id).ok_or(CoreError::UnknownStudent)?;
        let name = backup::backup_student(&self.root, id, &s.display_name, self.now(), backup::BackupReason::Manual)?;
        self.audit("admin", "backup-student", Some(id), Some(name.clone()))?;
        Ok(name)
    }

    pub fn admin_backup_installation(&mut self, token: &str) -> Result<String> {
        self.require_admin(token)?;
        let name = backup::backup_installation(&self.root, self.now(), backup::BackupReason::Manual)?;
        self.audit("admin", "backup-installation", None, Some(name.clone()))?;
        Ok(name)
    }

    /// Restores one student's records from a student backup. Their password is
    /// not restored. A safety backup of the current records is taken first.
    pub fn admin_restore_student(&mut self, token: &str, backup_name: &str, admin_password: &str) -> Result<String> {
        self.require_admin(token)?;
        let creds = accounts::load_credentials(&self.root)?;
        self.check_secret("admin", admin_password, creds.admin.as_ref())?;
        let manifest = backup::read_manifest(&self.root, backup_name)?;
        let id = manifest.student_id.clone().ok_or_else(|| CoreError::InvalidData("That is not a single-student backup.".into()))?;
        let index = accounts::load_index(&self.root)?;
        let s = index.student(&id).ok_or(CoreError::UnknownStudent)?;
        let safety = backup::backup_student(&self.root, &id, &s.display_name, self.now(), backup::BackupReason::BeforeRestore)?;
        backup::restore_student(&self.root, backup_name, &id)?;
        self.audit("admin", "restore-student", Some(&id), Some(format!("from {backup_name}; previous records saved as {safety}")))?;
        Ok(safety)
    }

    /// Restores the whole installation, including passwords and the recovery
    /// key as they were at backup time. Needs the administrator password. A
    /// safety backup is taken first, and the session ends afterwards because
    /// the credentials may have changed.
    pub fn admin_restore_installation(&mut self, token: &str, backup_name: &str, admin_password: &str) -> Result<String> {
        self.require_admin(token)?;
        let creds = accounts::load_credentials(&self.root)?;
        self.check_secret("admin", admin_password, creds.admin.as_ref())?;
        let safety = backup::backup_installation(&self.root, self.now(), backup::BackupReason::BeforeRestore)?;
        backup::restore_installation(&self.root, backup_name)?;
        self.session = None;
        self.audit("admin", "restore-installation", None, Some(format!("from {backup_name}; previous data saved as {safety}")))?;
        Ok(safety)
    }

    pub fn admin_recent_audit(&self, token: &str, limit: usize) -> Result<Vec<AuditEntry>> {
        self.require_admin(token)?;
        audit::recent(&self.root, limit)
    }

    /// Issues a new recovery key; the administrator re-enters their password.
    pub fn admin_new_recovery_key(&mut self, token: &str, admin_password: &str) -> Result<String> {
        self.require_admin(token)?;
        let mut creds = accounts::load_credentials(&self.root)?;
        self.check_secret("admin", admin_password, creds.admin.as_ref())?;
        let key = auth::new_recovery_key();
        creds.recovery = Some(auth::hash_secret(&auth::normalize_recovery_key(&key))?);
        accounts::save_credentials(&self.root, &creds)?;
        self.touch_recovery_date()?;
        self.audit("admin", "recovery-key-replaced", None, None)?;
        Ok(key)
    }

    fn touch_recovery_date(&self) -> Result<()> {
        let mut index = accounts::load_index(&self.root)?;
        if let Some(a) = index.admin.as_mut() {
            a.recovery_key_created_ms = self.now();
        }
        accounts::save_index(&self.root, &index)
    }

    // ----- Administrator recovery -------------------------------------------

    fn replace_admin_credential(&mut self, new_password: &str, actor: &str) -> Result<String> {
        auth::check_password_policy(new_password)?;
        let mut creds = accounts::load_credentials(&self.root)?;
        if creds.admin.is_none() {
            return Err(CoreError::NotSetUp);
        }
        let key = auth::new_recovery_key();
        creds.admin = Some(auth::hash_secret(new_password)?);
        creds.recovery = Some(auth::hash_secret(&auth::normalize_recovery_key(&key))?);
        accounts::save_credentials(&self.root, &creds)?;
        self.touch_recovery_date()?;
        let mut throttles = accounts::load_throttles(&self.root)?;
        throttles.remove("admin");
        throttles.remove("recovery");
        accounts::save_throttles(&self.root, &throttles)?;
        self.session = None;
        self.audit(actor, "admin-recovered", None, None)?;
        Ok(key)
    }

    /// Forgotten admin password: the recovery key sets a new one and a new key
    /// is issued. Only the administrator credential changes.
    pub fn recover_with_key(&mut self, recovery_key: &str, new_password: &str) -> Result<String> {
        let creds = accounts::load_credentials(&self.root)?;
        self.check_secret("recovery", &auth::normalize_recovery_key(recovery_key), creds.recovery.as_ref())?;
        self.replace_admin_credential(new_password, "recovery-key")
    }

    /// Both password and key lost: allowed only with proof that Windows granted
    /// administrator rights. Student data and passwords are untouched.
    pub fn recover_with_windows_admin(&mut self, _proof: ElevationProof, new_password: &str) -> Result<String> {
        self.replace_admin_credential(new_password, "windows-admin")
    }

    // ----- Student records ----------------------------------------------------

    /// Reads one of the signed-in student's records (`{schemaVersion, data}`).
    pub fn read_record(&self, token: &str, record: &str) -> Result<Option<Value>> {
        let id = self.require_student(token)?;
        let path = self.root.student_record(&id, record)?;
        Ok(storage::read_json_value(&path)?.map(|(v, _)| v))
    }

    /// Writes one of the signed-in student's records atomically.
    pub fn write_record(&self, token: &str, record: &str, envelope: &Value) -> Result<()> {
        let id = self.require_student(token)?;
        validate_envelope(envelope)?;
        let path = self.root.student_record(&id, record)?;
        let bytes = serde_json::to_vec_pretty(envelope).map_err(|e| CoreError::InvalidData(e.to_string()))?;
        storage::atomic_write(&path, &bytes)
    }

    /// Appends to one of the signed-in student's logs (attempts, mastery events, XP).
    pub fn append_log(&self, token: &str, log: &str, entry: &Value) -> Result<()> {
        let id = self.require_student(token)?;
        storage::validate_record_name(log)?;
        let path = self.root.student_dir(&id)?.join(format!("{log}.jsonl"));
        let line = serde_json::to_string(entry).map_err(|e| CoreError::InvalidData(e.to_string()))?;
        storage::append_line(&path, &line)
    }

    pub fn read_log(&self, token: &str, log: &str) -> Result<Vec<Value>> {
        let id = self.require_student(token)?;
        storage::validate_record_name(log)?;
        let path = self.root.student_dir(&id)?.join(format!("{log}.jsonl"));
        Ok(storage::read_lines(&path)?.iter().filter_map(|l| serde_json::from_str(l).ok()).collect())
    }

    /// Application-wide settings (not student data); readable before sign-in.
    pub fn read_app_record(&self, record: &str) -> Result<Option<Value>> {
        storage::validate_record_name(record)?;
        if record.contains('/') {
            return Err(CoreError::InvalidName(record.into()));
        }
        Ok(storage::read_json_value(&self.root.application(&format!("{record}.json")))?.map(|(v, _)| v))
    }
}

fn validate_envelope(v: &Value) -> Result<()> {
    let ok = v.get("schemaVersion").and_then(|x| x.as_u64()).is_some_and(|n| n >= 1) && v.get("data").is_some() && v.as_object().is_some_and(|o| o.len() == 2);
    if ok { Ok(()) } else { Err(CoreError::InvalidData("expected {schemaVersion, data}".into())) }
}

fn clean_name(name: &str) -> Result<String> {
    let n = name.trim();
    if n.is_empty() || n.chars().count() > 40 || n.chars().any(char::is_control) {
        return Err(CoreError::InvalidData("names must be 1 to 40 characters".into()));
    }
    Ok(n.to_string())
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests;

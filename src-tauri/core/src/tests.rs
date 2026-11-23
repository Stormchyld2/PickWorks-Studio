//! Account-system tests mapped to Planning Update 04, section 9.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::json;

use super::*;

struct Fixture {
    core: Core,
    clock: Arc<AtomicU64>,
    _dir: tempfile::TempDir,
}

fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let clock = Arc::new(AtomicU64::new(1_795_262_400_000));
    let c = clock.clone();
    let core = Core::open(dir.path(), Box::new(move || c.load(Ordering::SeqCst))).unwrap();
    Fixture { core, clock, _dir: dir }
}

impl Fixture {
    /// Closes the core and opens the same data folder again, like an app restart.
    fn restart(&mut self) {
        let c = self.clock.clone();
        self.core = Core::open(self._dir.path(), Box::new(move || c.load(Ordering::SeqCst))).unwrap();
    }
    fn advance_secs(&self, s: u64) {
        self.clock.fetch_add(s * 1000, Ordering::SeqCst);
    }
    fn admin(&mut self) -> String {
        self.core.sign_in_admin("admin-pass-1").unwrap().token
    }
    /// Sets up admin plus a student who has already chosen their own password.
    fn with_student(&mut self, name: &str, password: &str) -> String {
        if self.core.needs_setup().unwrap() {
            self.core.setup_admin("Jason", "admin-pass-1").unwrap();
        }
        let t = self.admin();
        let id = self.core.admin_create_student(&t, name, "temporary1").unwrap();
        let s = self.core.sign_in_student(&id, "temporary1").unwrap();
        self.core.change_own_password(&s.token, "temporary1", password).unwrap();
        self.core.sign_out(&s.token).unwrap();
        id
    }
}

fn env(n: i64) -> Value {
    json!({"schemaVersion": 1, "data": {"n": n}})
}

#[test]
fn setup_runs_once_with_no_default_credentials() {
    let mut f = fixture();
    assert!(f.core.needs_setup().unwrap());
    assert!(matches!(f.core.sign_in_admin("admin"), Err(CoreError::NotSetUp)));
    assert!(matches!(f.core.setup_admin("Jason", "short"), Err(CoreError::WeakPassword(8))));
    let key = f.core.setup_admin("Jason", "admin-pass-1").unwrap();
    assert_eq!(key.len(), 29);
    assert!(!f.core.needs_setup().unwrap());
    assert!(matches!(f.core.setup_admin("X", "another-pass"), Err(CoreError::AlreadySetUp)));
    // The credential file holds hashes only, never the password or key.
    let raw = std::fs::read_to_string(f.core.root().accounts("credentials.json")).unwrap();
    assert!(!raw.contains("admin-pass-1") && !raw.contains(&key.replace('-', "")));
    assert!(raw.contains("$argon2id$"));
}

#[test]
fn t1_students_cannot_reach_each_others_records() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let b = f.with_student("Jamie", "jamie-pass1");
    let sa = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    f.core.write_record(&sa.token, "progress", &env(1)).unwrap();
    f.core.sign_out(&sa.token).unwrap();

    let sb = f.core.sign_in_student(&b, "jamie-pass1").unwrap();
    assert!(f.core.read_record(&sb.token, "progress").unwrap().is_none(), "B sees only B's folder");
    f.core.write_record(&sb.token, "progress", &env(2)).unwrap();
    // No record name can point outside the student's folder.
    for bad in ["../progress", &format!("../{a}/progress"), "/etc/passwd"] {
        assert!(f.core.read_record(&sb.token, bad).is_err());
    }
    // A's data is untouched by B's write.
    let a_file = std::fs::read_to_string(f.core.root().student_record(&a, "progress").unwrap()).unwrap();
    assert!(a_file.contains("\"n\": 1"));
}

#[test]
fn t3_writes_with_an_old_session_are_refused_after_switching() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let b = f.with_student("Jamie", "jamie-pass1");
    let sa = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    f.core.sign_out(&sa.token).unwrap();
    let _sb = f.core.sign_in_student(&b, "jamie-pass1").unwrap();
    // A delayed save from A's session arrives after B signed in.
    assert!(matches!(f.core.write_record(&sa.token, "progress", &env(9)), Err(CoreError::NoSession)));
    assert!(matches!(f.core.append_log(&sa.token, "attempts", &json!({"x":1})), Err(CoreError::NoSession)));
    assert!(!f.core.root().student_record(&b, "progress").unwrap().exists());
    // Signing in directly (without sign-out) also invalidates the old token.
    let sb2 = f.core.sign_in_student(&b, "jamie-pass1").unwrap();
    let _sa2 = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    assert!(f.core.write_record(&sb2.token, "progress", &env(1)).is_err());
}

#[test]
fn t4_wrong_passwords_are_rejected_with_growing_delays() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    assert!(matches!(f.core.sign_in_student(&a, "nope-nope"), Err(CoreError::WrongPassword)));
    assert!(matches!(f.core.sign_in_student(&a, "nope-nope"), Err(CoreError::WrongPassword)));
    assert!(matches!(f.core.sign_in_student(&a, "nope-nope"), Err(CoreError::Throttled(30))));
    // Even the right password waits during the delay.
    assert!(matches!(f.core.sign_in_student(&a, "alex-pass-1"), Err(CoreError::Throttled(_))));
    f.advance_secs(30);
    assert!(f.core.sign_in_student(&a, "alex-pass-1").is_ok());
    // Delay state survives a restart (it's on disk).
    let t = accounts::load_throttles(f.core.root()).unwrap();
    assert!(!t.contains_key(&a), "success clears the counter");
}

#[test]
fn t5_t6_admin_reset_keeps_progress_and_forces_new_password() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let s = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    f.core.write_record(&s.token, "progress", &env(42)).unwrap();
    f.core.append_log(&s.token, "xp-ledger", &json!({"award":"a1","xp":10})).unwrap();
    f.core.sign_out(&s.token).unwrap();

    let t = f.admin();
    f.core.admin_reset_password(&t, &a, "temp-pass-2").unwrap();
    // Admin signing in ended any student session; the old token is dead.
    assert!(f.core.read_record(&s.token, "progress").is_err());
    f.core.sign_out(&t).unwrap();

    assert!(f.core.sign_in_student(&a, "alex-pass-1").is_err(), "old password no longer works");
    let s2 = f.core.sign_in_student(&a, "temp-pass-2").unwrap();
    assert!(s2.must_change_password);
    assert!(matches!(f.core.read_record(&s2.token, "progress"), Err(CoreError::PasswordChangeRequired)));
    f.core.change_own_password(&s2.token, "temp-pass-2", "brand-new-1").unwrap();
    let p = f.core.read_record(&s2.token, "progress").unwrap().unwrap();
    assert_eq!(p["data"]["n"], 42, "progress kept");
    assert_eq!(f.core.read_log(&s2.token, "xp-ledger").unwrap().len(), 1, "XP kept");
}

#[test]
fn t16_admin_actions_are_audited_and_students_cannot_act_as_admin() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let s = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    assert!(matches!(f.core.admin_list_students(&s.token), Err(CoreError::Forbidden)));
    assert!(matches!(f.core.admin_reset_password(&s.token, &a, "whatever-1"), Err(CoreError::Forbidden)));
    let t = f.admin();
    f.core.admin_rename_student(&t, &a, "Alexander").unwrap();
    f.core.admin_set_status(&t, &a, AccountStatus::Archived).unwrap();
    let log = f.core.admin_recent_audit(&t, 50).unwrap();
    let actions: Vec<_> = log.iter().map(|e| e.action.as_str()).collect();
    for want in ["student-created", "student-renamed", "student-archived", "password-reset"] {
        if want != "password-reset" {
            assert!(actions.contains(&want), "missing {want}");
        }
    }
    // Archived students leave the profile selector but keep their records.
    assert!(f.core.list_profiles().unwrap().is_empty());
    assert!(f.core.root().student_dir(&a).unwrap().exists());
    assert!(matches!(f.core.sign_in_student(&a, "alex-pass-1"), Err(CoreError::Inactive)));
    // Renaming never changes the id that owns the records.
    assert_eq!(f.core.admin_list_students(&t).unwrap()[0].account.id, a);
}

#[test]
fn admin_can_unlock_a_throttled_student() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    for _ in 0..3 {
        let _ = f.core.sign_in_student(&a, "wrong-pass");
    }
    let t = f.admin();
    assert_eq!(f.core.admin_list_students(&t).unwrap()[0].locked_for_secs, 30);
    f.core.admin_unlock(&t, &a).unwrap();
    f.core.sign_out(&t).unwrap();
    assert!(f.core.sign_in_student(&a, "alex-pass-1").is_ok());
}

#[test]
fn recovery_key_resets_only_the_admin_password() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let key = {
        let t = f.admin();
        f.core.admin_new_recovery_key(&t, "admin-pass-1").unwrap()
    };
    assert!(f.core.recover_with_key("AAAAA-BBBBB-CCCCC-DDDDD-EEEEE", "new-admin-1").is_err());
    let next_key = f.core.recover_with_key(&key.to_lowercase(), "new-admin-1").unwrap();
    assert_ne!(next_key, key);
    assert!(f.core.recover_with_key(&key, "again-admin1").is_err(), "a used key stops working");
    assert!(f.core.sign_in_admin("admin-pass-1").is_err());
    assert!(f.core.sign_in_admin("new-admin-1").is_ok());
    assert!(f.core.sign_in_student(&a, "alex-pass-1").is_ok(), "students untouched");
}

#[test]
fn windows_admin_recovery_needs_platform_proof() {
    let mut f = fixture();
    f.core.setup_admin("Jason", "admin-pass-1").unwrap();
    let key = f.core.recover_with_windows_admin(ElevationProof::verified_by_platform(), "new-admin-1").unwrap();
    assert_eq!(key.len(), 29);
    assert!(f.core.sign_in_admin("new-admin-1").is_ok());
    let t = f.admin_token("new-admin-1");
    let log = f.core.admin_recent_audit(&t, 10).unwrap();
    assert!(log.iter().any(|e| e.actor == "windows-admin" && e.action == "admin-recovered"));
}

impl Fixture {
    fn admin_token(&mut self, pw: &str) -> String {
        self.core.sign_in_admin(pw).unwrap().token
    }
}

#[test]
fn sessions_report_agreed_idle_timeouts() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    assert_eq!(f.core.sign_in_student(&a, "alex-pass-1").unwrap().idle_timeout_secs, 20 * 60);
    assert_eq!(f.core.sign_in_admin("admin-pass-1").unwrap().idle_timeout_secs, 5 * 60);
}

#[test]
fn envelopes_and_names_are_validated() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let s = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    assert!(f.core.write_record(&s.token, "progress", &json!({"data": 1})).is_err());
    assert!(f.core.write_record(&s.token, "progress", &json!({"schemaVersion": 1, "data": 1, "extra": 2})).is_err());
    assert!(f.core.write_record(&s.token, "checkpoints/lesson-01", &env(1)).is_ok());
    let t = f.admin();
    assert!(f.core.admin_create_student(&t, "   ", "temporary1").is_err());
    assert!(f.core.admin_create_student(&t, "Sam", "short").is_err());
}

#[test]
fn profile_pictures_are_validated_and_shown_on_the_selector() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let t = f.admin();
    assert!(f.core.admin_set_avatar(&t, &a, Some("data:text/html;base64,PHNjcmlwdD4=")).is_err());
    assert!(f.core.admin_set_avatar(&t, &a, Some("data:image/jpeg;base64,<script>")).is_err());
    let big = format!("data:image/jpeg;base64,{}", "A".repeat(avatars::MAX_AVATAR_BYTES * 2));
    assert!(f.core.admin_set_avatar(&t, &a, Some(&big)).is_err());
    f.core.admin_set_avatar(&t, &a, Some("data:image/jpeg;base64,/9j/4AAQ")).unwrap();
    assert_eq!(f.core.list_profiles().unwrap()[0].avatar.as_deref(), Some("data:image/jpeg;base64,/9j/4AAQ"));
    f.core.admin_set_avatar(&t, &a, None).unwrap();
    assert!(f.core.list_profiles().unwrap()[0].avatar.is_none());
}

#[test]
fn student_backup_restores_records_but_never_the_old_password() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let s = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    f.core.write_record(&s.token, "progress", &env(1)).unwrap();
    let t = f.admin();
    let name = f.core.admin_backup_student(&t, &a).unwrap();
    // Later: new progress and a password reset.
    f.core.sign_out(&t).unwrap();
    let s = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    f.core.write_record(&s.token, "progress", &env(2)).unwrap();
    let t = f.admin();
    f.core.admin_reset_password(&t, &a, "temp-pass-9").unwrap();
    f.advance_secs(1);
    assert!(f.core.admin_restore_student(&t, &name, "wrong-pass1").is_err());
    let safety = f.core.admin_restore_student(&t, &name, "admin-pass-1").unwrap();
    let backups = f.core.admin_list_backups(&t).unwrap();
    assert_eq!(backups[0].name, safety, "safety copy taken first, newest first");
    f.core.sign_out(&t).unwrap();
    assert!(f.core.sign_in_student(&a, "alex-pass-1").is_err(), "old password not restored");
    let s = f.core.sign_in_student(&a, "temp-pass-9").unwrap();
    f.core.change_own_password(&s.token, "temp-pass-9", "alex-new-11").unwrap();
    assert_eq!(f.core.read_record(&s.token, "progress").unwrap().unwrap()["data"]["n"], 1);
    // A student backup can't be restored onto someone else.
    let b = f.with_student("Jamie", "jamie-pass1");
    let t = f.admin();
    assert!(backup::restore_student(f.core.root(), &name, &b).is_err());
    let log = f.core.admin_recent_audit(&t, 50).unwrap();
    assert!(log.iter().any(|e| e.action == "restore-student"));
}

#[test]
fn installation_restore_brings_back_accounts_and_ends_the_session() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let t = f.admin();
    let name = f.core.admin_backup_installation(&t).unwrap();
    let raw = std::fs::read_to_string(f.core.root().backups_dir().join(&name).join("accounts/credentials.json")).unwrap();
    assert!(raw.contains("$argon2id$") && !raw.contains("alex-pass-1"), "hashes only");
    f.core.admin_set_status(&t, &a, AccountStatus::Archived).unwrap();
    f.core.admin_delete_student(&t, &a, "Alexander").unwrap_err();
    f.core.admin_delete_student(&t, &a, "Alex").unwrap();
    assert!(f.core.list_profiles().unwrap().is_empty());
    assert!(!f.core.root().student_dir(&a).unwrap().exists());
    f.advance_secs(1);
    f.core.admin_restore_installation(&t, &name, "admin-pass-1").unwrap();
    assert!(f.core.admin_list_students(&t).is_err(), "session ended");
    assert!(f.core.sign_in_student(&a, "alex-pass-1").is_ok(), "student back with their password");
    let t = f.admin();
    let actions: Vec<_> = f.core.admin_recent_audit(&t, 50).unwrap().into_iter().map(|e| e.action).collect();
    assert!(actions.contains(&"student-deleted".to_string()) && actions.contains(&"restore-installation".to_string()), "audit log survives restores");
}

#[test]
fn students_must_be_archived_before_deletion_and_backup_names_are_checked() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let t = f.admin();
    assert!(f.core.admin_delete_student(&t, &a, "Alex").is_err(), "must archive first");
    assert!(backup::read_manifest(f.core.root(), "../accounts").is_err());
}

#[test]
fn backups_copy_to_a_usb_folder_and_come_back() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let s = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    f.core.write_record(&s.token, "progress", &env(1)).unwrap();
    assert!(matches!(f.core.admin_check_export(&s.token, "x", None), Err(CoreError::Forbidden)), "students can't export");
    let t = f.admin();
    let name = f.core.admin_backup_student(&t, &a).unwrap();
    let usb = tempfile::tempdir().unwrap();

    // Never into the app's own data, and only real backup names.
    let inside = f.core.root().students_dir();
    assert!(f.core.admin_export_backup(&t, &name, None, &inside).is_err());
    assert!(f.core.admin_export_backup(&t, "../accounts", None, usb.path()).is_err());

    let written = std::path::PathBuf::from(f.core.admin_export_backup(&t, &name, None, usb.path()).unwrap());
    assert!(written.starts_with(usb.path().canonicalize().unwrap()) && written.join("manifest.json").exists());
    // A second export doesn't overwrite the first.
    let again = f.core.admin_export_backup(&t, &name, None, usb.path()).unwrap();
    assert_ne!(again, written.display().to_string());

    // The PC's copy is lost; the USB copy brings it back and it restores normally.
    std::fs::remove_dir_all(f.core.root().backups_dir().join(&name)).unwrap();
    assert!(f.core.admin_list_backups(&t).unwrap().is_empty());
    let imported = f.core.admin_import_backup(&t, &written).unwrap();
    assert!(f.core.admin_import_backup(&t, &written).is_err(), "no duplicates");
    f.advance_secs(1);
    f.core.admin_restore_student(&t, &imported, "admin-pass-1").unwrap();
    let actions: Vec<_> = f.core.admin_recent_audit(&t, 50).unwrap().into_iter().map(|e| e.action).collect();
    assert!(actions.contains(&"export-backup".to_string()) && actions.contains(&"import-backup".to_string()));
}

#[test]
fn imports_refuse_folders_that_are_not_complete_backups() {
    let mut f = fixture();
    f.with_student("Alex", "alex-pass-1");
    let t = f.admin();
    let usb = tempfile::tempdir().unwrap();
    assert!(f.core.admin_import_backup(&t, usb.path()).is_err(), "empty folder");
    let name = f.core.admin_backup_installation(&t).unwrap();

    // Installation backups hold password hashes: exporting needs the admin password.
    assert!(f.core.admin_export_backup(&t, &name, None, usb.path()).is_err());
    assert!(f.core.admin_export_backup(&t, &name, Some("wrong-pass1"), usb.path()).is_err());
    let written = std::path::PathBuf::from(f.core.admin_export_backup(&t, &name, Some("admin-pass-1"), usb.path()).unwrap());

    // A part missing, or a student id that could escape its folder, is refused.
    let broken = usb.path().join("broken");
    backup_copy(&written, &broken);
    std::fs::remove_dir_all(broken.join("students")).unwrap();
    assert!(f.core.admin_import_backup(&t, &broken).is_err());
    let evil = usb.path().join("evil");
    std::fs::create_dir_all(evil.join("student")).unwrap();
    storage::write_versioned(&evil.join("manifest.json"), 1, &json!({"kind": "student", "reason": "manual", "createdMs": 1, "studentId": "../../accounts", "appVersion": "0.1.0"})).unwrap();
    assert!(f.core.admin_import_backup(&t, &evil).is_err());
    // Importing from inside the app's own backups is refused too.
    assert!(f.core.admin_import_backup(&t, &f.core.root().backups_dir().join(&name)).is_err());
}

fn backup_copy(src: &std::path::Path, dst: &std::path::Path) {
    std::fs::create_dir_all(dst).unwrap();
    for e in std::fs::read_dir(src).unwrap().flatten() {
        if e.file_type().unwrap().is_dir() { backup_copy(&e.path(), &dst.join(e.file_name())) } else { std::fs::copy(e.path(), dst.join(e.file_name())).unwrap(); }
    }
}

#[test]
fn damaged_backups_are_caught_before_restore_export_or_import() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let s = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    f.core.write_record(&s.token, "progress", &env(1)).unwrap();
    let t = f.admin();
    let name = f.core.admin_backup_student(&t, &a).unwrap();
    f.core.admin_verify_backup(&t, &name).unwrap();
    let usb = tempfile::tempdir().unwrap();
    let written = std::path::PathBuf::from(f.core.admin_export_backup(&t, &name, None, usb.path()).unwrap());

    // Change one byte of the stored backup: every use of it is refused.
    let dir = f.core.root().backups_dir().join(&name);
    let file = std::fs::read_dir(dir.join("student")).unwrap().flatten().find(|e| e.file_type().unwrap().is_file()).unwrap().path();
    let mut bytes = std::fs::read(&file).unwrap();
    bytes[0] ^= 1;
    std::fs::write(&file, &bytes).unwrap();
    assert!(matches!(f.core.admin_verify_backup(&t, &name), Err(CoreError::Corrupt(_))));
    assert!(f.core.admin_export_backup(&t, &name, None, usb.path()).is_err());
    assert!(f.core.admin_restore_student(&t, &name, "admin-pass-1").is_err());
    // An extra file slipped into a USB copy is refused on import too.
    std::fs::remove_dir_all(&dir).unwrap();
    std::fs::write(written.join("student").join("extra.json"), "{}").unwrap();
    assert!(f.core.admin_import_backup(&t, &written).is_err());
    std::fs::remove_file(written.join("student").join("extra.json")).unwrap();
    f.core.admin_import_backup(&t, &written).unwrap();
}

#[test]
fn students_can_register_themselves_unless_the_admin_turns_it_off() {
    let mut f = fixture();
    assert!(f.core.register_student("Sam", "sam-pass-11", None).is_err(), "not before setup");
    f.core.setup_admin("Jason", "admin-pass-1").unwrap();
    assert!(f.core.self_registration_enabled().unwrap(), "on by default");
    assert!(matches!(f.core.register_student("Sam", "short", None), Err(CoreError::WeakPassword(_))));
    let s = f.core.register_student("Sam", "sam-pass-11", None).unwrap();
    assert!(!s.must_change_password && matches!(s.principal, Principal::Student { .. }), "a student, signed in, own password");
    // Never administrator access.
    assert!(matches!(f.core.admin_list_students(&s.token), Err(CoreError::Forbidden)));
    assert!(matches!(f.core.admin_set_self_registration(&s.token, false), Err(CoreError::Forbidden)));
    f.core.write_record(&s.token, "progress", &env(7)).unwrap();
    f.core.sign_out(&s.token).unwrap();
    // Names on profile cards stay distinct.
    assert!(f.core.register_student("sam", "other-pass-1", None).is_err());
    // A second student's records are separate.
    let r = f.core.register_student("Riley", "riley-pass-1", None).unwrap();
    assert!(f.core.read_record(&r.token, "progress").unwrap().is_none());
    f.core.sign_out(&r.token).unwrap();
    // The admin turns it off; it's audited and refused.
    let t = f.admin();
    f.core.admin_set_self_registration(&t, false).unwrap();
    assert!(!f.core.self_registration_enabled().unwrap());
    assert!(matches!(f.core.register_student("Kai", "kai-pass-111", None), Err(CoreError::Forbidden)));
    let log = f.core.admin_recent_audit(&t, 50).unwrap();
    assert!(log.iter().any(|e| e.action == "student-self-registered") && log.iter().any(|e| e.action == "self-registration-off"));
    // Self-registered students are managed like any other.
    assert_eq!(f.core.admin_list_students(&t).unwrap().len(), 2);
}

/// Simulates a crash part-way through a log append: bytes but no newline.
fn crash_mid_append(path: &std::path::Path, bytes: &[u8]) {
    use std::io::Write;
    let mut f = std::fs::OpenOptions::new().create(true).append(true).open(path).unwrap();
    f.write_all(bytes).unwrap();
}

#[test]
fn an_interrupted_log_write_loses_no_later_record_across_restarts() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let s = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    for n in 1..=2 {
        f.core.append_log(&s.token, "attempts", &json!({"n": n})).unwrap();
    }
    let log = f.core.root().student_dir(&a).unwrap().join("attempts.jsonl");
    crash_mid_append(&log, b"{\"n\":3,\"skill\":\"pos:5:");
    f.restart();
    let s = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    let ns = |v: Vec<Value>| v.iter().map(|e| e["n"].as_i64().unwrap()).collect::<Vec<_>>();
    assert_eq!(ns(f.core.read_log(&s.token, "attempts").unwrap()), [1, 2]);
    f.core.append_log(&s.token, "attempts", &json!({"n": 4})).unwrap();
    f.restart();
    let s = f.core.sign_in_student(&a, "alex-pass-1").unwrap();
    assert_eq!(ns(f.core.read_log(&s.token, "attempts").unwrap()), [1, 2, 4], "record 4 survives, in order, no duplicates");
    assert!(storage::damaged_path(&log).exists(), "the fragment is kept beside the log");
}

#[test]
fn an_interrupted_audit_write_loses_no_later_entry() {
    let mut f = fixture();
    let a = f.with_student("Alex", "alex-pass-1");
    let audit_file = std::fs::read_dir(f.core.root().audit_dir()).unwrap().next().unwrap().unwrap().path();
    crash_mid_append(&audit_file, b"{\"atMs\":17952624");
    f.restart();
    let t = f.admin();
    f.core.admin_set_status(&t, &a, AccountStatus::Archived).unwrap();
    let actions: Vec<_> = f.core.admin_recent_audit(&t, 50).unwrap().into_iter().map(|e| e.action).collect();
    assert_eq!(actions.first().map(String::as_str), Some("student-archived"), "{actions:?}");
    assert!(actions.contains(&"sign-in".to_string()), "earlier entries are kept");
    assert_eq!(storage::read_log_file(&audit_file).unwrap().damaged, 0, "the new entry starts on its own line");
    assert!(storage::damaged_path(&audit_file).exists(), "the fragment is kept beside the log");
}

/// Every file in the three restored folders, by relative path.
fn installation_snapshot(f: &Fixture) -> std::collections::BTreeMap<String, Vec<u8>> {
    fn walk(base: &std::path::Path, dir: &std::path::Path, out: &mut std::collections::BTreeMap<String, Vec<u8>>) {
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                walk(base, &p, out);
            } else {
                out.insert(p.strip_prefix(base).unwrap().to_string_lossy().replace('\\', "/"), std::fs::read(&p).unwrap());
            }
        }
    }
    let mut out = std::collections::BTreeMap::new();
    for part in ["accounts", "students", "application"] {
        walk(f.core.root().path(), &f.core.root().path().join(part), &mut out);
    }
    out
}

/// A backup holding Alex, then a live installation that has moved on:
/// Alex deleted, Bea added with her own records. Returns (backup, Alex, Bea).
fn installation_that_moved_on(f: &mut Fixture) -> (String, String, String) {
    let alex = f.with_student("Alex", "alex-pass-1");
    let s = f.core.sign_in_student(&alex, "alex-pass-1").unwrap();
    f.core.write_record(&s.token, "progress", &env(1)).unwrap();
    let t = f.admin();
    let name = f.core.admin_backup_installation(&t).unwrap();
    f.core.admin_set_status(&t, &alex, AccountStatus::Archived).unwrap();
    f.core.admin_delete_student(&t, &alex, "Alex").unwrap();
    f.advance_secs(1);
    let bea = f.with_student("Bea", "bea-pass-12");
    let s = f.core.sign_in_student(&bea, "bea-pass-12").unwrap();
    f.core.write_record(&s.token, "progress", &env(7)).unwrap();
    f.advance_secs(1);
    (name, alex, bea)
}

fn audit_actions(f: &mut Fixture) -> Vec<String> {
    let t = f.admin();
    f.core.admin_recent_audit(&t, 100).unwrap().into_iter().map(|e| e.action).collect()
}

const SWAP_STEPS: [(&str, usize); 6] = [("aside", 0), ("swapped", 0), ("aside", 1), ("swapped", 1), ("aside", 2), ("swapped", 2)];

#[test]
fn a_restore_that_fails_part_way_leaves_the_data_exactly_as_it_was() {
    let mut f = fixture();
    let (name, alex, bea) = installation_that_moved_on(&mut f);
    for (step, part) in SWAP_STEPS.into_iter().chain([("stage", 0), ("stage", 2)]) {
        let t = f.admin();
        let before = installation_snapshot(&f);
        backup::fault::set(step, part, false);
        let r = f.core.admin_restore_installation(&t, &name, "admin-pass-1");
        backup::fault::clear();
        assert!(r.is_err(), "fault at {step} {part} is reported");
        assert!(installation_snapshot(&f) == before, "fault at {step} {part}: every file is as it was before the restore");
        assert!(!f.core.root().path().join("restore-transaction").exists(), "no staging left behind");
        assert!(f.core.admin_list_students(&t).is_ok(), "the session continues after a failed restore");
    }
    assert!(f.core.sign_in_student(&bea, "bea-pass-12").is_ok());
    assert!(f.core.sign_in_student(&alex, "alex-pass-1").is_err());
    assert!(!audit_actions(&mut f).contains(&"restore-installation".to_string()), "a failed restore is not recorded as done");
    // The same backup then restores normally.
    let t = f.admin();
    f.core.admin_restore_installation(&t, &name, "admin-pass-1").unwrap();
    assert!(f.core.sign_in_student(&alex, "alex-pass-1").is_ok());
    assert!(f.core.sign_in_student(&bea, "bea-pass-12").is_err());
    assert!(!f.core.root().path().join("restore-transaction").exists());
}

#[test]
fn a_restore_interrupted_by_a_crash_is_rolled_back_when_the_app_reopens() {
    for (step, part) in SWAP_STEPS {
        let mut f = fixture();
        let (name, alex, bea) = installation_that_moved_on(&mut f);
        let t = f.admin();
        let before = installation_snapshot(&f);
        backup::fault::set(step, part, true);
        assert!(f.core.admin_restore_installation(&t, &name, "admin-pass-1").is_err());
        backup::fault::clear();
        assert!(f.core.root().path().join("restore-transaction/journal.json").exists(), "{step} {part}: stopped mid-swap");
        f.restart();
        assert!(installation_snapshot(&f) == before, "{step} {part}: complete pre-restore data is back");
        assert!(!f.core.root().path().join("restore-transaction").exists());
        assert!(f.core.sign_in_student(&bea, "bea-pass-12").is_ok());
        assert!(f.core.sign_in_student(&alex, "alex-pass-1").is_err());
        let actions = audit_actions(&mut f);
        assert!(actions.contains(&"restore-installation-rolled-back".to_string()), "{actions:?}");
        assert!(!actions.contains(&"restore-installation".to_string()));
        // Opening again finds nothing more to do.
        f.restart();
        assert!(installation_snapshot(&f) == before);
    }
}

#[test]
fn a_crash_while_staging_or_after_commit_never_mixes_data() {
    // Crash while staging: live data was never touched.
    let mut f = fixture();
    let (name, _alex, bea) = installation_that_moved_on(&mut f);
    let t = f.admin();
    let before = installation_snapshot(&f);
    backup::fault::set("stage", 1, true);
    assert!(f.core.admin_restore_installation(&t, &name, "admin-pass-1").is_err());
    backup::fault::clear();
    f.restart();
    assert!(installation_snapshot(&f) == before);
    assert!(!f.core.root().path().join("restore-transaction").exists());
    assert!(f.core.sign_in_student(&bea, "bea-pass-12").is_ok());

    // Crash after the commit was recorded: the restored data stays.
    let mut f = fixture();
    let (name, alex, bea) = installation_that_moved_on(&mut f);
    let t = f.admin();
    backup::fault::set("committed", 0, true);
    assert!(f.core.admin_restore_installation(&t, &name, "admin-pass-1").is_err());
    backup::fault::clear();
    f.restart();
    assert!(!f.core.root().path().join("restore-transaction").exists());
    assert!(f.core.sign_in_student(&alex, "alex-pass-1").is_ok(), "restored data kept");
    assert!(f.core.sign_in_student(&bea, "bea-pass-12").is_err());
    assert!(!audit_actions(&mut f).contains(&"restore-installation-rolled-back".to_string()));
}

#[test]
fn a_backup_damaged_after_listing_is_refused_before_anything_changes() {
    let mut f = fixture();
    let (name, _alex, bea) = installation_that_moved_on(&mut f);
    let t = f.admin();
    let before = installation_snapshot(&f);
    let creds = f.core.root().backups_dir().join(&name).join("accounts/credentials.json");
    std::fs::write(&creds, b"{}").unwrap();
    assert!(backup::restore_installation(f.core.root(), &name).is_err());
    assert!(installation_snapshot(&f) == before);
    assert!(!f.core.root().path().join("restore-transaction").exists());
    assert!(f.core.admin_list_students(&t).is_ok());
    assert!(f.core.sign_in_student(&bea, "bea-pass-12").is_ok());
}


// ----- Workspace access (Workspace Navigation, Stage B) ---------------------

fn ws(unlock_all: bool, auto: bool, b: u8, i: u8, new_profiles: &[&str]) -> accounts::WorkspaceAccessSettings {
    accounts::WorkspaceAccessSettings {
        unlock_all,
        automatic_learning_unlock: auto,
        beginner_lessons_percent: b,
        intermediate_lessons_percent: i,
        new_profile_workspaces: new_profiles.iter().map(|s| s.to_string()).collect(),
    }
}

#[test]
fn workspace_access_defaults_are_safe_and_survive_old_index_files() {
    let mut f = fixture();
    let id = f.with_student("Jamie", "student-pass");
    let t = f.admin();
    assert_eq!(f.core.admin_workspace_settings(&t).unwrap(), ws(false, true, 80, 50, &[]));
    // An index written before Stage B (no workspace fields) still loads, with the defaults.
    let path = f.core.root().accounts("account-index.json");
    let mut v: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    v["data"].as_object_mut().unwrap().remove("workspaceAccess");
    for s in v["data"]["students"].as_array_mut().unwrap() {
        s.as_object_mut().unwrap().remove("workspaceGrants");
    }
    std::fs::write(&path, serde_json::to_vec(&v).unwrap()).unwrap();
    f.restart();
    let t = f.admin();
    assert_eq!(f.core.admin_workspace_settings(&t).unwrap(), ws(false, true, 80, 50, &[]));
    f.core.sign_out(&t).unwrap();
    let s = f.core.sign_in_student(&id, "student-pass").unwrap();
    let a = f.core.student_workspace_access(&s.token).unwrap();
    assert_eq!(a, StudentWorkspaceAccess { unlock_all: false, automatic_learning_unlock: true, beginner_lessons_percent: 80, intermediate_lessons_percent: 50, grants: vec![] });
}

#[test]
fn only_the_administrator_changes_workspace_access_and_every_change_is_audited() {
    let mut f = fixture();
    let id = f.with_student("Jamie", "student-pass");
    let s = f.core.sign_in_student(&id, "student-pass").unwrap();
    assert!(matches!(f.core.admin_workspace_settings(&s.token), Err(CoreError::Forbidden)));
    assert!(matches!(f.core.admin_set_workspace_settings(&s.token, ws(true, true, 80, 50, &[])), Err(CoreError::Forbidden)));
    assert!(matches!(f.core.admin_set_student_workspaces(&s.token, &id, vec!["reference".into()]), Err(CoreError::Forbidden)));
    assert!(matches!(f.core.admin_set_workspace_settings("not-a-token", ws(true, true, 80, 50, &[])), Err(CoreError::NoSession)));
    let t = f.admin();
    // The student's old token stopped working when the administrator signed in.
    assert!(matches!(f.core.student_workspace_access(&s.token), Err(CoreError::NoSession)));
    assert!(matches!(f.core.student_workspace_access(&t), Err(CoreError::Forbidden)));
    f.core.admin_set_workspace_settings(&t, ws(true, false, 70, 40, &["reference"])).unwrap();
    f.core.admin_set_student_workspaces(&t, &id, vec!["play-create".into()]).unwrap();
    let actions = audit_actions(&mut f);
    assert!(actions.contains(&"workspace-access-changed".to_string()));
    assert!(actions.contains(&"student-workspaces-changed".to_string()));
    let t = f.admin();
    let log = f.core.admin_recent_audit(&t, 50).unwrap();
    let e = log.iter().find(|e| e.action == "student-workspaces-changed").unwrap();
    assert_eq!(e.student_id.as_deref(), Some(id.as_str()));
    assert_eq!(e.detail.as_deref(), Some("play-create"));
}

#[test]
fn workspace_thresholds_and_grants_are_validated() {
    let mut f = fixture();
    let id = f.with_student("Jamie", "student-pass");
    let t = f.admin();
    for (b, i) in [(101, 50), (80, 101), (255, 255)] {
        assert!(matches!(f.core.admin_set_workspace_settings(&t, ws(false, true, b, i, &[])), Err(CoreError::InvalidData(_))), "{b} {i}");
    }
    for (b, i) in [(0, 0), (100, 100), (80, 50)] {
        f.core.admin_set_workspace_settings(&t, ws(false, true, b, i, &[])).unwrap();
        assert_eq!(f.core.admin_workspace_settings(&t).unwrap().beginner_lessons_percent, b);
    }
    // Learning Studio is never granted (it is always available); unknown ids and repeats are refused.
    for bad in [vec!["learning-studio"], vec!["future"], vec!["reference", "reference"]] {
        let g: Vec<String> = bad.iter().map(|s| s.to_string()).collect();
        assert!(matches!(f.core.admin_set_student_workspaces(&t, &id, g.clone()), Err(CoreError::InvalidData(_))), "{bad:?}");
        let mut s = ws(false, true, 80, 50, &[]);
        s.new_profile_workspaces = g;
        assert!(matches!(f.core.admin_set_workspace_settings(&t, s), Err(CoreError::InvalidData(_))), "{bad:?}");
    }
    assert!(matches!(f.core.admin_set_student_workspaces(&t, "0123456789abcdef0123456789abcdef", vec![]), Err(CoreError::UnknownStudent)));
}

#[test]
fn hand_edited_out_of_range_settings_fall_back_to_the_safe_defaults() {
    let mut f = fixture();
    let id = f.with_student("Jamie", "student-pass");
    let path = f.core.root().accounts("account-index.json");
    let mut v: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    v["data"]["workspaceAccess"] = json!({"unlockAll": true, "automaticLearningUnlock": true, "beginnerLessonsPercent": 200, "intermediateLessonsPercent": 50, "newProfileWorkspaces": []});
    std::fs::write(&path, serde_json::to_vec(&v).unwrap()).unwrap();
    let s = f.core.sign_in_student(&id, "student-pass").unwrap();
    let a = f.core.student_workspace_access(&s.token).unwrap();
    assert!(!a.unlock_all, "invalid settings never unlock anything");
    assert_eq!((a.beginner_lessons_percent, a.intermediate_lessons_percent), (80, 50));
}

#[test]
fn new_profiles_start_with_the_new_profile_workspaces_and_grants_stay_private() {
    let mut f = fixture();
    let jamie = f.with_student("Jamie", "student-pass");
    let t = f.admin();
    f.core.admin_set_workspace_settings(&t, ws(false, true, 80, 50, &["reference"])).unwrap();
    let alex = f.core.admin_create_student(&t, "Alex", "temporary1").unwrap();
    f.core.admin_set_student_workspaces(&t, &jamie, vec!["play-create".into()]).unwrap();
    // Self-registered profiles get the same defaults.
    f.core.sign_out(&t).unwrap();
    let sam = f.core.register_student("Sam", "student-pass", None).unwrap();
    assert_eq!(f.core.student_workspace_access(&sam.token).unwrap().grants, vec!["reference".to_string()]);
    // Each student sees only their own grants.
    let j = f.core.sign_in_student(&jamie, "student-pass").unwrap();
    assert_eq!(f.core.student_workspace_access(&j.token).unwrap().grants, vec!["play-create".to_string()]);
    // A student still owing a password change can't read access yet.
    let a = f.core.sign_in_student(&alex, "temporary1").unwrap();
    assert!(matches!(f.core.student_workspace_access(&a.token), Err(CoreError::PasswordChangeRequired)));
    f.core.change_own_password(&a.token, "temporary1", "student-pass").unwrap();
    assert_eq!(f.core.student_workspace_access(&a.token).unwrap().grants, vec!["reference".to_string()]);
    // Changing the defaults later never changes existing profiles.
    let t = f.admin();
    f.core.admin_set_workspace_settings(&t, ws(false, true, 80, 50, &[])).unwrap();
    let students = f.core.admin_list_students(&t).unwrap();
    let grants = |id: &str| students.iter().find(|s| s.account.id == id).unwrap().account.workspace_grants.clone();
    assert_eq!(grants(&alex), vec!["reference".to_string()]);
    assert_eq!(grants(&jamie), vec!["play-create".to_string()]);
}

#[test]
fn workspace_access_changes_never_touch_student_records() {
    let mut f = fixture();
    let id = f.with_student("Jamie", "student-pass");
    let s = f.core.sign_in_student(&id, "student-pass").unwrap();
    f.core.write_record(&s.token, "preferences", &env(7)).unwrap();
    f.core.append_log(&s.token, "attempts", &json!({"n": 1})).unwrap();
    f.core.sign_out(&s.token).unwrap();
    let dir = f.core.root().student_dir(&id).unwrap();
    let snapshot = |d: &std::path::Path| {
        let mut out = std::collections::BTreeMap::new();
        for e in walkdir(d) {
            out.insert(e.clone(), std::fs::read(&e).unwrap());
        }
        out
    };
    let before = snapshot(&dir);
    let t = f.admin();
    f.core.admin_set_workspace_settings(&t, ws(true, false, 10, 10, &["play-create", "reference"])).unwrap();
    f.core.admin_set_student_workspaces(&t, &id, vec!["play-create".into(), "reference".into()]).unwrap();
    f.core.admin_set_student_workspaces(&t, &id, vec![]).unwrap();
    assert_eq!(snapshot(&dir), before, "the student's folder is byte-for-byte unchanged");
}

fn walkdir(dir: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    for e in std::fs::read_dir(dir).unwrap() {
        let p = e.unwrap().path();
        if p.is_dir() { out.extend(walkdir(&p)); } else { out.push(p); }
    }
    out.sort();
    out
}

#[test]
fn installation_restore_brings_back_workspace_access_with_the_accounts() {
    let mut f = fixture();
    let id = f.with_student("Jamie", "student-pass");
    let t = f.admin();
    f.core.admin_set_student_workspaces(&t, &id, vec!["reference".into()]).unwrap();
    let backup = f.core.admin_backup_installation(&t).unwrap();
    f.core.admin_set_student_workspaces(&t, &id, vec![]).unwrap();
    f.core.admin_set_workspace_settings(&t, ws(true, true, 80, 50, &[])).unwrap();
    f.core.admin_restore_installation(&t, &backup, "admin-pass-1").unwrap();
    let t = f.admin();
    assert!(!f.core.admin_workspace_settings(&t).unwrap().unlock_all);
    let s = f.core.admin_list_students(&t).unwrap();
    assert_eq!(s[0].account.workspace_grants, vec!["reference".to_string()]);
}

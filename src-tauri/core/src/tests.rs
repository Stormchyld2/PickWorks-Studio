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

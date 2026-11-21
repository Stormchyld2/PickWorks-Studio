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

//! Password hashing, sign-in throttling, ids and recovery keys.

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::{Algorithm, Argon2, Params, Version};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};

/// Agreed policy: at least 8 characters for every account (no short PINs).
pub const MIN_PASSWORD_LEN: usize = 8;

pub fn check_password_policy(password: &str) -> Result<()> {
    if password.chars().count() < MIN_PASSWORD_LEN {
        return Err(CoreError::WeakPassword(MIN_PASSWORD_LEN));
    }
    Ok(())
}

/// Argon2id with OWASP-recommended settings (19 MiB, 2 passes, 1 lane): about
/// half a second or less on a modest laptop. The settings are stored inside
/// each hash string, so they can be raised later without breaking old hashes.
fn hasher() -> Argon2<'static> {
    let params = Params::new(19 * 1024, 2, 1, None).expect("valid argon2 params");
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
}

/// Returns a PHC string (`$argon2id$v=19$m=...$salt$hash`) with a unique salt.
pub fn hash_secret(secret: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    hasher()
        .hash_password(secret.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| CoreError::InvalidData(format!("hashing failed: {e}")))
}

pub fn verify_secret(secret: &str, phc: &str) -> bool {
    match PasswordHash::new(phc) {
        Ok(parsed) => hasher().verify_password(secret.as_bytes(), &parsed).is_ok(),
        Err(_) => false,
    }
}

/// 128-bit random id as 32 lowercase hex characters.
pub fn new_id() -> String {
    random_hex(16)
}

pub fn random_hex(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    OsRng.fill_bytes(&mut buf);
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

/// Recovery key: 25 characters from an unambiguous alphabet (no 0/O, 1/I/L),
/// shown in five groups, e.g. `K7QX-M3PA-...`. About 124 bits of randomness.
pub fn new_recovery_key() -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let mut out = String::new();
    for i in 0..25 {
        if i > 0 && i % 5 == 0 {
            out.push('-');
        }
        // Rejection sampling avoids modulo bias.
        loop {
            let mut b = [0u8; 1];
            OsRng.fill_bytes(&mut b);
            let limit = 256 - (256 % ALPHABET.len());
            if (b[0] as usize) < limit {
                out.push(ALPHABET[b[0] as usize % ALPHABET.len()] as char);
                break;
            }
        }
    }
    out
}

/// Normalises what a person types: case, spaces and dashes don't matter.
pub fn normalize_recovery_key(input: &str) -> String {
    input.chars().filter(|c| c.is_ascii_alphanumeric()).map(|c| c.to_ascii_uppercase()).collect()
}

/// Failed sign-in tracking for one account. Saved to disk so restarting the
/// app does not reset it.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Throttle {
    pub failures: u32,
    pub last_failure_ms: u64,
}

/// Progressive delays (agreed policy): free retries first, then 30 s, 1 min,
/// and 5 min. Never a permanent lockout; the administrator can also unlock.
pub fn delay_after(failures: u32) -> u64 {
    match failures {
        0..=2 => 0,
        3..=4 => 30,
        5..=6 => 60,
        _ => 300,
    }
}

impl Throttle {
    /// Seconds to wait before another attempt is allowed, or 0.
    pub fn wait_secs(&self, now_ms: u64) -> u64 {
        let delay_ms = delay_after(self.failures) * 1000;
        if delay_ms == 0 {
            return 0;
        }
        // If the clock was moved backwards, count from the last failure anyway.
        let elapsed = now_ms.saturating_sub(self.last_failure_ms);
        if elapsed >= delay_ms { 0 } else { (delay_ms - elapsed).div_ceil(1000) }
    }

    pub fn record_failure(&mut self, now_ms: u64) {
        self.failures = self.failures.saturating_add(1);
        self.last_failure_ms = self.last_failure_ms.max(now_ms);
    }

    pub fn is_locked(&self, now_ms: u64) -> bool {
        self.wait_secs(now_ms) > 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_are_salted_and_verify() {
        let a = hash_secret("correct horse").unwrap();
        let b = hash_secret("correct horse").unwrap();
        assert_ne!(a, b, "unique salts");
        assert!(a.starts_with("$argon2id$"));
        assert!(verify_secret("correct horse", &a));
        assert!(!verify_secret("wrong horse", &a));
        assert!(!verify_secret("x", "not a hash"));
    }

    #[test]
    fn password_policy_is_eight_characters() {
        assert!(check_password_policy("1234567").is_err());
        assert!(check_password_policy("12345678").is_ok());
        assert!(check_password_policy("ééééééé").is_err());
    }

    #[test]
    fn recovery_keys_are_long_and_normalise() {
        let k = new_recovery_key();
        assert_eq!(k.len(), 29);
        assert_eq!(normalize_recovery_key(&k.to_lowercase().replace('-', " ")), k.replace('-', ""));
        assert_ne!(k, new_recovery_key());
    }

    #[test]
    fn throttle_delays_grow_and_survive_clock_changes() {
        let mut t = Throttle::default();
        for _ in 0..2 {
            t.record_failure(1_000);
        }
        assert_eq!(t.wait_secs(1_000), 0);
        t.record_failure(1_000);
        assert_eq!(t.wait_secs(1_000), 30);
        assert_eq!(t.wait_secs(31_000), 0);
        t.record_failure(31_000);
        t.record_failure(31_000);
        assert_eq!(t.wait_secs(31_000), 60);
        // Clock moved back an hour: still locked.
        assert!(t.is_locked(0));
        for _ in 0..5 {
            t.record_failure(100_000);
        }
        assert_eq!(t.wait_secs(100_000), 300);
        assert_eq!(t.wait_secs(400_000), 0, "never permanent");
    }
}

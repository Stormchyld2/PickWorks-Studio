//! Account index and credential store (Planning Update 04, Decision 36).
//!
//! `account-index.json` holds public account facts (ids, names, status).
//! `credentials.json` holds only Argon2id hashes and is never sent to the
//! interface. Student records live in `students/{id}/`, keyed by the permanent
//! id, so renaming a student never changes record ownership.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::auth::Throttle;
use crate::error::Result;
use crate::storage::{read_versioned, write_versioned, DataRoot};

pub const INDEX_VERSION: u32 = 1;
pub const CREDENTIALS_VERSION: u32 = 1;
pub const THROTTLE_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AccountStatus {
    Active,
    Deactivated,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StudentAccount {
    pub id: String,
    pub display_name: String,
    pub status: AccountStatus,
    pub created_ms: u64,
    /// Set after an administrator reset: the student must choose a new password.
    pub must_change_password: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AdminAccount {
    pub display_name: String,
    pub created_ms: u64,
    pub recovery_key_created_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AccountIndex {
    pub admin: Option<AdminAccount>,
    pub students: Vec<StudentAccount>,
    /// Whether "Create Student Profile" is offered on the profile selector.
    /// On by default; the administrator can turn it off.
    #[serde(default = "default_true")]
    pub self_registration: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AccountIndex {
    fn default() -> Self {
        AccountIndex { admin: None, students: Vec::new(), self_registration: true }
    }
}

impl AccountIndex {
    pub fn student(&self, id: &str) -> Option<&StudentAccount> {
        self.students.iter().find(|s| s.id == id)
    }
    pub fn student_mut(&mut self, id: &str) -> Option<&mut StudentAccount> {
        self.students.iter_mut().find(|s| s.id == id)
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Credentials {
    pub admin: Option<String>,
    pub recovery: Option<String>,
    pub students: BTreeMap<String, String>,
}

/// Throttle state per account key: `admin`, `recovery` or a student id.
pub type Throttles = BTreeMap<String, Throttle>;

pub fn load_index(root: &DataRoot) -> Result<AccountIndex> {
    Ok(read_versioned(&root.accounts("account-index.json"), INDEX_VERSION, &[])?.unwrap_or_default())
}
pub fn save_index(root: &DataRoot, index: &AccountIndex) -> Result<()> {
    write_versioned(&root.accounts("account-index.json"), INDEX_VERSION, index)
}
pub fn load_credentials(root: &DataRoot) -> Result<Credentials> {
    Ok(read_versioned(&root.accounts("credentials.json"), CREDENTIALS_VERSION, &[])?.unwrap_or_default())
}
pub fn save_credentials(root: &DataRoot, creds: &Credentials) -> Result<()> {
    write_versioned(&root.accounts("credentials.json"), CREDENTIALS_VERSION, creds)
}
pub fn load_throttles(root: &DataRoot) -> Result<Throttles> {
    Ok(read_versioned(&root.accounts("throttle.json"), THROTTLE_VERSION, &[])?.unwrap_or_default())
}
pub fn save_throttles(root: &DataRoot, t: &Throttles) -> Result<()> {
    write_versioned(&root.accounts("throttle.json"), THROTTLE_VERSION, t)
}

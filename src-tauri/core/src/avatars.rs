//! Optional profile pictures, shown on the profile selector before sign-in,
//! so they live under `accounts/avatars/` rather than in the student folder.
//! The interface re-encodes every picture to a small JPEG before sending it;
//! this module only accepts small JPEG, PNG or WebP data URLs.

use std::path::PathBuf;

use crate::error::{CoreError, Result};
use crate::storage::{self, DataRoot};

/// Upper limit for a stored picture (the interface sends about 256x256 JPEG).
pub const MAX_AVATAR_BYTES: usize = 300 * 1024;

const PREFIXES: [&str; 3] = ["data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,"];

fn path(root: &DataRoot, student_id: &str) -> Result<PathBuf> {
    storage::validate_id(student_id)?;
    Ok(root.accounts("avatars").join(format!("{student_id}.txt")))
}

pub fn validate(data_url: &str) -> Result<()> {
    let body = PREFIXES
        .iter()
        .find_map(|p| data_url.strip_prefix(p))
        .ok_or_else(|| CoreError::InvalidData("Profile pictures must be JPEG, PNG or WebP images.".into()))?;
    if body.len() > MAX_AVATAR_BYTES * 4 / 3 + 4 {
        return Err(CoreError::InvalidData("That picture is too large.".into()));
    }
    if body.is_empty() || !body.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/' || b == b'=') {
        return Err(CoreError::InvalidData("That picture could not be read.".into()));
    }
    Ok(())
}

pub fn load(root: &DataRoot, student_id: &str) -> Option<String> {
    let p = path(root, student_id).ok()?;
    std::fs::read_to_string(p).ok().filter(|s| validate(s).is_ok())
}

pub fn save(root: &DataRoot, student_id: &str, data_url: Option<&str>) -> Result<()> {
    let p = path(root, student_id)?;
    match data_url {
        Some(url) => {
            validate(url)?;
            std::fs::create_dir_all(root.accounts("avatars"))?;
            storage::atomic_write(&p, url.as_bytes())
        }
        None => remove(root, student_id),
    }
}

pub fn remove(root: &DataRoot, student_id: &str) -> Result<()> {
    let p = path(root, student_id)?;
    for f in [p.clone(), p.with_extension("txt.bak")] {
        if f.exists() {
            std::fs::remove_file(f)?;
        }
    }
    Ok(())
}

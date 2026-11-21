//! Backups and restore (Planning Update 04, section 6).
//!
//! A backup is a folder under `backups/` holding a `manifest.json` and a copy
//! of the data:
//! - **Student backup**: one student's folder. No credentials, so restoring it
//!   never brings back an old password.
//! - **Installation backup**: accounts (including password hashes and the
//!   recovery-key hash), every student folder, and app settings. Restoring it
//!   needs the administrator signed in and their password re-entered.
//!
//! The audit log is never backed up or restored, so restores stay on record.
//! Every restore first takes a safety backup of what it replaces.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};
use crate::storage::{self, DataRoot};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BackupKind {
    Student,
    Installation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BackupReason {
    Manual,
    BeforeRestore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub kind: BackupKind,
    pub reason: BackupReason,
    pub created_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub student_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub student_name: Option<String>,
    pub app_version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub name: String,
    #[serde(flatten)]
    pub manifest: BackupManifest,
    pub size_bytes: u64,
}

const MANIFEST_VERSION: u32 = 1;
const INSTALLATION_PARTS: [&str; 3] = ["accounts", "students", "application"];

/// Backup folder names are generated here: digits, letters and dashes only.
fn validate_name(name: &str) -> Result<()> {
    let ok = !name.is_empty() && name.len() <= 80 && name.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    if ok { Ok(()) } else { Err(CoreError::InvalidName(name.to_string())) }
}

fn backup_dir(root: &DataRoot, name: &str) -> Result<PathBuf> {
    validate_name(name)?;
    Ok(root.backups_dir().join(name))
}

fn copy_dir(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let name = entry.file_name();
        // Leftover temporary files from an interrupted write are not data.
        if name.to_string_lossy().ends_with(".tmp") {
            continue;
        }
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir(&entry.path(), &dst.join(&name))?;
        } else if ty.is_file() {
            fs::copy(entry.path(), dst.join(&name))?;
        }
    }
    Ok(())
}

fn dir_size(p: &Path) -> u64 {
    fs::read_dir(p)
        .map(|rd| {
            rd.flatten()
                .map(|e| match e.file_type() {
                    Ok(t) if t.is_dir() => dir_size(&e.path()),
                    _ => e.metadata().map(|m| m.len()).unwrap_or(0),
                })
                .sum()
        })
        .unwrap_or(0)
}

fn unique_name(root: &DataRoot, base: String) -> String {
    let mut name = base.clone();
    let mut n = 2;
    while root.backups_dir().join(&name).exists() {
        name = format!("{base}-{n}");
        n += 1;
    }
    name
}

/// Writes into a temporary folder and renames it into place, so a backup
/// that is listed is always complete.
fn write_backup(root: &DataRoot, manifest: &BackupManifest, fill: impl FnOnce(&Path) -> Result<()>) -> Result<String> {
    let base = match &manifest.student_id {
        Some(id) => format!("{}-student-{}", manifest.created_ms, &id[..8]),
        None => format!("{}-installation", manifest.created_ms),
    };
    let name = unique_name(root, base);
    let tmp = root.backups_dir().join(format!("{name}.partial"));
    if tmp.exists() {
        fs::remove_dir_all(&tmp)?;
    }
    fs::create_dir_all(&tmp)?;
    let result = fill(&tmp).and_then(|_| storage::write_versioned(&tmp.join("manifest.json"), MANIFEST_VERSION, manifest));
    if let Err(e) = result {
        let _ = fs::remove_dir_all(&tmp);
        return Err(e);
    }
    fs::rename(&tmp, root.backups_dir().join(&name))?;
    Ok(name)
}

pub fn backup_student(root: &DataRoot, student_id: &str, student_name: &str, now: u64, reason: BackupReason) -> Result<String> {
    let src = root.student_dir(student_id)?;
    let manifest = BackupManifest {
        kind: BackupKind::Student,
        reason,
        created_ms: now,
        student_id: Some(student_id.into()),
        student_name: Some(student_name.into()),
        app_version: env!("CARGO_PKG_VERSION").into(),
    };
    write_backup(root, &manifest, |dir| if src.exists() { copy_dir(&src, &dir.join("student")) } else { fs::create_dir_all(dir.join("student")).map_err(Into::into) })
}

pub fn backup_installation(root: &DataRoot, now: u64, reason: BackupReason) -> Result<String> {
    let manifest = BackupManifest { kind: BackupKind::Installation, reason, created_ms: now, student_id: None, student_name: None, app_version: env!("CARGO_PKG_VERSION").into() };
    write_backup(root, &manifest, |dir| {
        for part in INSTALLATION_PARTS {
            copy_dir(&root.path().join(part), &dir.join(part))?;
        }
        Ok(())
    })
}

pub fn read_manifest(root: &DataRoot, name: &str) -> Result<BackupManifest> {
    let dir = backup_dir(root, name)?;
    storage::read_versioned(&dir.join("manifest.json"), MANIFEST_VERSION, &[])?.ok_or_else(|| CoreError::Corrupt(format!("backup {name} has no manifest")))
}

/// Complete backups, newest first.
pub fn list(root: &DataRoot) -> Result<Vec<BackupInfo>> {
    let mut out = Vec::new();
    for entry in fs::read_dir(root.backups_dir())? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if validate_name(&name).is_err() || !entry.file_type()?.is_dir() {
            continue;
        }
        if let Ok(manifest) = read_manifest(root, &name) {
            out.push(BackupInfo { size_bytes: dir_size(&entry.path()), name, manifest });
        }
    }
    out.sort_by(|a, b| b.manifest.created_ms.cmp(&a.manifest.created_ms).then(b.name.cmp(&a.name)));
    Ok(out)
}

/// Swaps `live` for a copy of `from`. The current folder is moved aside first
/// and only deleted once the copy is complete; on failure it is put back.
fn replace_dir(live: &Path, from: &Path) -> Result<()> {
    let aside = live.with_extension("restoring-old");
    if aside.exists() {
        fs::remove_dir_all(&aside)?;
    }
    if live.exists() {
        fs::rename(live, &aside)?;
    }
    if let Err(e) = copy_dir(from, live) {
        let _ = fs::remove_dir_all(live);
        if aside.exists() {
            fs::rename(&aside, live)?;
        }
        return Err(e);
    }
    if aside.exists() {
        fs::remove_dir_all(&aside)?;
    }
    Ok(())
}

/// Restores one student's records. Their password and account are untouched.
pub fn restore_student(root: &DataRoot, name: &str, student_id: &str) -> Result<()> {
    let manifest = read_manifest(root, name)?;
    if manifest.kind != BackupKind::Student || manifest.student_id.as_deref() != Some(student_id) {
        return Err(CoreError::InvalidData("That backup belongs to a different student.".into()));
    }
    replace_dir(&root.student_dir(student_id)?, &backup_dir(root, name)?.join("student"))
}

/// Restores accounts, credentials, all students and app settings.
pub fn restore_installation(root: &DataRoot, name: &str) -> Result<()> {
    let manifest = read_manifest(root, name)?;
    if manifest.kind != BackupKind::Installation {
        return Err(CoreError::InvalidData("That is a single-student backup.".into()));
    }
    let dir = backup_dir(root, name)?;
    for part in INSTALLATION_PARTS {
        replace_dir(&root.path().join(part), &dir.join(part))?;
    }
    Ok(())
}

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
const CHECKSUMS_VERSION: u32 = 1;
const CHECKSUMS_FILE: &str = "checksums.json";

/// SHA-256 of every data file in a backup, by path relative to the backup
/// folder (forward slashes). Written with each backup and checked before it
/// is exported, imported or restored, so a damaged copy is never used.
type Checksums = std::collections::BTreeMap<String, String>;

fn sha256_file(p: &Path) -> Result<String> {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    let mut f = fs::File::open(p)?;
    std::io::copy(&mut f, &mut hasher)?;
    Ok(hasher.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Checksums of the data files under `dir` (the manifest and checksum file
/// themselves are not data).
fn compute_checksums(dir: &Path) -> Result<Checksums> {
    fn walk(base: &Path, dir: &Path, out: &mut Checksums) -> Result<()> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let ty = entry.file_type()?;
            let path = entry.path();
            if ty.is_dir() {
                walk(base, &path, out)?;
            } else if ty.is_file() {
                let rel = path.strip_prefix(base).map_err(|_| CoreError::Corrupt("backup path".into()))?;
                let rel = rel.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/");
                if rel != "manifest.json" && rel != CHECKSUMS_FILE {
                    out.insert(rel, sha256_file(&path)?);
                }
            }
        }
        Ok(())
    }
    let mut out = Checksums::new();
    walk(dir, dir, &mut out)?;
    Ok(out)
}

/// Confirms every file in a backup folder is present and unchanged, with
/// nothing added. Returns the checksums.
pub fn verify_dir(dir: &Path) -> Result<Checksums> {
    let damaged = || CoreError::Corrupt("this backup is incomplete or has been changed since it was made".into());
    let expected: Checksums = storage::read_versioned(&dir.join(CHECKSUMS_FILE), CHECKSUMS_VERSION, &[])?.ok_or_else(damaged)?;
    if compute_checksums(dir)? != expected {
        return Err(damaged());
    }
    Ok(expected)
}

/// Checks a listed backup against its checksums.
pub fn verify(root: &DataRoot, name: &str) -> Result<()> {
    read_manifest(root, name)?;
    verify_dir(&backup_dir(root, name)?).map(|_| ())
}
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
    let result = fill(&tmp)
        .and_then(|_| compute_checksums(&tmp))
        .and_then(|sums| storage::write_versioned(&tmp.join(CHECKSUMS_FILE), CHECKSUMS_VERSION, &sums))
        .and_then(|_| storage::write_versioned(&tmp.join("manifest.json"), MANIFEST_VERSION, manifest));
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
    verify(root, name)?;
    replace_dir(&root.student_dir(student_id)?, &backup_dir(root, name)?.join("student"))
}

// ----- Installation restore (all or nothing) ---------------------------------
//
// An installation restore replaces three folders (accounts, students,
// application). It runs as a small transaction inside the data folder, in
// `restore-transaction/`:
//
// 1. **Stage.** Every part is copied from the backup into `staged/`, the copy
//    is checked against the backup's checksums, and its files are flushed to
//    disk. A full disk, a read error or a damaged file fails here, while the
//    live data is untouched; the staging folder is then removed.
// 2. **Swap.** A journal (`journal.json`, state `swapping`) is written. Each
//    live part is renamed to `previous/<part>` and the staged part renamed
//    into its place. Renames stay inside the data folder, so they need no
//    extra space. If any step fails, every part already swapped is put back.
// 3. **Commit.** The journal is marked `committed` and the transaction folder
//    removed.
//
// If the app stops part-way (crash, power loss), `recover_interrupted_restore`
// runs when the app next opens: a `swapping` journal is rolled back so the
// complete pre-restore data returns; a `committed` journal or a folder with no
// journal (the swap never started, or a rollback had already finished) is only
// cleaned up. The safety backup taken before every restore is unchanged.

const TXN_DIR: &str = "restore-transaction";
const JOURNAL_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum TxnState {
    Swapping,
    Committed,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RestoreJournal {
    state: TxnState,
    backup: String,
    /// Whether each live part existed before the swap, in INSTALLATION_PARTS order.
    existed: Vec<bool>,
}

/// What `recover_interrupted_restore` found when the app opened.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RestoreRecovery {
    /// A restore stopped mid-swap; the data from before it is back in place.
    RolledBack { backup: String },
    /// A restore had finished; only its temporary folders were left.
    CleanedUp,
}

/// Fault injection for tests: fail (or simulate a crash) at a named step.
#[cfg(test)]
pub(crate) mod fault {
    use std::cell::Cell;
    thread_local! {
        /// (step, part index, crash). `crash` stops without any clean-up, as
        /// if the app had been killed at that point.
        pub static AT: Cell<Option<(&'static str, usize, bool)>> = const { Cell::new(None) };
    }
    pub fn set(step: &'static str, part: usize, crash: bool) {
        AT.set(Some((step, part, crash)));
    }
    pub fn clear() {
        AT.set(None);
    }
}

fn fault_point(step: &'static str, part: usize) -> Result<()> {
    #[cfg(test)]
    if let Some((s, p, _)) = fault::AT.get() {
        if s == step && p == part {
            return Err(CoreError::Io(std::io::Error::other(format!("injected fault at {step} {part}"))));
        }
    }
    let _ = (step, part);
    Ok(())
}

fn crash_simulated() -> bool {
    #[cfg(test)]
    return fault::AT.get().is_some_and(|f| f.2);
    #[cfg(not(test))]
    false
}

fn txn_dir(root: &DataRoot) -> PathBuf {
    root.path().join(TXN_DIR)
}

fn write_journal(txn: &Path, journal: &RestoreJournal) -> Result<()> {
    storage::write_versioned(&txn.join("journal.json"), JOURNAL_VERSION, journal)
}

/// Flushes every file under `dir` to disk (write access is needed for this on Windows).
fn sync_tree(dir: &Path) -> Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            sync_tree(&entry.path())?;
        } else if ty.is_file() {
            fs::OpenOptions::new().write(true).open(entry.path())?.sync_all()?;
        }
    }
    storage::sync_dir(dir);
    Ok(())
}

/// Moves `from` to `to`, replacing anything already at `to`.
fn move_replacing(from: &Path, to: &Path) -> Result<()> {
    if to.exists() {
        fs::remove_dir_all(to)?;
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(from, to)?;
    Ok(())
}

/// Removes a finished or abandoned transaction folder: the journal first, so
/// a crash during removal never leaves a journal that would act again.
fn remove_txn(txn: &Path) -> Result<()> {
    let journal = txn.join("journal.json");
    for p in [journal.clone(), journal.with_extension("json.bak"), journal.with_extension("json.tmp")] {
        if p.exists() {
            fs::remove_file(p)?;
        }
    }
    if txn.exists() {
        fs::remove_dir_all(txn)?;
    }
    Ok(())
}

/// Copies the backup's parts into `staged/` and proves the copy is complete.
fn stage(backup: &Path, staged: &Path, expected: &Checksums) -> Result<()> {
    fs::create_dir_all(staged)?;
    for (i, part) in INSTALLATION_PARTS.iter().enumerate() {
        copy_dir(&backup.join(part), &staged.join(part))?;
        fault_point("stage", i)?;
    }
    if compute_checksums(staged)? != *expected {
        return Err(CoreError::Corrupt("the backup couldn't be copied intact; there may not be enough free space".into()));
    }
    sync_tree(staged)
}

fn swap(root: &DataRoot, txn: &Path) -> Result<()> {
    for (i, part) in INSTALLATION_PARTS.iter().enumerate() {
        let live = root.path().join(part);
        if live.exists() {
            move_replacing(&live, &txn.join("previous").join(part))?;
        }
        fault_point("aside", i)?;
        fs::rename(txn.join("staged").join(part), &live)?;
        fault_point("swapped", i)?;
    }
    storage::sync_dir(root.path());
    Ok(())
}

/// Puts back every part that was swapped. Safe to run more than once.
fn roll_back(root: &DataRoot, txn: &Path, existed: &[bool]) -> Result<()> {
    for (i, part) in INSTALLATION_PARTS.iter().enumerate() {
        let live = root.path().join(part);
        let previous = txn.join("previous").join(part);
        let discard = txn.join("discard").join(part);
        if previous.exists() {
            if live.exists() {
                move_replacing(&live, &discard)?;
            }
            fs::rename(&previous, &live)?;
        } else if !existed.get(i).copied().unwrap_or(true) && live.exists() {
            // The part didn't exist before; what is there now came from the backup.
            move_replacing(&live, &discard)?;
        }
    }
    storage::sync_dir(root.path());
    Ok(())
}

/// Restores accounts, credentials, all students and app settings, all or
/// nothing (see the section comment above).
pub fn restore_installation(root: &DataRoot, name: &str) -> Result<()> {
    let manifest = read_manifest(root, name)?;
    if manifest.kind != BackupKind::Installation {
        return Err(CoreError::InvalidData("That is a single-student backup.".into()));
    }
    let dir = backup_dir(root, name)?;
    // A damaged backup is refused before anything is copied.
    let expected = verify_dir(&dir)?;
    // Settle any earlier restore that was interrupted before starting a new one.
    recover_interrupted_restore(root)?;
    let txn = txn_dir(root);
    remove_txn(&txn)?;

    if let Err(e) = stage(&dir, &txn.join("staged"), &expected) {
        if !crash_simulated() {
            let _ = remove_txn(&txn);
        }
        return Err(e);
    }

    let existed: Vec<bool> = INSTALLATION_PARTS.iter().map(|p| root.path().join(p).exists()).collect();
    let mut journal = RestoreJournal { state: TxnState::Swapping, backup: name.to_string(), existed };
    if let Err(e) = write_journal(&txn, &journal) {
        let _ = remove_txn(&txn);
        return Err(e);
    }
    if let Err(e) = swap(root, &txn) {
        if crash_simulated() {
            return Err(e);
        }
        // If the rollback itself fails, the journal stays and the rollback is
        // retried when the app next opens.
        roll_back(root, &txn, &journal.existed)?;
        remove_txn(&txn)?;
        return Err(e);
    }
    journal.state = TxnState::Committed;
    if let Err(e) = write_journal(&txn, &journal) {
        // Not committed: undo now, so this session and the next agree.
        roll_back(root, &txn, &journal.existed)?;
        remove_txn(&txn)?;
        return Err(e);
    }
    if crash_simulated() {
        fault_point("committed", 0)?;
    }
    remove_txn(&txn)
}

/// Finishes an installation restore that was interrupted (see above). Called
/// when the app opens and before every installation restore.
pub fn recover_interrupted_restore(root: &DataRoot) -> Result<Option<RestoreRecovery>> {
    let txn = txn_dir(root);
    if !txn.exists() {
        return Ok(None);
    }
    let journal: Option<RestoreJournal> = storage::read_versioned(&txn.join("journal.json"), JOURNAL_VERSION, &[])?;
    let outcome = match journal {
        Some(j) if j.state == TxnState::Swapping => {
            roll_back(root, &txn, &j.existed)?;
            RestoreRecovery::RolledBack { backup: j.backup }
        }
        _ => RestoreRecovery::CleanedUp,
    };
    remove_txn(&txn)?;
    Ok(Some(outcome))
}

// ----- Copies outside the app (USB drive or another folder) ----------------
//
// A copy is the backup folder exactly as stored, manifest included, so it can
// be brought back on this or another PC. Importing only adds it to the list:
// restoring still goes through the normal checks (administrator password,
// safety backup first).

/// Refuses folders inside the app's own data, so a copy never lands in (or is
/// read back from) the folders it protects.
fn outside_data(root: &DataRoot, folder: &Path) -> Result<PathBuf> {
    let folder = folder.canonicalize().map_err(|_| CoreError::InvalidData("That folder can't be opened.".into()))?;
    if !folder.is_dir() {
        return Err(CoreError::InvalidData("Choose a folder, not a file.".into()));
    }
    let data = root.path().canonicalize()?;
    if folder.starts_with(&data) {
        return Err(CoreError::InvalidData("Choose a folder outside PickWorks Studio's own data, such as a USB drive.".into()));
    }
    Ok(folder)
}

/// Copies a backup into `dest_parent` as `pickworks-backup-<name>` and checks
/// the copy can be read back. Returns the folder that was written.
pub fn export_to(root: &DataRoot, name: &str, dest_parent: &Path) -> Result<PathBuf> {
    verify(root, name)?;
    let parent = outside_data(root, dest_parent)?;
    let base = format!("pickworks-backup-{name}");
    let mut target = parent.join(&base);
    let mut n = 2;
    while target.exists() {
        target = parent.join(format!("{base}-{n}"));
        n += 1;
    }
    let tmp = target.with_extension("partial");
    if tmp.exists() {
        fs::remove_dir_all(&tmp)?;
    }
    let src = backup_dir(root, name)?;
    let result = copy_dir(&src, &tmp).and_then(|_| {
        let copied: Option<BackupManifest> = storage::read_versioned(&tmp.join("manifest.json"), MANIFEST_VERSION, &[])?;
        if copied.is_none() || verify_dir(&tmp).is_err() {
            return Err(CoreError::Corrupt("the copy doesn't match the backup; the drive may be full or failing".into()));
        }
        Ok(())
    });
    if let Err(e) = result {
        let _ = fs::remove_dir_all(&tmp);
        return Err(e);
    }
    fs::rename(&tmp, &target)?;
    Ok(target)
}

/// Checks that a folder is a complete PickWorks backup and copies it into the
/// backup list. Returns the new backup's name.
pub fn import_from(root: &DataRoot, folder: &Path) -> Result<String> {
    let folder = outside_data(root, folder)?;
    let not_backup = || CoreError::InvalidData("That folder isn't a PickWorks Studio backup.".into());
    let manifest: BackupManifest = storage::read_versioned(&folder.join("manifest.json"), MANIFEST_VERSION, &[])?.ok_or_else(not_backup)?;
    let parts: Vec<&str> = match manifest.kind {
        BackupKind::Student => {
            let id = manifest.student_id.as_deref().ok_or_else(not_backup)?;
            root.student_dir(id).map_err(|_| not_backup())?;
            vec!["student"]
        }
        BackupKind::Installation => INSTALLATION_PARTS.to_vec(),
    };
    if parts.iter().any(|p| !folder.join(p).is_dir()) {
        return Err(not_backup());
    }
    let expected = verify_dir(&folder)?;
    let already = list(root)?.into_iter().any(|b| b.manifest.created_ms == manifest.created_ms && b.manifest.kind == manifest.kind && b.manifest.reason == manifest.reason && b.manifest.student_id == manifest.student_id);
    if already {
        return Err(CoreError::InvalidData("That backup is already in the list.".into()));
    }
    let name = write_backup(root, &manifest, |dir| {
        for p in &parts {
            copy_dir(&folder.join(p), &dir.join(p))?;
        }
        if compute_checksums(dir)? != expected {
            return Err(CoreError::Corrupt("the backup couldn't be copied intact; the drive may be failing".into()));
        }
        Ok(())
    })?;
    Ok(name)
}

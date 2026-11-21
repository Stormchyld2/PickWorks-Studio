//! Append-only administrative audit log, one JSON line per event, one file per month.

use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::storage::{append_line, read_lines, DataRoot};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    pub at_ms: u64,
    /// `admin`, `system`, `recovery-key`, `windows-admin` or a student id.
    pub actor: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub student_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// Civil date from unix days (Howard Hinnant's algorithm), for file names.
pub fn year_month(at_ms: u64) -> (i64, u32) {
    let days = (at_ms / 86_400_000) as i64;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    (y, m)
}

pub fn append(root: &DataRoot, entry: &AuditEntry) -> Result<()> {
    let (y, m) = year_month(entry.at_ms);
    let path = root.audit_dir().join(format!("{y:04}-{m:02}.jsonl"));
    let line = serde_json::to_string(entry).expect("audit entry serialises");
    append_line(&path, &line)
}

/// Most recent entries first.
pub fn recent(root: &DataRoot, limit: usize) -> Result<Vec<AuditEntry>> {
    let mut files: Vec<_> = std::fs::read_dir(root.audit_dir())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "jsonl"))
        .collect();
    files.sort();
    let mut out = Vec::new();
    for f in files.iter().rev() {
        let mut lines = read_lines(f)?;
        lines.reverse();
        for l in lines {
            if let Ok(e) = serde_json::from_str::<AuditEntry>(&l) {
                out.push(e);
                if out.len() >= limit {
                    return Ok(out);
                }
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn year_month_is_correct() {
        assert_eq!(year_month(0), (1970, 1));
        // 2026-11-21T12:00:00Z
        assert_eq!(year_month(1_795_262_400_000), (2026, 11));
        // 2024-02-29
        assert_eq!(year_month(1_709_164_800_000), (2024, 2));
    }

    #[test]
    fn entries_are_kept_newest_first() {
        let dir = tempfile::tempdir().unwrap();
        let root = DataRoot::new(dir.path()).unwrap();
        for (i, at) in [1_709_164_800_000u64, 1_795_262_400_000].iter().enumerate() {
            append(&root, &AuditEntry { at_ms: *at, actor: "admin".into(), action: format!("a{i}"), student_id: None, detail: None }).unwrap();
        }
        let r = recent(&root, 10).unwrap();
        assert_eq!(r[0].action, "a1");
        assert_eq!(r.len(), 2);
    }
}

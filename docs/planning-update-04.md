# Planning Update 04: student accounts, administration and XP

Status: **approved architecture requirements** (Decisions 36 and 37), 2026-11-21. Supersedes the "one profile per installation" rule.

## Decision 36: multi-student accounts

- Profile selection at startup; never signs in automatically.
- Password-protected students and a separate administrator. Passwords at least 8 characters, no PINs. Argon2id, local verification, progressive delays after failed attempts, no default administrator credentials.
- Administrator created at first-run setup with a recovery key. If both the password and key are lost, recovery requires Windows administrator authorisation and is audited; there is no unrestricted reset.
- Every student record is keyed by a permanent id. Students never see or change another student's records.
- Inactivity sign-out: students 20 minutes, administrator 5 minutes, saving work first. Checkpoints happen throughout, not only at sign-out. Interrupted assessments never grant mastery.
- Administrator: create, rename, reset passwords, unlock, deactivate, archive and restore students; backups; audit log. Password resets never touch progress, mastery, achievements, XP or history.
- Student records unencrypted in v1; credential hashes protected; Rust enforces ownership on every file operation.
- Administrator-only sidebar: Administration Dashboard, Student Management, Backups & Restore, Audit Log, Settings, Help, About, Sign Out. Students keep the existing learning navigation.

## Decision 37: Hybrid XP and musical mastery (Phase 2)

Practice XP (modest) and Mastery XP (larger, for verified milestones), levels and ranks from data files, badges, optional challenges, anti-farming rules, an XP transaction ledger, and optional display. **XP never bypasses mastery gates.**

## Implementation

See [architecture.md](architecture.md), "Storage, accounts and sessions".

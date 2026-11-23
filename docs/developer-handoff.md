# Developer handoff

Checkpoint written 2026-11-22 by Claude (primary developer). It lets an authorised backup developer continue safely while Claude is unavailable. It does not change roles (see [team-roles.md](team-roles.md)): the Project Owner decides, and nothing here authorises new work.

## 1. Repository state

| Item | State |
| --- | --- |
| Repository | `Stormchyld2/PickWorks-Studio` |
| Working branch | `phase1-storage-accounts` (PR #4) |
| Last code commits | `7f4d46f` Fix 1 (interrupted log writes); `5d929f2` Fix 2 (all-or-nothing installation restore) |
| This document | Committed after `7f4d46f`; see `git log -1` |
| Uncommitted changes | None |
| `main` | `2710a78`, the initial commit only. Do not modify it. |
| Open PRs | All unmerged: #1 `milestone-1-foundation`→`main`, #2 `smart-tuner`→#1, #3 `engines-foundation`→#2, #4 `phase1-storage-accounts`→#3, and #5 `chatgpt/dashboard-ui-refinement`→#4 (ChatGPT: dashboard UI and placement architecture docs, based on `40cee66`) |
| Merges | Only in the order #1→#4, only with checks green, and only on the Project Owner's explicit authorisation |

## 2. Architecture

- **Stack:** Tauri 2, Svelte 5 (runes) + TypeScript, Vite, Rust, Vitest.
- **Storage:** local JSON files only. Never SQLite or a database, and no mandatory cloud.
- **Data folder:** `%APPDATA%\com.pickworks.studio` on Windows.
- **Platforms:** Windows first; Android later (phones and tablets).

Overview documents: [architecture.md](architecture.md), [requirements-v1.md](requirements-v1.md), [planning-update-04.md](planning-update-04.md). The authoritative planning index is [master-roadmap.md](master-roadmap.md).

| Layer | Location | Responsibility |
| --- | --- | --- |
| Native core | `src-tauri/core` (crate `pickworks-core`, no Tauri dependency) | Accounts, sessions, Argon2id hashing, throttling, recovery, per-student storage with ownership checks, atomic writes, append-only logs, backups and restore, audit log |
| App shell | `src-tauri/src` | Tauri commands wrapping `Core` behind a mutex (`commands.rs`); Windows elevation, navigation guard and launch mode (`platform.rs`) |
| Engines | `src/lib/engines/*` | Pure TypeScript with no I/O: music theory, fretboard, chords, lessons, practice, mastery, print, performance, session, student records |
| Services | `src/lib/services/*` | Side effects: `core-client.ts` (Tauri invoke), `preview-core.ts` (development browser stand-in), `student-data.ts`, `session-lifecycle.ts`, `audio/*` (one AudioContext, the transport, metronome, microphone, tones) |
| Stores | `src/lib/stores/*.svelte.ts` | Class-based `$state` stores (auth, admin, preferences, tuner, layout) |
| UI | `src/routes/*`, `src/lib/components/*` | SvelteKit static pages and components |

## 3. Coding conventions (as used in the repository)

- **Rust**
  - All errors go through `CoreError` (`core/src/error.rs`), which carries a stable `code()` for the interface. Messages never contain passwords, hashes or file contents.
  - All persistent writes go through `storage::atomic_write`, `write_versioned` or `append_line`.
  - Paths come only from `DataRoot`, using validated ids and record names. Paths are never taken from the frontend.
  - Every student operation resolves the student from the session token (`require_student` / `require_admin`).
  - Doc comments explain *why*.
- **TypeScript and Svelte**
  - Engines are pure and clock-injected, so they can be tested without timers. Services wrap I/O.
  - Stores are classes with `$state` fields exported as singletons.
  - Failed saves are shown, never hidden (`SaveError`, the `pending` retry queue).
  - Use 2-space indentation, single quotes and `$lib` imports.
- **Tests**
  - TypeScript tests live in `tests/engines` and `tests/services` (Vitest).
  - Rust unit tests are in `#[cfg(test)]` modules inside each file.
  - Rust account and system tests are in `core/src/tests.rs`. They use `fixture()`, an injectable clock and `restart()` to simulate reopening the app.
  - Test names state the behaviour being checked.
- **UI:** keep the branding, palette and sidebar exactly as they are (see the project rules in [requirements-v1.md](requirements-v1.md)).

## 4. Reference implementations

| Pattern | File |
| --- | --- |
| Svelte page with a store | `src/routes/settings/+page.svelte`, `src/lib/stores/preferences.svelte.ts` |
| Reusable component | `src/lib/components/fretboard/Fretboard.svelte`, `src/lib/components/chord/ChordDiagram.svelte` |
| Pure engine with tests | `src/lib/engines/mastery/mastery.ts` + `tests/engines/mastery.test.ts` |
| Service with a retry queue | `src/lib/services/student-data.ts` + `tests/services/student-data.test.ts` |
| Rust command wrapping the core | `src-tauri/src/commands.rs` |
| Storage operations | `src-tauri/core/src/storage.rs` (atomic write, versioned read and migration, append-only log recovery) |
| Rust system tests | `src-tauri/core/src/tests.rs` |

## 5. Current implementation

See the [master-roadmap.md](master-roadmap.md) §1 inventory and the audit (`/mnt/project-files/audit/PICKWORKS_FULL_AUDIT.md`, project files, not in the repository).

- **Phase 1:** implemented. Most items are **not yet verified on Windows hardware** ([windows-verification-checklist.md](windows-verification-checklist.md)).
- **Engines only, with no screen yet:** lessons, practice, mastery, print worksheets, performance.
- **Placeholders:** Learn, Practice (apart from the metronome link), Progress, Help and Print pages.
- **Phase 2 and X0–X7:** architecture only, not authorised.

## 6. Fix 1: interrupted append-only log writes. COMPLETE, pushed in `7f4d46f`

- **Root cause:** `append_line` wrote the record and its newline as two separate writes and never checked how the file ended. A crash left an unfinished last line. The next append was glued onto it, and readers then silently dropped the merged line, losing a valid attempt, mastery, XP or audit record.
- **Fix:**
  - Each record and its newline are written in one write and flushed.
  - Before every append, `repair_log_tail` checks the end of the file:
    - A complete JSON object that only lost its newline is kept and gets its newline.
    - Any other fragment is copied to `<log>.damaged` (offset, length, text, hex) and then cut from the log.
    - The repair is idempotent.
  - `read_log_file` returns the records in order with explicit `damaged` and `salvaged` counts. It also recovers records that older versions glued onto fragments.
- **Files:** `src-tauri/core/src/storage.rs`, `audit.rs`, `lib.rs` (`read_log`), `tests.rs`.
- **Tests added (8):**
  - Storage: `interrupted_write_never_swallows_the_next_record`, `a_complete_record_that_lost_its_newline_is_kept_once`, `a_crash_during_the_very_first_write_is_recovered`, `a_crash_during_repair_does_not_record_the_fragment_twice`, `records_glued_onto_fragments_by_earlier_versions_are_salvaged`, `append_log_reports_partial_last_line`.
  - Core: `an_interrupted_log_write_loses_no_later_record_across_restarts`, `an_interrupted_audit_write_loses_no_later_entry`.
  - The three interrupted-write tests were confirmed to **fail** with the repair step disabled, and to pass with it.
- **Validation on `7f4d46f`:**
  - `npm run check`: 505 files, 0 errors.
  - `npm test`: 145/145 passed.
  - `npm run build`: passed.
  - `cargo test -p pickworks-core`: 37/37 passed.
  - `cargo test --workspace`: 37 + 2 passed.
  - Windows CI: check the run for the branch head on GitHub Actions.
- **Remaining risks:**
  - If `sync_all` fails after a full write, the frontend's retry could duplicate a record. That gap existed before this fix; records have no ids to deduplicate on.
  - `.damaged` files are diagnostic only, with no UI.
  - Truncation on Windows uses a read-write handle; this has not been exercised on Windows hardware.

## 7. Fix 2: full-install restore atomicity. COMPLETE, pushed in `5d929f2`

Authorised by the Project Owner on 2026-11-23.

- **Root cause:** `restore_installation` replaced `accounts`, `students` and `application` one after another with `replace_dir`. `replace_dir` put back only the part that failed, so an error or crash after the first part left restored and current data mixed.
- **Fix** (`backup.rs`, section "Installation restore (all or nothing)"):
  1. **Stage:** copy all parts into `restore-transaction/staged/`, check the copy against the backup's checksums, and flush it to disk. Live data is untouched if this fails.
  2. **Swap:** write the journal (`swapping`), then rename live → `previous/` and staged → live. Any error rolls back every part already swapped.
  3. **Commit:** mark the journal `committed`, then remove the transaction folder, journal first.
  4. **Recovery:** `Core::open` calls `recover_interrupted_restore`. It rolls back a `swapping` journal and audits `restore-installation-rolled-back`; it cleans up otherwise.
  5. The safety backup is unchanged. `restore_student` (single folder, `replace_dir`) was not changed.
- **Files:** `src-tauri/core/src/backup.rs`, `lib.rs` (`Core::open`), `storage.rs` (`sync_dir` made crate-visible), `tests.rs`.
- **Tests added (4, covering 16 fault points):**
  - `a_restore_that_fails_part_way_leaves_the_data_exactly_as_it_was`
  - `a_restore_interrupted_by_a_crash_is_rolled_back_when_the_app_reopens`
  - `a_crash_while_staging_or_after_commit_never_mixes_data`
  - `a_backup_damaged_after_listing_is_refused_before_anything_changes`
  - Fault injection is `backup::fault`, compiled only for tests. The two swap tests were confirmed to fail against the old sequential logic.
- **Remaining risks:**
  - Durability of renames on NTFS relies on the filesystem, because directory flush is unix-only.
  - The staging copy needs free space equal to the backup size. Running out of space is caught while staging, but there is no up-front free-space message.
  - Single-student restore still uses `replace_dir`, which is safe for a single folder: it puts that folder back on error. A crash mid-copy, though, leaves a `.restoring-old` folder that nothing recovers automatically.
  - Not yet exercised on Windows hardware.

## 8. Development commands

```
npm ci                                   # setup (Node 22; Rust stable)
npm run check                            # svelte-check type check
npm test                                 # Vitest
npm run build                            # static frontend build
cargo test --manifest-path src-tauri/Cargo.toml -p pickworks-core
cargo test --manifest-path src-tauri/Cargo.toml --workspace
npm run tauri dev                        # desktop app (needs a desktop OS)
```

Windows CI: `.github/workflows/ci.yml` runs on every push. The "Windows app build" job uploads the `pickworks-studio-windows-exe` artifact. There is no lint script.

## 9. Architectural restrictions (unchanged without authorisation)

- No database: local JSON only. No mandatory cloud. Offline-first.
- One composition model, one transport, one audio engine. No tool builds its own.
- The locked note-mastery rule (90% of the last 10 attempts, under 3 s, on 2 days).
- Branding, palette and sidebar.
- Student data isolation is enforced in the Rust core.
- No new dependencies, no Tauri fs or shell plugins, and no CSP widening without approval.
- Roadmap and decisions as recorded in [master-roadmap.md](master-roadmap.md). Phase 2 is protected. No X-stage work or spikes without authorisation.

## 10. Known blockers

- Windows hardware verification of Phase 1 (audio, idle timeout, throttling, UAC recovery, accessibility, backup edge cases).
- Remaining audit findings G-05 to G-16. G-03 and G-04 are fixed by Fix 1 and Fix 2.
- Architecture v1.0 freeze conditions: R2 confirmed, the roadmap's verification labels corrected, the R6 decisions written into the docs, and the freeze tied to a merged or tagged commit.
- PRs merge only on explicit authorisation. No tag yet.

## 11. Next steps

1. Wait for the Project Owner's authorisation. Nothing is in progress.
2. Independent review of Fix 1 (`7f4d46f`) and Fix 2 (`5d929f2`) by ChatGPT, as the Project Owner intends.
3. Claude reviews PR #5 (ChatGPT's branch) before it is merged into #4, per the return-handoff rule in §12.

## 12. Rules for a temporary backup developer

- Inspect the current code and this document before making any change.
- Follow the existing architecture and the conventions in §3.
- Work only on a separate branch the Project Owner has explicitly authorised, never on `phase1-storage-accounts` or `main`.
- Do not modify unfinished work without first reviewing its state (currently there is none).
- Keep data formats, Rust command signatures and TypeScript interfaces compatible.
- Run the relevant tests from §8 and report the actual results.
- Document every change in a return handoff. Claude reviews it before resuming primary development.

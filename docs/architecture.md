# Architecture

The full plan, with decisions and roadmap, lives in the project document "PickWorks Studio: Architecture and Phase 1 Plan". This file is the in-repo summary for developers.

## Principles

- **Engines are pure TypeScript.** `src/lib/engines/*` never import Svelte, Tauri or the DOM, so they run on Windows, Android and in tests unchanged.
- **Notes are calculated, never hard-coded.** A position (string, fret) resolves to a MIDI pitch from the tuning; pitch class, octave and spelling are derived. Lessons describe what they expect as data.
- **Components draw; engines decide.** The `Fretboard` component renders highlights and emits selections. Whether a selection is correct is decided by the performance evaluator.
- **No fake progress.** Screens not yet built say so and name the milestone that delivers them.

## Layers

1. Screens (`src/routes`)
2. Components (`src/lib/components`)
3. Stores (Svelte 5 runes; from Milestone 4)
4. Engines (`src/lib/engines`): `music-theory`, `fretboard`, `performance` (seams), `lessons`, `practice`, `mastery`, `audio` (pitch detection, tuner, metronome), `print`
5. Services (`src/lib/services`): shared audio, the connectivity policy, and `core-client.ts`, the typed client for the native core.
6. Native core (`src-tauri/core`, crate `pickworks-core`): plain Rust with no Tauri dependency, tested on its own and reusable on Android. It owns storage, accounts, sessions and the audit log. `src-tauri/src` only wires it into the app and adds platform checks.

## Storage, accounts and sessions (Phase 1)

Data lives in the app data folder, laid out as in Planning Update 04:

```
application/            app-wide settings
accounts/               account-index.json (public facts), credentials.json (Argon2id hashes only), throttle.json
students/{student-id}/  one folder per student, keyed by a permanent id; renaming never moves records
administration/         audit-log/YYYY-MM.jsonl (append-only), recovery/
backups/
```

- **Crash-safe writes.** Each JSON file is written to a temporary file, flushed, the previous copy kept as `.bak`, then renamed into place. Reads fall back to `.bak` if the main file is damaged. Logs (attempts, mastery events, XP, audit) are append-only, so a crash can only lose the last line.
- **Versioned files.** Every file is `{ schemaVersion, data }`. Older versions are upgraded through ordered migrations; files from a newer app are refused rather than misread.
- **Ownership is enforced in Rust.** The interface never passes file paths, only a session token and a record name such as `progress` or `checkpoints/lesson-01`. Rust resolves the path inside the signed-in student's folder.
- **Sessions.** One session at a time. Every data call carries its token; signing out or signing in as someone else ends the old token, so a delayed save from a previous student is refused.
- **Passwords.** At least 8 characters, Argon2id with unique salts, verified locally. Failed sign-ins wait 30 s, 1 min, then 5 min (saved on disk; never a permanent lockout; the administrator can unlock). Administrator resets only replace the hash: progress, mastery, XP and history are untouched, and the student sets a new password at next sign-in.
- **Administrator recovery.** A recovery key is shown once at setup and stored only as a hash. If both password and key are lost, recovery needs Windows administrator rights (an elevated process); it replaces only the administrator credential and is audited.
- **Idle limits.** Students 20 minutes, administrator 5 minutes (enforced by the session lifecycle, Milestone D).

## Offline enforcement

- `services/connectivity.ts` is the only sanctioned path to the network; in Phase 1 it refuses every request.
- The Tauri content security policy allows no remote hosts (`connect-src 'self' ipc:`), so a missed check still cannot reach the internet.
- No opener, shell or file-system plugins are installed, and a navigation guard refuses any page outside the app.

## Performance pipeline (Virtual Instructor seams)

`src/lib/engines/performance/types.ts` defines three seams used by every exercise:

1. **PerformanceInput** produces `Observation`s with a source and a confidence (fretboard taps now; microphone and camera later).
2. **PerformanceEvaluator** compares observations with an `ExpectedPerformance` and returns an `Evaluation` whose findings are `confirmed`, `probable` or `insufficient-evidence`. Low-confidence input is never judged.
3. **CoachingEngine** turns evaluations into a message and a next action (retry, show answer, simplify, advance, review).

Mastery is tracked per skill dimension (fretboard knowledge, chords, rhythm and timing, technique, ear training) so the future instructor can adapt by area.

Locked v1 decisions are in [requirements-v1.md](requirements-v1.md).

## Conventions

- Strings are numbered 1 (high E) to 6 (low E). Displays draw string 1 at the top.
- Pitches are MIDI numbers in scientific pitch notation (60 = C4; standard tuning is E2 A2 D3 G3 B3 E4).
- Frets 0 to 24; 0 is the open string. Inlays at 3, 5, 7, 9, 15, 17, 19, 21; double at 12 and 24.

## Milestones

1. Repository and architecture (this PR)
2. Approved interface: Dashboard, Mission, Print Studio
3. Fretboard engine and component, complete
4. Lesson and practice engines
5. Progress, storage and adaptive review
6. Audio, tuner and printing
7. Fretboard Foundations course content
8. Windows release validation

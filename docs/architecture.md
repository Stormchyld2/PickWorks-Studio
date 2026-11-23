# Architecture

The full plan, with decisions and roadmap, lives in the project document "PickWorks Studio: Architecture and Phase 1 Plan". This file is the in-repo summary for developers.

## Principles

- **Engines are pure TypeScript.** `src/lib/engines/*` never import Svelte, Tauri or the DOM, so they run on Windows, Android and in tests unchanged.
- **Notes are calculated, never hard-coded.** A position (string, fret) resolves to a MIDI pitch from the tuning; pitch class, octave and spelling are derived. Lessons describe what they expect as data.
- **Components draw; engines decide.** The `Fretboard` component renders highlights and emits selections. Whether a selection is correct is decided by the performance evaluator.
- **No fake progress.** Screens not yet built say so and name the milestone that delivers them.

## Fretboard Mastery placement and progression (Phase 2 design)

The per-student first-use Skill Placement Wizard, evidence-based placement, sequential lesson gates, free review of earlier unlocked lessons, independent free exploration and dashboard-as-navigation contract are specified in [fretboard-mastery-placement.md](fretboard-mastery-placement.md). Placement is distinct from mastery; the existing locked note-mastery rule remains unchanged. Engines enforce access, UI displays derived state, and student data persists through the Rust ownership boundary. **This is approved architecture, not an implemented feature or authorization to code it.**

## Shared learning engine contracts and orchestration — Wave 1

Build engines as pure TypeScript modules with stable typed contracts; reuse the existing lesson, practice, performance, mastery, fretboard and Chord System implementations rather than building parallel engines. A coordinating application/service layer may compose engine results, but avoid circular imports or Svelte/Tauri dependencies inside pure engines.

- Define stable curriculum, lesson, skill, question and evidence IDs and versioned schemas. Assessment observations pass through established performance-evaluation seams. Separate background self-report, observed evidence, placement, unlock access, earned completion, XP and note mastery.
- A curriculum prerequisite graph and evidence sufficiency rules drive adaptive placement and progression. Per-skill evidence can be collected from compatible fretboard, chord, theory and practice activities without granting unrelated mastery or unlocks. The same engine framework should be reusable for other instruments via instrument-specific curricula and item banks.
- Shared read contracts supply derived skill profile, placement, next lesson, gaps, review needs and lesson access to Dashboard/Learn/Practice/Progress. No screen owns progression decisions.
- The administrator's per-student/per-curriculum **Open All Lessons** (distinct from the workspace setting Unlock All Workspaces) is an auditable, revocable **access override**. Grants are written only by the Rust core from an administrator session, stored with the account data rather than in the student's folder, and combined with evidence by the single curriculum engine; it never manufactures completion, XP or mastery. Revoke back to legitimately earned access. See [fretboard-mastery-placement.md](fretboard-mastery-placement.md) for storage, enforcement and how placement counts toward workspace unlocks.
- Wave 1 builds/test engines and persistence/authorization seams first; placement wizard, Admin controls and full UI wiring follow. The specifically authorised Wave 1 work is described in [master-roadmap.md](master-roadmap.md).

## Metronome Wave 1 interface and timing

The existing audio/metronome engine remains the single timing authority. Add a compact semicircular track with a pendulum-like dot that moves back and forth above-right of tempo on Windows, synchronized to the actual audio beat, resetting/resting on stop and responding to tempo changes. Respect reduced-motion preferences. Arrange Play/Stop, Tap Tempo, Volume and Time Signature as compact, equal-size 2×2 control blocks beneath the prominent tempo display. On Android adapt the arc placement near tempo and size controls for touch, without clipping or a duplicate clock. Test start/stop, tempo, meter, accents where present, visual/audio sync and responsive layouts.

## Layers

1. Screens (`src/routes`)
2. Components (`src/lib/components`)
3. Stores (Svelte 5 runes; from Milestone 4)
4. Engines (`src/lib/engines`): `music-theory`, `fretboard`, `performance` (seams), `lessons`, `practice`, `mastery`, `audio` (pitch detection, tuner, metronome), `print`
5. Services (`src/lib/services`): shared audio, the connectivity policy, and `core-client.ts`, the typed client for the native core.
6. Native core (`src-tauri/core`, crate `pickworks-core`): plain Rust with no Tauri dependency, tested on its own and reusable on Android. It owns storage, accounts, sessions and the audit log. `src-tauri/src` only wires it into the app and adds platform checks.

## Storage, accounts and sessions (Phase 1)

Data lives in the app data folder (`%APPDATA%\com.pickworks.studio` on Windows), one installation per Windows login with the profile's own permissions (Jason, 2026-11-22). It is laid out as in Planning Update 04:

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
- **Idle limits.** Students 20 minutes, administrator 5 minutes, with a one-minute warning. Keyboard, mouse, touch and wheel input count as activity, and so does playing into the tuner; recordings and timed exercises hold the session awake while they run. An open window on its own does not (`engines/session/activity.ts`).
- **One sign-out pipeline** (`services/session-lifecycle.ts`). The Sign Out button, the idle limit, closing the app and switching profile all run the same steps: screens save their place (assessments are marked interrupted and award nothing), all audio and inputs stop, failed saves are retried, the native session ends, then state is cleared. Anything still unsaved is reported. A manual sign-out stops to ask first; the idle limit, shutdown and profile switch always finish.
- **Backups** (`core/src/backup.rs`). A student backup copies one student's folder and no credentials, so restoring it never brings back an old password. An installation backup copies accounts (password and recovery-key hashes only), all students and app settings; restoring it needs the administrator password and ends the session. Every restore saves the current data as a backup first. The audit log is never backed up or restored, so restores stay on record. Backups live in `backups/` inside the data folder.
- **Backup integrity and USB/folder copies.** Each backup holds `checksums.json` (SHA-256 of every data file). It is checked before a backup is copied out, brought back or restored, and a damaged one is refused before anything is touched. The administrator can copy a backup to any folder outside the app's data (a USB drive, say) and bring one back; the folder picker opens in Rust (`tauri-plugin-dialog`, with no permission granted to the window), so the interface never passes a path. Copies are checked after writing. Copying an installation backup needs the administrator password because it holds password hashes. Bringing one back only adds it to the list; restoring still needs the password and takes a safety backup first. Nothing goes online.
- **Profile pictures** (`core/src/avatars.rs`). Set by the administrator, re-encoded in the interface to a 256 px JPEG (which drops embedded data), checked in Rust, and stored under `accounts/avatars/` so the profile selector can show them before sign-in.
- **Permanent deletion** is only possible for archived students, after typing the student's name, and is audited.
- **Student data** (`services/student-data.ts`). Attempts record their context (lesson, practice, assessment, placement) and evidence kind. Only objective evidence counts; free practice builds proficiency but only lessons and assessments open curriculum gates. Mastery is a permanent event log, so history survives later drops in accuracy. Lessons resume from checkpoints; assessments restart and save only when finished.

## Preferences and accessibility (Phase 1, milestone H)

- **Per-student settings** (`stores/preferences.svelte.ts`) load at sign-in, apply across the app (tuner, audio devices and volume, left-handed fretboards, text size, high contrast, reduced motion) and save to the student's profile on every change. A failed save is shown.
- "Highlight my profile first" stores only which profile to show first, in the app's local web storage; a password is always required.
- "Ask before signing out" adds a confirmation to the Sign Out buttons. The idle limit never asks.
- Running the metronome holds the session awake, like a recording or a timed exercise.
- Every card uses the approved glow treatment (`.card` in `base.css`).

## Workspaces (approved 2026-11-23; Stage A groundwork only)

Workspaces are navigation modes over one app, not separate apps: Learning Studio (default, always unlocked), Play & Create and Reference share accounts, engines, storage, settings and the design system. The Project Owner approved workspace decisions 1–12, including the selector mockups, on 2026-11-23. **Stage A** (this groundwork) changes nothing a student can see. **Stage B** (the selector, per-workspace sidebars, the Tools group, renamed items and the Workspaces settings tab) waits for the Project Owner's separate approval after Windows hardware verification.

- **Configuration** (`engines/workspaces/config.ts`). Ids, names, home addresses, the address prefixes each workspace owns, and an `implemented` flag. Only Learning Studio is implemented. Learning Studio keeps every existing top-level address (`/`, `/learn`, `/practice`, `/fretboard`, `/progress`, and `/print` until Reference opens); later workspaces get `/create/...` and `/reference/...`. The Tuner and Metronome (`/tuner`, `/practice/metronome`) are shared tools; Settings, Help and About are global; `/admin/...` is administrator-only. `workspaceForPath()` returns the owning workspace, or null for pages that keep the current workspace. A test checks that every route folder and every sidebar item has an owner.
- **Access** (`engines/workspaces/access.ts`). One pure function, `workspaceAccess()`, decides the state of each workspace for a student: *not implemented*, *locked*, *hidden* or *visible*. Implemented comes from the configuration and nothing overrides it. Unlocked comes only from administrator settings and lesson coverage: Learning Studio always; any other workspace when Unlock All Workspaces is on, when the administrator granted it to that student, or when Automatic Learning Unlock is on and the student has **covered** at least 80% of Beginner and 50% of Intermediate lessons (completed, or proven by verified placement evidence; lessons opened only through Open All Lessons don't count). Thresholds are configurable and move into the curriculum manifest when it exists. A level with no lessons can't satisfy a threshold. Shown is the student's own switch, which can hide an available workspace but never lock or unlock one. At least one workspace always stays visible: if nothing else would be, Learning Studio reappears. `startupWorkspace()` and `fallbackWorkspace()` pick where to go (Learning Studio if visible, otherwise the next visible workspace). Access reads its inputs and writes nothing: it can never create lesson completions, mastery records or XP.
- **Student preferences, version 2** (`engines/student/records.ts`). A `workspace` group holds the start-up workspace (or "last used"), the last workspace used, sidebar collapsed, and the per-workspace "Show in Workspace Dropdown" switches. Version 1 preferences upgrade with every saved setting kept. Workspace ids saved by a newer build are dropped rather than refusing the file. No access setting is stored here.
- **Administrator access (Stage B, not built).** Unlock All Workspaces, Automatic Learning Unlock and new-profile defaults will sit with the installation settings beside self-registration; per-student grants on each student's account-index entry. Rust will accept changes only from a signed-in administrator, and every change will be audited.
- **Instrument definitions** are planned as X0.1, the Instrument & Tuning Manager (`engines/instruments/`, see [master-roadmap.md](master-roadmap.md)): one shared tuning list and instrument definitions `{ id, name, strings, fretCount, range, clef, transposition, midiProgram }`, six-string guitar first. Workspaces don't depend on it; it is not started.

## Chords and scales (Phase 1, milestone G)

- **Theory data** (`engines/music-theory/chords.ts`, `scales.ts`). Chord qualities and scales are interval lists. Note names are calculated and spelled one letter per degree (F major has Bb, Ab minor has Cb), never typed in.
- **Chord shapes** (`engines/chords/shape.ts`). A shape stores only frets, fingers and barres for a tuning. `analyzeShape` works out every note and interval from the tuning; `validateShape` checks the shape is really its chord (root and 3rd present, no wrong notes) and playable (fingers, barres, stretch). The tests validate every bundled shape.
- **Diagram layout** (`engines/chords/diagram.ts`) feeds one renderer (`components/chord/ChordDiagram.svelte`) used on screen and in black and white for print. Left-handed mode mirrors the picture only; `conceal` hides the name and note labels in assessments.
- **Starter set** (`engines/chords/library.ts`): 27 common open chords plus E-shape and A-shape barres. The release chord library scope is still an open decision.
- **Scale positions** (`engines/fretboard/scale-positions.ts`) place a scale on the neck with interval labels.

## Offline enforcement

- `services/connectivity.ts` is the only sanctioned path to the network; in Phase 1 it refuses every request.
- The Tauri content security policy allows no remote hosts (`connect-src 'self' ipc:`), so a missed check still cannot reach the internet.
- No opener, shell or file-system plugins are installed, and a navigation guard refuses any page outside the app.

## Android phones and tablets (approved requirement, 2026-11-22)

Android supports phones and tablets from one shared Svelte app. This is an architectural requirement only: the Windows interface stays exactly as approved, and no Android screens are built until Android development starts.

**Layout is chosen by the app window's width**, never by device type, and updates live on resize, rotation and split-screen:

| Window width | Layout | Navigation |
|---|---|---|
| 840 px and up | Desktop / tablet: today's Windows interface, multi-column cards, full-size tools | Persistent sidebar, expanded or icon-only; content resizes with it |
| 600–839 px | Intermediate | Collapsible or overlay sidebar |
| below 600 px | Compact phone: single column where appropriate | Drawer or bottom navigation |

These are starting targets, to be checked on real devices. Windows keeps its 1280 px minimum window, so it always gets the desktop layout.

**Shared, not forked.** One component library and design system (tokens, glow cards, logo rules). Engines, note maths, chord diagrams, practice and mastery rules, student data and the Rust core are reused unchanged. Tablets use essentially the Windows interface; phones rearrange the same components rather than replacing them.

**Platform adapters** keep the differences in one place, so screens ask "can this device do X?" instead of checking for Windows:
- Storage: the core already uses Tauri's app data folder, which is `%APPDATA%\com.pickworks.studio` on Windows and the app-private folder on Android. Local-first storage, accounts and offline behaviour carry over as they are.
- Administrator recovery: the Windows-administrator route is Windows-only; Android offers the recovery key.
- Backup copies: Rust folder picker on Windows; Android's system file picker (Storage Access Framework) for USB drives and folders.
- Microphone: browser audio on Windows; Android microphone permission through Tauri.
- App lifecycle: Windows signs out when the window closes. Android can pause or close the app at any time, so work is checkpointed whenever the app goes to the background.
- Printing and PDF: PDFs come from one shared PDF writer that converts the app's SVG pages on both platforms, with no printer needed; optional printing uses the Windows print dialog and Android's print framework. Android's WebView can't print from JavaScript, so WebView printing is never the PDF path (see [android-platform.md](android-platform.md)).

**Touch and accessibility.** Touch targets of at least 44–48 px on touch screens; swipe and tap gestures only as extras beside visible controls; keyboard support stays for Windows and tablets with keyboards; layouts respect Android font scaling and the existing text-size, contrast and reduced-motion settings; fretboard and chord diagrams scale to their container in both orientations.

**Order when Android starts:** build and test the responsive shell (breakpoints, navigation modes, adapters) first, then the device-specific refinements.

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

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
5. Services: JSON file storage through Rust commands with atomic writes and backups (Milestone 5)

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

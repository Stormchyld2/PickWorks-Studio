# Feature roadmap and shared architecture

Status: planning. Recorded from Jason's "Feature Expansion & Planning Update" (2026-11-21).
**Nothing in this document authorises implementation.** Each feature is designed and approved individually.

This file keeps four things apart:

1. **Locked v1 requirements**: see [requirements-v1.md](requirements-v1.md). Unchanged by this document.
2. **Accepted feature concepts**: below. Accepted for the roadmap; functionality, UI and release phase not yet defined.
3. **Proposed shared architecture**: below. Responsibilities, not mandated modules or processes.
4. **Unresolved decisions**: below.

## Principles

- Every tool works **standalone** and **inside** lessons, guided practice, assessments and (later) the Virtual Instructor, using the same engine.
- The curriculum is the central organising system. The default experience is guided and progressive, never a random collection of exercises.
- 80/20 learning, short missions, immediate musical payoff, adaptive reinforcement.
- Offline-first, local student data, existing branding and visual design.

## Accepted feature concepts

| # | Feature | Group | Built so far |
|---|---|---|---|
| 1 | Structured learning pathways and progressive missions | Learning | Lesson engine (schema, runner, next-lesson) |
| 2 | Interactive Fretboard | Learning | Component + Fretboard Explorer |
| 3 | Fretboard Note Mastery Trainer | Learning | Practice + mastery engines |
| 4 | Guided Lessons | Learning | Lesson engine; no screens yet |
| 5 | Mini Tests and Assessments | Learning | Assessment mode in practice engine |
| 6 | Adaptive Practice Engine | Learning | Weak-area sessions, review due dates |
| 7 | Chord Learning | Learning | — |
| 8 | Scale Learning | Learning | — |
| 9 | Rhythm and Strumming Training | Learning | — |
| 10 | Picking Exercises | Learning | — |
| 11 | Ear Training | Learning | — |
| 12 | Song Practice | Learning | — |
| 13 | Practical Music Theory | Learning | Intervals in theory engine |
| 14 | Practice Session Builder | Learning | — (must recommend from pathway, mastery, weaknesses, recent activity; custom sessions optional) |
| 15 | Practice Journal | Learning | — |
| 16 | Progress and Mastery Tracking | Learning | Mastery engine, skill profile |
| 17 | Native Guitar Tuner | Tools | Engine + screen (PR #2) |
| 18 | Built-in Metronome | Tools | Timing engine + audio scheduler; no screen |
| 19 | Interactive Chord Library | Tools | — |
| 20 | Chord Transition Trainer | Tools | — |
| 21 | Scale Explorer | Tools | — |
| 22 | Interval Trainer | Tools | — (Explorer has an intervals overlay) |
| 23 | Fretboard Games | Tools | — |
| 24 | TAB Reader and Player | Tools | — (formats and import sources to be decided; no assumption of universal compatibility) |
| 25 | Loop Trainer | Tools | — |
| 26 | Backing Tracks | Tools | — |
| 27 | Print Studio | Tools | Worksheet engine; no screen |
| 28 | Audio Recording | Audio | — |
| 29 | Guitar Effects | Audio | — |
| 30 | MIDI Support | Audio | — |
| 31 | Audio Recognition and Performance Analysis | Audio | Pitch detector only (tuner) |
| 32 | Virtual Instructor | Audio | Seams only (input, evaluation, coaching types) |

## Proposed shared architecture

| Responsibility | Serves | Current code |
|---|---|---|
| Curriculum and Lesson Engine | 1, 4, 5, 7–13, 32 | `engines/lessons` |
| Practice and Assessment Engine | 3, 5, 6, 14, 20, 22, 23 | `engines/practice` |
| Progress and Mastery Engine | 6, 14, 15, 16, 32 | `engines/mastery` |
| Fretboard and Music Theory Engine | 2, 3, 7, 8, 13, 19, 21, 22, 24, 27 | `engines/music-theory`, `engines/fretboard` |
| Audio Input/Output and Device Management | 17, 18, 25, 26, 28, 29, 31 | `services/audio/mic-input.ts` (input only) |
| Pitch and Performance Analysis | 17, 31, 32 | `engines/audio/pitch` |
| Playback, Timing and Transport | 18, 20, 24, 25, 26 | `engines/audio/metronome.ts` |
| TAB Import and Interpretation | 24, 12 | — |
| Recording and Audio Processing | 28, 29, 31 | — |
| MIDI Input/Output | 30 | — |
| Print and Export | 27, lesson worksheets, answer keys | `engines/print` |
| Virtual Instructor Integration | 32 | `engines/performance` seams |

Audio interfaces and MIDI devices are different: audio carries sound, MIDI carries note events. They stay separate services that both feed the performance-input seam.

## Navigation

The current navigation is locked for v1 (see requirements). New features are **not** added as top-level items. A future grouped structure should distinguish structured learning, guided and independent practice, instrument utilities, musical reference and exploration, audio and performance tools, and progress and personal records. Windows and Android may present it differently. Not yet designed or approved.

## Unresolved decisions

- Release phase and priority of each accepted feature.
- Grouped navigation structure (Windows and Android).
- TAB Reader: supported formats (e.g. ASCII tab, Guitar Pro, MusicXML), import methods, playback scope.
- Guitar Effects: which effects, latency targets, monitoring.
- MIDI: device classes supported (MIDI guitars, controllers, foot switches) and what they control.
- Audio Recognition and Virtual Instructor: capabilities, accuracy requirements, coaching rules.
- Backing Tracks: source (generated vs bundled audio) and licensing.
- Audio Recording: storage limits and whether recordings may be kept (the tuner never records).
- Practice Journal: what is logged automatically vs written by the student.

## Foundation changes worth making early

Items in the current engines that would be cheaper to adjust before more features build on them. See the PR discussion; none are made without approval.

1. **One shared audio context and device service** (input and output selection) instead of separate contexts in the tuner, tones and metronome. Needed by recording, effects, loop trainer and backing tracks, and for consistent output-device selection and latency.
2. **A shared transport** (tempo, bar/beat clock, start/stop, loop points) with the metronome as one consumer. Needed by backing tracks, loop trainer, TAB playback and the chord transition trainer.
3. **A pluggable exercise registry** (type → generator + evaluator) so chord, scale, rhythm and ear exercises add new types without editing the fretboard ones.
4. **A generic `tool` lesson step** (e.g. embed the metronome, tuner or chord library with settings) added to the lesson schema while it is still version 1 and no content exists.
5. **`midi` and `direct-input` observation sources** in the performance seam, so MIDI and guitar-interface input slot in without changing evaluation code.

Later, not now: moving audio capture to an AudioWorklet when recording or effects are approved (the current frame interface stays the same).

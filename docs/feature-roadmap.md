# Feature roadmap and shared architecture

Status: planning. Recorded from Jason's "Feature Expansion & Planning Update" (2026-11-21).
**Nothing in this document authorises implementation.** Each feature is designed and approved individually.

This file keeps four things apart:

1. **Locked v1 requirements**: see [requirements-v1.md](requirements-v1.md). Unchanged by this document.
2. **Accepted feature concepts**: below. Accepted for the roadmap; functionality, UI and release phase not yet defined.
3. **Proposed shared architecture**: below. Responsibilities, not mandated modules or processes.
4. **Unresolved decisions**: below.

See also [planning-update-02.md](planning-update-02.md) (offline resilience, connectivity policy, chord diagram generator).

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
| Audio Input/Output and Device Management | 17, 18, 25, 26, 28, 29, 31 | `services/audio/audio-engine.ts` |
| Pitch and Performance Analysis | 17, 31, 32 | `engines/audio/pitch` |
| Playback, Timing and Transport | 18, 20, 24, 25, 26 | `engines/audio/transport.ts`, `services/audio/transport.ts` |
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

## Foundation changes made early (approved 2026-11-21)

Made before more features build on them. Engine-level only; no new screens or features.

1. **Shared audio system** (`services/audio/audio-engine.ts`): one AudioContext, master output, input and output device selection, input channel choice. The tuner, reference tones and metronome all use it.
2. **Shared transport** (`engines/audio/transport.ts`, `services/audio/transport.ts`): tempo, bars and beats, tempo changes without jumps, loop regions. The metronome is a consumer.
3. **Exercise registry** (`engines/practice/registry.ts`): each type supplies a generator and optional evaluator; the six fretboard exercises are registered built-ins.
4. **Lesson `tool` step**: embeds a standalone tool with settings; content checks flag unknown tools and exercise types.
5. **Input sources**: `direct-input` and `midi` observation sources and a `midi-note` observation, kept separate from audio.

Later, not now: moving audio capture to an AudioWorklet when recording or effects are approved (the current frame interface stays the same).

## Android (phones and tablets)

Approved requirement (2026-11-22): Android ships for phones and tablets with layouts chosen by window width (below 600 px compact, 600–839 px intermediate, 840 px and up desktop/tablet), from the same shared app. See "Android phones and tablets" in [architecture.md](architecture.md). First step when Android work begins: the shared responsive shell, tested on real devices, before device-specific refinements.

## Phase 2: guided tours (approved architecture, 2026-11-22)

Not built until authorised. Full rules: [guided-tours.md](guided-tours.md).

- One tour per workspace: the Learning Studio orientation on a student's first sign-in, and the Play & Create and Reference tours on the first visit to each.
- Each tour launches automatically once per student, and only when its workspace is implemented, unlocked and not hidden.
- Every tour has Skip Tour, Back, Next and Learn More. The Learn More modal returns to the same step.
- Tours can be restarted any time from Help or Settings, without touching progress, XP, achievements or mastery.
- Tracking is per student and per tour: status (never shown, completed, skipped), last step and content version. App updates never re-launch a completed or skipped tour.
- Steps only describe features that work today.


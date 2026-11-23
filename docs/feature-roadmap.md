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

## Phase 2: guided tours and contextual help (approved architecture, 2026-11-22)

Not built until authorised. Full rules: [guided-tours.md](guided-tours.md).

- Three tours: the Learning Studio tour on a student's first successful sign-in after account setup, and the Play & Create and Reference tours on the first entry to each.
- Each tour launches automatically once per student, only when its workspace is implemented, accessible and not hidden, and never during an active lesson, assessment, recording or practice session.
- Balloons have a title, one or two sentences, a step indicator ("3 of 8"), Next, Back, Skip Tour and Learn More. Skipping dismisses the tour for future automatic launches.
- Learn More opens a help modal with a fuller explanation, how to use it, an example, an optional screenshot, Try It Now where a working feature exists, and Return to Tour. It always returns to the same step. Try It Now never awards XP, completes lessons or changes mastery.
- The proposed 9-step Learning Studio tour (Welcome, My Courses, Practice, Fretboard Explorer, My Progress, Tuner, Metronome, Workspace Selector, Profile and Settings) is shortened when features are missing. No fake controls.
- Tours can be replayed any time from a Guided Tours section in Help, without touching progress, XP, achievements or mastery. Feature-specific tutorials use the same system and start from Help only.
- Tracking is per student and per workspace in the student's own data: tutorial id, workspace id, status (never shown, in progress, completed, skipped), last step, content version and whether the auto-launch happened. Updates never re-launch a completed or skipped tour.
- Full keyboard, screen-reader, focus, reduced-motion, text-scaling, high-contrast and touch support. Balloons sit beside controls on Windows and tablets, compact popups or bottom sheets on phones.
- Tour interaction counts as activity for the idle timeout.
- Timing: the Learning Studio tour is built in Phase 2 once the main learning screens exist; the other two follow when their workspaces get working features.

## Unified diagram rendering (architecture decision, 2026-11-22; scheduled at X0.7)

Not built until authorised. Full plan: [notation-rendering.md](notation-rendering.md).

- Chord diagrams, scale diagrams, fretboard exercises and blank printable fretboards are all generated as SVG from data. No stored PNG or JPG per diagram, fully offline.
- The chord manifest is the single source of truth; lessons, practice and printables refer to shapes by id, so one correction updates every use.
- Reuses the existing chord layout engine and `ChordDiagram`, the `Fretboard` neck renderer, scale placement and the print worksheet layout; extends them with shape metadata, transposition for movable shapes, five display modes (Basic, Beginner Fingering, Note Names, Intervals, Print), richer accessible descriptions, scale box diagrams and one shared neck layout for screen and print.
- Right- and left-handed throughout; works with any tuning definition.

## Chord system (architecture, 2026-11-22; scheduled at X0.3 and X1)

Not built until authorised. Full plan with acceptance criteria and tests: [chord-system.md](chord-system.md).

1. Expandable chord catalog: CSV authoring, build-time import to a bundled JSON catalog, stable ids, multiple voicings per chord, movable shapes and tunings, automated validation kept separate from human review (review resets if a shape changes), chord packs, no size limit.
2. Searchable Visual Chord Library in Fretboard Explorer's Chords tab: live search by name, symbol, alias and quality; level, family, root and tuning filters; detail view with fingers, fret numbers, note names and intervals; left-handed.
3. Voicing Explorer (every validated voicing of the selected chord, beginner shapes first) and Alternate Chord Explorer (extensions, suspended, inversions and slash chords, and context-dependent substitutions, each explained).
4. Reverse Chord Finder ("What chord am I playing?"): build a chord on the fretboard and get ranked, explained candidates from chord formulas, including inversions, slash chords and chords not in the catalog.
5. Integration with lessons, practice, Compare Chords and printing, all by shape id.

## After Phase 2: creative workstation (architecture, 2026-11-22)

Not built until authorised. Full plan: [creative-workstation.md](creative-workstation.md); shared song model: [composition-model.md](composition-model.md); transport: [transport-timing.md](transport-timing.md); Android: [android-platform.md](android-platform.md).

The order first proposed here (stages 0 to 7) is **superseded** by the approved X0–X7 roadmap in [master-roadmap.md](master-roadmap.md).

## Operating Profiles (architecture, 2026-11-22)

Not built until authorised. Full plan: [operating-profiles.md](operating-profiles.md).

- Administrator-selected, installation-wide: Full Studio, Low-Power Field (Field Dashboard, reduced visuals, MIDI and recording loaded only on use, administrator overrides), No-Power Preparation (Offline Field Library and Print/Export Center; MIDI and recording never initialised; clear notice that the app still needs power).
- A separate capability layer: never changes data, progress, XP, mastery or workspace access; one shared set of engines and files.
- Capability layer at X0.4 (after workspace navigation Stage B); Low-Power Field at X1; No-Power Preparation with Expanded Print Studio at X2. Every restriction is kept only if measurements show it saves CPU, memory, startup time or battery.

## Master roadmap (2026-11-22)

The consolidated feature inventory, feature cards and dependency-aware roadmap (Phase 1, Phase 2, then expansion stages X0 to X7) are in [master-roadmap.md](master-roadmap.md). It is the **authoritative planning index**, approved by Jason as the working development plan on 2026-11-22, and supersedes the earlier provisional post-Phase-2 order. It adds the Rhythm & Strumming Studio, Ear Training Studio, Melody & Harmony Assistant and Instrument & Tuning Manager, and moves Print Studio (Core at X1, Expanded from X2) and the Offline Field Library to stages X1 and X2. Ear Training Studio sits under Learning Studio › Practice with its own mastery rule.

## Offline Backing Track Generator and Arrangement Studio (architecture, 2026-11-22)

Approved addition to the product scope, architecture only. Full plan: [backing-track-generator.md](backing-track-generator.md); scheduling in [master-roadmap.md](master-roadmap.md) (X0.6 representation, X3 inputs and style schema, X4 playback and mixing, X6 the generator, X7 more styles). It expands accepted concept 26 (Backing Tracks) and answers its open question: tracks are **generated** offline from the song's harmony, not bundled audio, with every sound licensed for offline redistribution. An arrangement layer over the existing engines (no second model, transport, progression generator or audio engine); four styles first (rock, blues, pop, folk/acoustic), judged by listening tests.


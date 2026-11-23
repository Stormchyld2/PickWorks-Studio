# PickWorks Studio master roadmap and feature inventory

**This is the authoritative planning index.** The X0–X7 roadmap was **approved by Jason as the working development plan on 2026-11-22**, subject to the refinements recorded here (final refinement and consistency pass, same day). Detailed designs stay in their own documents; where a detail here and a detailed document ever disagree on *scheduling or scope*, this document wins, and on *design detail*, the detailed document wins.

**Documentation only.** No feature is implemented, no application code is changed, no dependency is installed, no spike is run and no pull request is merged until Jason authorises it. Approval of the roadmap is not authorisation to build any stage.

## 0. Document map and terminology

| Topic | Authoritative document |
| --- | --- |
| Scheduling, scope, dependencies, decisions, risks | This document |
| Locked v1 decisions (Show Answer, note mastery, left-handed, Print Studio per-page options, navigation, tuner) | [requirements-v1.md](requirements-v1.md) |
| Fretboard Mastery placement wizard, directed lesson gates, free review and dashboard behavior | [fretboard-mastery-placement.md](fretboard-mastery-placement.md) |
| Accounts, storage, sessions, Android layout rules, developer architecture | [architecture.md](architecture.md), [planning-update-04.md](planning-update-04.md) |
| Approved planning baseline and phases | [planning-update-03.md](planning-update-03.md) |
| Workspaces, navigation, workspace access and visibility | Workspace Navigation Implementation Plan (Claude Doc) |
| Guided tours | [guided-tours.md](guided-tours.md) |
| Chord catalog, Chord Library, Voicing and Alternate Explorers, Chord Finder | [chord-system.md](chord-system.md) |
| Diagram rendering (chord boxes, fretboards, scale boxes, printable fretboards) | [notation-rendering.md](notation-rendering.md) |
| Creative tools, Print Studio, ear training, spikes, mockup specs, notation accessibility | [creative-workstation.md](creative-workstation.md) |
| Song Project and composition model, song import, export and recovery | [composition-model.md](composition-model.md) |
| Shared transport, clock sources, timing accuracy, backgrounding | [transport-timing.md](transport-timing.md) |
| Operating profiles, Field Dashboard, Print/Export Center, field binder and its permissions, lifecycle and power safety | [operating-profiles.md](operating-profiles.md) |
| Android interfaces (storage, file access, PDF, microphone, audio, battery, touch, interrupted saves) | [android-platform.md](android-platform.md) |
| Offline Backing Track Generator and Arrangement Studio | [backing-track-generator.md](backing-track-generator.md) |
| History of accepted feature concepts | [feature-roadmap.md](feature-roadmap.md), [planning-update-02.md](planning-update-02.md) |

**Terminology (used the same way in every document):**

- **Phase 1** (hardware verification, fixes, PRs #1 to #4) and **Phase 2** (learning core and workspace navigation) come first. **X0 to X7** are the expansion stages after them; **X0.1 to X0.7** are X0's milestones. Planning Update 03's later phases map onto these: its Phase 3 ("Expanded learning and creative tools") is X0 to X3, its Phase 4 ("Advanced learning ecosystem") is X4 to X7, and its Phase 5 ("Platform and optional service expansion") is the Android release and any optional online services, scheduled separately.
- **Workspace navigation Stages A and B** are part of Phase 2. **Chord Stages 1 to 5** (chord-system.md) are scheduled as: Stage 1 → X0.3; Stages 2 to 5 → X1. **Generator steps G1 to G4** (creative-workstation.md section 5): G1 → X3, G2 → X4, G3 and G4 → X7. **Technical items T1 to T12** (section 5 below) were called "gaps G1 to G12" in earlier drafts and were renamed to avoid confusion with the generator steps.
- **Print Studio** is the printing system and screen in the Reference workspace (its sidebar label there is "Printable Resources", as in the workspace plan). **Print Studio Core** is the X1 level and **Expanded Print Studio** the X2-onward level. The **Print/Export Center** is Print Studio's start view with the **Offline Field Library**, used as home in No-Power Preparation. **Print Materials** is today's Learning Studio sidebar item, which leads to Print Studio until Reference opens.
- **Field binder** means the "Prepare for Grid-Down" binder: **My Field Binder** (built by a student) or a **shared binder** (built by the administrator).
- **Diagram rendering** (notation-rendering.md) means chord boxes, fretboards and scale boxes; **standard notation** means staff notation in the X5 editors.
- **Instrument & Tuning Manager** is the shared instrument and tuning system (called "Instrument Definition" in the workspace plan).
- **Transport** is the one musical timeline; **AudioClock** and **TimerClock** are its clock sources.
- **Song Project** is the file format; the **composition model** is its musical structure. In the model, **arrangement** means the song's form (the ordered list of sections); a generated accompaniment is a **backing** (`backings[]`), never called an arrangement in data, even though the feature is named "Arrangement Studio".

## 1. Feature inventory

**Existing (usable in the app today, PR #4, awaiting Jason's hardware verification where noted):**

- Student and administrator accounts, password rules, self-registration with an administrator switch, idle sign-out (20 min students, 5 min administrator), sign-in delays, recovery key and Windows-authorised recovery, audit log.
- Administrator area: dashboard, Student Management, Backups & Restore (folder or USB, SHA-256 checks, safe restore), Audit Log, Settings.
- Student dashboard (round 3 layout, real data or honest empty states).
- Fretboard Explorer: Notes, Intervals, Chords (27 provisional shapes, SVG diagrams), Scales (13 scales, any root). Left-handed mirroring.
- Tuner (Guided and Chromatic, 4 presets in the picker), Metronome (accents, subdivisions).
- Settings: General, Audio, Tuner, Accessibility (text size, high contrast, reduced motion, left-handed, focus mode), Account.
- Offline-first with network blocked; per-Windows-login storage.
- Android foundations (breakpoints, platform adapters, save-on-background, touch targets) with no visible Windows change.

**Partially implemented (engine or data exists, not reachable or limited):**

- Lessons engine (schema and runner) and practice drills engine: Learn, Practice and Progress pages still say "Coming soon".
- Mastery engine (attempts, events, the locked note-mastery rule) and dashboard summaries.
- Print worksheet engine (blank, all-notes and anchor fretboards, paper sizes): Print Materials still says "Coming soon".
- Shared audio engine, shared transport (only the metronome uses it), reference tones (plucked-string synthesis), pitch detection.
- Tuning presets (Standard, Drop D, Half-Step Down, Open G, plus Whole-Step Down, Open D and DADGAD defined but not in the picker).
- Performance pipeline (UI input only; microphone, MIDI and camera inputs typed but not built).
- Connectivity guard (always offline). Help page ("Coming soon").

**Planned (architecture approved, not built):**

- Phase 2 learning core: courses (Fretboard Foundations), ADHD-friendly missions, mastery verification and review scheduling, progress, XP, levels, achievements, dashboard tied to real data; per-student Skill Placement Wizard, evidence-based initial unlocks, sequential gated advancement, free access to earlier lessons, and an evolving dashboard Fretboard Mastery navigation block (not a lesson surface). See [fretboard-mastery-placement.md](fretboard-mastery-placement.md).
- Workspace navigation (selector, Tools group), administrator Workspace Access, student visibility.
- Guided tours and contextual help.
- Operating Profiles (Full Studio, Low-Power Field, No-Power Preparation) and the Field Dashboard.
- Instrument & Tuning Manager; theory additions; shared transport clock sources.
- Chord system: CSV catalog (75 shapes first, 18 awaiting review), Visual Chord Library, Voicing Explorer, Alternate Chord Explorer, Compare Chords, Reverse Chord Finder ("What Chord Am I Playing?").
- Unified diagram rendering (chords, scales, exercises, blank fretboards).
- Print Studio Core and Expanded Print Studio, Offline Field Library, field binder.
- Song Project model; Songwriting Studio; Song Arrangement Board; Personal Songbook; Performance Mode.
- Chord Progression Generator and Workshop; Rhythm & Strumming Studio; Melody & Harmony Assistant; Music Theory Tools.
- MIDI engine and SoundFont synthesizer; TAB Editor; Standard Notation Editor; combined view; MIDI file import and export.
- Ear Training Studio (Learning Studio › Practice).
- Riff Recorder and Idea Vault.
- **Offline Backing Track Generator and Arrangement Studio** (approved addition, 2026-11-22): style packs, drums, bass, rhythm guitar and keys generation, playback presets, locks and regeneration, variations, MIDI, WAV and stem export.
- MusicXML interchange; project export and restore.

**Deferred (agreed, not in the initial release):**

- Country, worship and jazz generator styles; modal harmony; mood controls beyond the first set (all at X7, after the first release's core).
- Teacher-specific administration (no new user role yet); administrator-managed shared song library.
- Two-track overdub; in-app chord pack import; curricula for bass, seven-string, ukulele and mandolin; screen-off recording on Android.
- Any online feature (content downloads, sync, AI assistant).
- Out of scope: professional multitrack, VST hosting, mixing consoles, mastering, cloud production, online collaboration, subscription sounds, automatic transcription.

## 2. Finalised roadmap (approved working plan)

### Order

| Stage | Contents | Depends on | Student-visible result |
| --- | --- | --- | --- |
| **Phase 1** | Hardware verification, fixes, acceptance of existing PRs (#1 to #4, merged in order only on Jason's authorisation) | None | Current app accepted |
| **Phase 2** | Learning core: courses, missions, per-student placement wizard, directed progression and prerequisite gates, mastery verification and reviews, progress, XP, levels, achievements, real-data dashboard, Learning Studio tour; workspace navigation Stages A and B | Phase 1 | Learn, Practice and Progress become real; workspace selector |
| **X0** | Shared architectural foundations, as seven milestones (below) | Phase 1; each milestone's own dependencies | None (foundations only) |
| **X1** | Chord reference tools (Visual Chord Library, Voicing and Alternate Explorers, Compare, Chord Finder); **Print Studio Core**; **Offline Field Library**; **Low-Power Field** and Field Dashboard; Reference workspace opens with its tour | X0.1–X0.5, X0.7; the 75-shape manifest (approved 2026-11-23); Spike C (PDF writer), which gates **only** the Print Studio PDF work (Print Studio Core and Save to PDF), not the chord tools, Field Library or Low-Power Field (decision 19) | Chord tools, printing and Save to PDF, Field mode |
| **X2** | Songwriting Studio, Arrangement Board, Personal Songbook, Performance Mode; **Expanded Print Studio** (songbooks, lead sheets, lesson worksheets); **field binder**; No-Power Preparation; Play & Create opens with its tour | X0.6, X1; Phase 2 lesson content (for lesson worksheets and binder lessons) | Write, perform and print songs; field binder |
| **X3** | Chord Progression Generator G1 (rock, pop, folk, blues; Lock Chord + Regenerate); Rhythm & Strumming Studio (editor, presets, visual playback, charts); Music Theory Tools; Melody & Harmony guidance on the fretboard; initial Ear Training (intervals, major and minor, with existing tones); **style pack schema v1** shared by the generator and the future backing engine | X2 (Send to Song, pattern attachment); X0.5 (TimerClock); Phase 2 missions, mastery and XP (for ear training) | Generate, strum, theory tools, first ear training, all without a synthesizer |
| **X4** | MIDI synthesis and playback; **load, play, loop, mute, solo and mix existing arrangements** (volume, pan, Practice preset, voice management); generator G2; rhythm audio and accompaniment; ear training chords, progressions and rhythm | X3; Spike B (including offline rendering); Spike D first pass; sound licence verification | Hear songs, progressions, patterns and ear-training chords |
| **X5** (six milestones, below) | TAB Editor, Standard Notation Editor, combined view, melody composition in the Assistant, MIDI file import and export, TAB and notation printing, notation accessibility | X4; Spike A | Write TAB, notation and melodies |
| **X6** (X6a and X6b, below) | Riff Recorder, Idea Vault, pitch-preserving speed change; **Backing Track Generator**: arrangement generation (drums, bass, rhythm guitar, keys), natural performance processing, Natural and Performance presets, locks, regeneration, variations, editing, offline MIDI, WAV and stem export; four styles (rock, blues, pop, folk/acoustic) that pass the listening tests | X4 (and X0.6 media storage); Spike D; style packs passing backing-track-generator.md section 13 | Record ideas, generate and play along with backing tracks |
| **X7** | MusicXML import and export; advanced generator styles G3 (country, worship, jazz, advanced complexity, mood controls) and G4 (modal); advanced backing styles as data packs (country, worship, jazz, southern rock, classic rock, funk, ballads), more articulations and quality improvements from listening tests, FLAC export; final integration and end-to-end testing | X5, X6 | Interchange, more styles, finished workflow |

### X0 milestones (each independently testable)

Each milestone is its own branch and pull request, with its own tests, no visible change for students, and can be paused without leaving anything half-built. None starts without Jason's authorisation.

| Milestone | Contents | Depends on | Done when |
| --- | --- | --- | --- |
| **X0.1 Instrument & Tuning Manager** | `engines/instruments/`: instrument definitions, one shared tuning list (the 7 tuner presets moved unchanged), capo maths, playable-position suggestions | Phase 1 merged | Every tool reads one tuning list; tuner picker unchanged; 4-string bass and 7-string test definitions work with no code change |
| **X0.2 Theory additions** | Keys and key signatures, diatonic harmony, Roman and Nashville numbers, transposition of spelled pitches, new chord qualities and slash chords | X0.1 (capo) | All 24 keys spell correctly; transposing through 12 keys and back is exact |
| **X0.3 Chord catalog pipeline** (chord Stage 1) | CSV authoring, build-time import to JSON, stable ids, review records with fingerprints, `transposeShape`, chord packs through app updates | X0.2; the 27 existing shapes first, the 75-shape manifest after Jason's review | The importer passes chord-system.md Stage 1 criteria |
| **X0.4 Capability layer** | `capabilities()`, Operating Profile administrator card with Full Studio only, audited profile setting | Workspace navigation Stage B (Phase 2) | Every existing feature declares its capability; nothing visible changes for students |
| **X0.5 Transport clock sources** | `ClockSource` abstraction, the existing audio path as AudioClock, a new TimerClock, latency-compensated position for highlighting | Existing transport | Metronome behaves exactly as today; TimerClock tests pass with no AudioContext created |
| **X0.6 Song Project model and storage** | Schema (including backings, generated-part sources, instance overlays, edit flags and reproducible generation metadata), operations engine (undo, redo, journal), invariants, migrations, Rust song commands with ownership, import and export safety, recovery | X0.1, X0.2 | composition-model.md section 17 tests pass |
| **X0.7 Unified diagram rendering** | `neckLayout` shared by screen and print, `fretGrid`, SVG serializers, fret-number and open-string labels, spoken descriptions | X0.1 | notation-rendering.md tests pass; screen and print geometry identical |

X0.1, X0.2, X0.5 and X0.7 have no dependency on each other beyond those listed and can run in any order. X0.4 waits for workspace navigation Stage B.

### X5 and X6 milestones (approved 2026-11-23, decision 20)

Like X0, each milestone is its own branch and pull request with its own tests, and none starts without Jason's explicit approval of that stage.

| Milestone | Contents | Depends on |
| --- | --- | --- |
| **X5.1** | TAB view with a playback-synced cursor (read-only) | X4 |
| **X5.2** | TAB editing | X5.1 |
| **X5.3** | Standard notation rendering | Spike A result |
| **X5.4** | Notation editing and the combined TAB and notation view | X5.2, X5.3 |
| **X5.5** | MIDI file import and export | X0.6, X4 |
| **X5.6** | TAB and notation printing, plus full notation accessibility (creative-workstation.md section 16) | X5.4, Print Studio Core |
| **X6a** | Riff Recorder, Idea Vault, pitch-preserving speed change | X4, X0.6 media storage |
| **X6b** | Backing Track Generator (arrangement generation, presets, locks, regeneration, editing, export, four styles) | X4; Spike D; style packs passing backing-track-generator.md section 13 |

### Phase 2 is protected

- Phase 2's learning priorities come first. X0 milestones may run alongside late Phase 2 only when they take no time away from it; if there's any conflict, Phase 2 wins and the X0 milestone pauses.
- X0 milestones change no screens and no learning behaviour, so they can't delay or alter Phase 2 features.
- Ear training (X3) and lesson worksheets (X2) build on Phase 2's missions, mastery, XP and lesson content; they never change them.

### What changed from the earlier order

Print Studio and the Offline Field Library moved from the last stage to X1 and X2. Creative tools that need no audio (generator G1, Rhythm Studio visual mode, theory tools, melody guidance, first ear training) come before the synthesizer, so they work in Low-Power Field from the start. X0 is now seven milestones instead of one block. The earlier provisional post-Phase-2 order (in the workspace plan and feature-roadmap.md) is superseded.

## 3. Feature cards

Complexity: **S** (days), **M** (1 to 2 weeks), **L** (several weeks), **XL** (a month or more). Profiles: **FS** Full Studio, **LP** Low-Power Field, **NP** No-Power Preparation. Every feature also passes the standing checks in section 4.

### Instrument & Tuning Manager
- **Reuse:** `music-theory/tuning.ts` (Tuning model), the 7 tuner presets, `fretboard.ts` mapping; chord shapes already carry `tuningId`.
- **New:** `engines/instruments/`: instrument definitions (string count, open pitches, fret count, range, clef, MIDI program), one shared tuning list (moved from the tuner), capo maths (sounding vs shape pitch), playable position suggestions for a pitch.
- **Placement:** engine only; tuning pickers in Fretboard Explorer, Tuner and song settings use it.
- **FS/LP/NP:** identical (pure calculation). **Windows/Android:** identical.
- **Acceptance:** every tool reads tunings from one list; Drop D, Open G, Open D, DADGAD and capo 1 to 12 give correct notes in Fretboard Explorer, chord analysis and TAB; a 4-string bass and 7-string test definition work in the fretboard engine without code changes; the curriculum stays guitar-only.
- **Complexity:** S to M. **Stage:** X0.1.

### Operating Profiles
- **Reuse:** account-index installation settings, admin Settings page, checkpoint, reduced-motion styling, lazy AudioContext.
- **New:** `capabilities()` engine, Operating Profile admin card, profile badge, explanation cards, Field Dashboard, audio suspension and synth unload timers (30 s and 2 min initial values, subject to measurement), the No-Power temporary home rule, measurement scripts.
- **Placement:** Admin Settings; Field Dashboard replaces the dashboard in LP; Print/Export Center is the temporary home in NP even if Reference is hidden, without changing workspace visibility or permissions.
- **Acceptance:** operating-profiles.md tests, including measured CPU, memory, startup and battery, and the lifecycle and power-safety table.
- **Complexity:** M (framework and LP), S (NP once Print Studio exists). **Stage:** X0.4 (framework, Full Studio), X1 (LP and Field Dashboard), X2 (NP).

### Chord system (catalog, Library, Voicing and Alternate Explorers, Compare)
- **Reuse:** shape model, analysis, validation, diagram layout and renderer, Fretboard, theory engine.
- **New:** CSV importer and JSON catalog, review records, `transposeShape`, search index, related-chord rules, new qualities, Compare view.
- **Depends on:** X0.2, Jason's review of the 18 flagged shapes.
- **Placement:** Learning Studio › Fretboard Explorer › Chords.
- **FS/LP:** full; LP uses flat cards. **NP:** browsing plus "Print selected chords".
- **Acceptance:** chord-system.md Stages 1 to 3 and 5. **Complexity:** L. **Stage:** X0.3 (catalog), X1 (Library, Explorers, Compare, integration).

### Reverse Chord Finder ("What Chord Am I Playing?")
- **Reuse:** Fretboard (input), theory engine, chord renderer.
- **New:** `identifyChord`, one-position-per-string input store, Chord Finder tab.
- **Depends on:** X0.2 (qualities); catalog only for "open in library" links.
- **Placement:** Fretboard Explorer › Chord Finder; links from Chords and the dashboard.
- **FS/LP/NP:** identical (no audio). **Android:** large touch targets on phones.
- **Acceptance:** chord-system.md Stage 4. **Complexity:** M. **Stage:** X1.

### Unified diagram rendering
- **Reuse:** `chordDiagram`, `ChordDiagram.svelte`, `Fretboard.svelte`, `scalePositions`, worksheet engine.
- **New:** `neckLayout` shared by screen and print, `fretGrid` for scale boxes, SVG serializers, fret-number and open-string labels, spoken descriptions.
- **Placement:** shared components. **FS/LP/NP:** identical; print variant is black and white.
- **Acceptance:** notation-rendering.md tests. **Complexity:** M. **Stage:** X0.7.

### Shared transport clock sources
- **Reuse:** `engines/audio/transport.ts`, `services/audio/transport.ts`, shared AudioContext.
- **New:** `ClockSource` abstraction, AudioClock, TimerClock, latency-compensated highlighting, tap-latency calibration.
- **Acceptance:** transport-timing.md tests. **Complexity:** S to M. **Stage:** X0.5.

### Print Studio Core, Expanded Print Studio and Offline Field Library
- **Reuse:** worksheet engine (page layout, paper sizes, 1/2/4/6 per page), shared renderers, backup export to folder or USB.
- **New:** Print Studio screen; Core templates (chord reference sheets, fretboard diagrams, scale charts, blank TAB, blank notation paper, blank chord boxes, songwriting worksheets); Expanded templates (personal songbooks, lead sheets, lesson worksheets, the field binder, later TAB and notation printing); the shared **PDF writer** (Save to PDF, no printer needed) with paper and screen-reading layouts.
- **Depends on:** X0.7; Spike C; Song Projects (Expanded); Phase 2 lesson content (lesson worksheets).
- **Placement:** Reference › Printable Resources and Offline Field Library (Reference opens at X1). In Learning Studio, "Print Materials" points here until then.
- **FS/LP:** full. **NP:** the Print/Export Center is home.
- **Windows and Android:** the same PDF writer on both; WebView printing only for optional printing; Android printing through its print framework (android-platform.md section 3).
- **Acceptance:** creative-workstation.md section 9; the binder tests in operating-profiles.md.
- **Complexity:** L (templates in waves). **Stage:** X1 (Core), X2 (songbooks, lead sheets, lesson worksheets, binder), X3 (rhythm, progression and target-note charts), X5 (TAB and notation).

### Song Project model and storage
- **Reuse:** Rust storage core (ownership, atomic writes, migrations, backups).
- **New:** composition-model.md: project folder, operations engine with undo and journal, invariants, timing and form rules, revisions, safe import and export, recovery, Rust song commands.
- **Depends on:** X0.1, X0.2. **Placement:** engine and storage.
- **FS/LP/NP:** identical files in every profile. **Android:** app-private storage, system document picker for export and import.
- **Acceptance:** composition-model.md section 17; recordings included in backups by default with an opt-out. **Complexity:** L. **Stage:** X0.6.

### Songwriting Studio and Song Arrangement Board
- **Reuse:** chord catalog and search, renderer, theory engine.
- **New:** writing and chords-and-lyrics views, chord chips, chord tray, sections, endings and per-instance overrides, key and capo tools, arrangement board.
- **Depends on:** X0.6, X1 (chord catalog).
- **Placement:** Play & Create (opens the workspace).
- **FS/LP:** full (text-based, no audio needed). **NP:** open, edit and print.
- **Android:** drawer and bottom-sheet layouts; editing on phones kept simple.
- **Acceptance:** creative-workstation.md section 14, X2. **Complexity:** L. **Stage:** X2.

### Personal Songbook and Performance Mode
- **Reuse:** Song Projects, search patterns, high-contrast and text-size settings.
- **New:** songbook list, tags, favourites, setlists, import (separate copy by default) and export; Performance Mode with auto-scroll.
- **Depends on:** X0.6. **Placement:** Play & Create.
- **FS/LP:** full; LP disables auto-scroll animation smoothing. **NP:** printable songbook.
- **Acceptance:** works with no audio device; auto-scroll matches the arrangement timing; setlists survive reload; import safety tests pass. **Complexity:** M. **Stage:** X2.

### Chord Progression Generator and Workshop
- **Reuse:** theory engine, chord catalog, related-chord rules, seeded RNG, renderer, transport.
- **New:** generator engine, versioned style, template and mood data files, Workshop screen, saved progressions.
- **Depends on:** chord catalog, Song Project model (Send to Song), MIDI engine for playback (G2).
- **Placement:** Play & Create.
- **FS:** full. **LP:** full; playback loads only on Play. **NP:** generate and print progression charts.
- **Acceptance:** creative-workstation.md section 5 (styles at first: rock, pop, folk, blues). **Complexity:** L. **Stage:** X3 (G1 including Lock Chord + Regenerate), X4 (G2 playback), X7 (G3 and G4).

### Rhythm & Strumming Studio
- **Reuse:** shared transport and metronome (one timing system), practice drills engine, renderer patterns, print engine.
- **New:** pattern editor and presets on the composition model's `RhythmPattern` (no separate format), visual playback on the TimerClock, printable rhythm charts.
- **Depends on:** X0.5, X0.6; MIDI engine for strummed audio.
- **Placement:** Play & Create (the studio); a Practice entry in Learning Studio links to the same studio.
- **FS:** full. **LP:** works without audio (visual beat stepping); audio loads on Play if allowed. **NP:** printable charts.
- **Acceptance:** creative-workstation.md section 6. **Complexity:** M to L. **Stage:** X3 (editor, visual playback, presets, print), X4 (audio).

### MIDI engine and synthesizer
- **Reuse:** shared AudioContext, transport, metronome, performance `midi-note` types.
- **New:** event conversion from the composition model, scheduler, WebAudio SoundFont synth (preferred), compact sound set (after licence verification), mute and solo.
- **Depends on:** X0.6, X0.5; Spike B; sound licence verification.
- **Placement:** shared service; the transport bar appears in every tool with playback.
- **FS:** loaded on first playback. **LP:** loaded on Play, unloaded after 2 minutes idle. **NP:** never loaded.
- **Acceptance:** creative-workstation.md section 14, X4; Spike B thresholds. **Complexity:** L. **Stage:** X4.

### TAB Editor, Standard Notation Editor and combined view
- **Reuse:** composition model, Instrument & Tuning Manager (position suggestions), Fretboard for entry, transport.
- **New:** editors, VexFlow-based rendering (preferred, pending Spike A), measure layout, techniques, printing, the accessible score structure.
- **Depends on:** X0.6, X4, Spike A.
- **Placement:** Play & Create.
- **FS/LP:** full (LP playback on demand). **NP:** print TAB and notation; blank paper.
- **Android:** tablets edit; phones view and do simple entry first.
- **Acceptance:** creative-workstation.md section 14, X5, and section 16 (accessibility). **Complexity:** XL. **Stage:** X5.

### Melody & Harmony Assistant
- **Reuse:** `scalePositions`, `chordToneLabel`, intervals, Fretboard highlights, harmony track, composition model, MIDI audition.
- **New:** one assistant panel; writes only notes the user chooses into a melody clip (no separate melody format).
- **Placement:** Play & Create, inside the TAB and notation editors and the Progression Workshop.
- **FS:** full. **LP:** full; audition on demand. **NP:** print target-note and arpeggio charts.
- **Acceptance:** creative-workstation.md section 7. **Complexity:** M (guidance), L (composing). **Stage:** X3 (fretboard guidance over a progression), X5 (composing into clips).

### Ear Training Studio
- **Reuse:** lessons and practice engines, mastery engine (own `ear:` skills), reference tones, MIDI engine later, seeded RNG, XP ledger and achievements (Phase 2).
- **New:** exercise types, short missions, its own mastery rule (`EAR_MASTERY_CONFIG`), untimed accommodation, review scheduling, anti-farming XP limits, its own progress section.
- **Depends on:** Phase 2 learning core; X0.5 (rhythm exercises); MIDI engine for chords and progressions.
- **Placement:** **Learning Studio › Practice › Ear Training** (no new workspace or sidebar item).
- **FS:** full. **LP:** audio starts only when an exercise starts. **NP:** not featured (needs sound).
- **Acceptance:** creative-workstation.md section 8. **Complexity:** L. **Stage:** X3 (intervals and major/minor with existing tones), X4 (chords, progressions and rhythm with the synth).

### Music Theory Tools
- **Reuse:** theory engine, generator data, Instrument & Tuning Manager.
- **New:** circle of fifths, scale finder, key finder, chord construction, scale harmonizer, Roman and Nashville analysis, transposition and capo calculators.
- **Placement:** Play & Create › Music Theory Tools (one copy; the Workshop embeds the circle of fifths component).
- **FS/LP/NP:** identical (no audio); NP prints charts. **Complexity:** M. **Stage:** X3.

### Riff Recorder and Idea Vault
- **Reuse:** shared audio engine, device selection, mic input, Song Project media folder, backup system.
- **New:** recorder worklet, WAV writing in Rust with recoverable partial files, takes list, trim, loop, pitch-preserving speed, attach to sections.
- **Placement:** Play & Create. **FS:** full. **LP:** loads on Record if allowed. **NP:** not initialised.
- **Android:** microphone permission flow; free-space checks; stops and saves when backgrounded.
- **Acceptance:** creative-workstation.md section 14, X6. **Complexity:** L. **Stage:** X6.

### Offline Backing Track Generator and Arrangement Studio
- **Spec:** [backing-track-generator.md](backing-track-generator.md). Judged by how musical the result sounds, not by style or instrument count.
- **Reuse:** Progression Generator, Rhythm Studio patterns, composition model (clips, `backings[]`, overlays), MIDI engine, SoundFont synth, shared transport, Instrument & Tuning Manager, chord catalog voicings, operations engine, Songbook and Songwriting Studio. No second model, transport, progression generator or audio engine.
- **New:** style packs (shared schema with the generator), form planner, groove grid, part generators (drums, bass, rhythm guitar, keys; a common interface for more), performance processor, playback presets, locks and regeneration, variations, Update after chord changes, offline MIDI, WAV and stem export, Easy and Advanced modes.
- **Depends on:** X0.6, X3 (progressions, patterns, style schema), X4 (playback and mixer), Spikes B and D, sound licence verification.
- **Placement:** Play & Create; links from songs, the Progression Workshop and practice.
- **FS:** complete. **LP:** generation and editing; sounds load only for playback or rendering; Practice preset by default. **NP:** view and print arrangement charts; lightweight data-only generation; no audio.
- **Android:** lite sound set (≤ 80 MB target), foreground-only playback and rendering, full-mix export by default on phones.
- **Acceptance:** backing-track-generator.md section 13 (technical criteria and listening rubric); no realism claim before listening tests.
- **Complexity:** XL. **Stage:** X0.6 (representation), X3 (inputs and schema), X4 (playback and mixing), X6 (generator), X7 (more styles and quality).

### Guided tours
- **Reuse:** guided-tours.md architecture. **Depends on:** Help page and the features each step describes.
- **Placement:** Learning Studio tour in Phase 2; Reference tour at X1 and Play & Create tour at X2, when each workspace opens. **FS/LP:** full; LP without animation. **NP:** none.
- **Complexity:** M. **Stage:** Phase 2, X1, X2.

### MusicXML and MIDI file interchange
- **Reuse:** composition model (including preservation of unsupported content), MIDI engine.
- **New:** MusicXML and Standard MIDI File converters with a published support list and import reports.
- **Placement:** Song menu (import and export). **FS/LP/NP:** identical.
- **Complexity:** L. **Stage:** X5 (MIDI files), X7 (MusicXML).

## 4. Standing acceptance checks (every stage and milestone)

1. All existing tests pass (Rust core, app, TypeScript and scripted click-throughs) and existing features behave as before.
2. No lesson, mastery, XP, progress or tour data changes except through its own feature.
3. Student and administrator permissions, workspace access and visibility are unchanged; students never reach another student's data.
4. Everything works with networking blocked.
5. Unavailable features never appear as working controls.
6. Layouts work at 1280 px and at phone width, with keyboard and screen reader.
7. Behaviour is correct in each operating profile, and resource measurements are recorded for any new service.
8. Branding (logo, palette, glow cards) is unchanged; local files stay authoritative; no SQLite and no mandatory cloud service.

## 5. Technical items (formerly gaps G1 to G12)

| Item | Status after the refinement pass |
| --- | --- |
| **T1 Notation renderer** | VexFlow preferred; Spike A criteria and decision rule documented (creative-workstation.md section 3). Spike not authorised. |
| **T2 Synthesizer** | WebAudio SoundFont synth preferred; Spike B criteria documented. Spike not authorised. |
| **T3 Sound licences** | Verification procedure documented; FluidR3's MIT licence confirmed from one source copy with a provenance caveat; MuseScore General and GeneralUser GS unverified. No sound asset until verified and approved. |
| **T4 PDF on Android** | Resolved in design: one shared PDF writer from SVG pages on both platforms; WebView printing only for optional printing (android-platform.md section 3). Spike C criteria documented. |
| **T5 Silent clock** | Resolved in design: TimerClock in the clock-source abstraction (transport-timing.md). |
| **T6 Measurement setup** | Still needed: reference laptop now, tablet and phone at the Android stage, and a repeatable battery script (operating-profiles.md). |
| **T7 Lesson content** | Lesson worksheets and binder lessons depend on Phase 2 course content being written and approved. |
| **T8 Ear-training mastery** | Resolved in design: own rule and XP limits (creative-workstation.md section 8); initial values need Jason's review before implementation. |
| **T9 Profile home vs visibility** | Resolved: temporary home rule (operating-profiles.md). |
| **T10 Song import collisions** | Resolved: separate copy by default; confirmed replacement with backup (composition-model.md section 14). |
| **T11 Notation accessibility** | Resolved in design: creative-workstation.md section 16. |
| **T12 Recording storage on Android** | Resolved in design: free-space checks, recoverable partial files, stop-and-save on background (android-platform.md, composition-model.md). Screen-off recording deferred. |
| **T13 Backing-track realism** | Depends mainly on redistributable sample quality (velocity layers, round-robin drums, guitar articulations) and synth capabilities; Spike D criteria documented (backing-track-generator.md section 6). No realism claim until listening tests pass. |

## 6. Conflicts with earlier plans (status)

1. **Earlier post-Phase-2 order** (workspace plan and feature-roadmap.md): superseded by section 2, now approved. Both places point here.
2. **Workspace plan decision on Print Materials** (stays in Learning Studio until Reference opens, then moves): consistent; Reference opens at X1 with Print Studio Core.
3. **Dashboard "Print Worksheet" quick action** stays "Coming soon" until Print Studio Core passes its tests at X1.
4. **Tuning presets** move from the tuner to the shared list at X0.1; the tuner's behaviour and picker stay the same.
5. **Locked note-mastery rule** stays untouched; ear training has its own rule.
6. **PR #4 scope:** PR #4 carries the architecture documents (no code). Moving them to a separate documentation PR is still open (R1).
7. **Phase 2 priority:** protected (section 2).
8. **Chord system and diagram rendering were first written as "Phase 2 architecture".** They are now scheduled at X0.3, X0.7 and X1; Phase 2 itself is the learning core and workspace navigation. Phase 2 lessons use the existing 27 shapes and renderer.
9. **Work-scope rule** (requirements-v1.md: engines may be built from the current spec without further approval): the X-stage documents are architecture, not a build specification under that rule; Jason has said each stage needs his authorisation. Recorded as R2 for confirmation.

## 7. Decisions

**Resolved by Jason (2026-11-22, this pass):**

- **D1** The X0–X7 roadmap is approved as the working development plan, with X0 split into milestones.
- **D2** In No-Power Preparation the Print/Export Center is the temporary home even if Reference is hidden, without changing visibility or permissions.
- **D3** Ear training has its own mastery criteria and takes part in XP and achievements with anti-farming limits.
- **D4** Ear Training Studio sits under Learning Studio › Practice.
- **D5** Field binders: students build their own; administrators build shared binders; student songs in an administrator binder only with explicit, revocable, audited student authorisation.
- **D7** Spikes stay unauthorised; their evaluation criteria and thresholds are now documented for separate approval.
- **D8** (2026-11-23) Wave 1 confirmed by Jason: learning engine contracts, the Adaptive Skill Assessment & Placement Engine and the metronome Wave 1 UI are authorised (scope in the Wave 1 section below). Automatic Learning Unlock counts lessons covered by verified placement evidence; the lesson override is named Open All Lessons. Storage and enforcement split (facts stored, access derived; Open All Lessons grants in account data) approved, see fretboard-mastery-placement.md.


**Finalized by Jason (2026-11-23, decisions 1–21):**

- **D9** Workspace decisions 1–12 approved, including the selector mockups (expanded selector, collapsed rail, collapsed popover, Workspace Settings). Learning Studio is permanently unlocked; other workspaces unlock at 80% Beginner and 50% Intermediate lessons covered, or by an administrator grant or Unlock All Workspaces. Student preferences show or hide an available workspace but never lock it. Unlocking never creates completions, mastery or XP. **Stage A merged (PR #6). Stage B was authorized on 2026-11-23 and is built in PR #8; merging waits for Jason's Windows hardware verification and his explicit approval.** Jason also asked (2026-11-23) for administrator-editable unlock thresholds (defaults 80% and 50%) and for a hidden but open workspace to stay reachable by authorised links, listed in the selector while in use; both are in PR #8. See architecture.md, Workspaces.
- **D10** Chord decisions 13–16 approved: the 75-shape manifest with the approved primary fingerings and alternatives (corrections recorded in the manifest), students see only approved shapes in released builds, and the Chord Finder may begin after chord Stage 1 using validated shapes only. Implementation still follows the X0.3 and X1 stage approvals.
- **D11** (was R2, decision 17) Each X stage and milestone needs Jason's explicit approval before implementation. Stages may be planned but are never started automatically.
- **D12** (was R3, decision 18) Ear-training thresholds approved exactly as in creative-workstation.md section 8: whole-number qualifying counts rather than rounded percentages, first answers only, 0.3 s guess limit, untimed mode and rhythm windows up to ±120 ms with full progression eligibility, 80% to open the next set, reviews at 2, 7 and 21 days, below 70% over 5 review attempts returns an item to learning without erasing history, achievements or XP, quarter XP for all-mastered missions, a daily cap of six missions' worth that limits XP only, and no missed-day penalties.
- **D13** (decision 19) The Spike C gate applies to the Print Studio PDF work only.
- **D14** (decision 20) X5 splits into six milestones and X6 into X6a (recorder) and X6b (Backing Track Generator); see the table above.
- **D15** (decision 21) The metronome pendulum stays synchronised to the shared audio timing engine ([transport-timing.md](transport-timing.md)); it never runs its own clock.

**Still open:**

- **R1** (was D6) Move the architecture documents from PR #4 to a separate documentation PR? (PR #4 has since been merged.)
- **R4** Authorise Spikes A, B, C and D separately when convenient (Spike C is the first needed, before X1; Spike D before X4's sound set is fixed).
- **R6** Backing Track Generator approvals (before X4 and X6): sound-set budgets, the listening panel and pass bar, and whether rendered WAV files may be kept inside songs (backing-track-generator.md section 14).

## 8. Implementation risks found in this review

1. **Phase 2 slippage from parallel work.** Mitigated by small X0 milestones that pause whenever Phase 2 needs the time.
2. **Audio timing in hidden or throttled windows.** WebView timers are throttled when hidden; audio could gap. Mitigated by audio-clock scheduling with a larger look-ahead and, if needed, an AudioWorklet scheduler; measured in Spike B.
3. **Android PDF and printing.** Android's WebView can't print from JavaScript, so PDF needs our own writer and printing needs a small native print adapter (Tauri Android plugin work). Mitigated by Spike C and the shared-writer design.
4. **Sound licensing and provenance.** A candidate SoundFont may turn out unsuitable (unclear sample provenance or terms). Fallback: a smaller verified set, or the existing reference-tone synthesis for ear training and simple playback.
5. **Notation editor size.** X5 is the largest item (layout, line breaking, techniques, the accessible parallel structure). Mitigated by Spike A, phone view-only first, and accessibility designed now.
6. **Composition model edge cases** (pickups, endings, tuplets, meter changes, anchors). Mitigated by rational durations, explicit rules and seeded property tests over 1,000 operation sequences.
7. **MusicXML fidelity expectations.** Mitigated by preserving unsupported content, import reports and a published support list.
8. **A new privileged read path** (administrator binder access to authorised songs). Needs a focused security review and tests that refusal is immediate after revocation.
9. **Storage pressure** from recordings and PDFs, especially on Android. Mitigated by free-space checks, `.partial` files and the backup opt-out for recordings.
10. **Low-end tablet performance in Low-Power Field.** Requires real reference devices (T6) before restrictions are finalised.
11. **Backing-track realism** depends on sample libraries that may be scarce, large or unclear in licence. Mitigated by Spike D, licence verification and holding back any style that fails the listening tests.
12. **Documentation drift** across many documents. Mitigated by this index, the terminology section and a consistency check at each stage.

## Wave 1 owner-approved priority (2026-11-22; supersedes conflicting sequence guidance below)

The owner has explicitly authorised **Wave 1 engine development and the metronome UI change**, subject to the Phase 1 integration/branch safeguards. First audit the actual source and outstanding Phase 1 PRs. Do not merge or overwrite work without approval. The earlier documentation-only restriction does not block this specifically authorised Wave 1 scope.

1. Establish reusable, typed, pure-TypeScript learning contracts and orchestration across curriculum/lessons, assessment/placement, practice, performance, mastery, fretboard, Chord System and future instrument modules. Define stable skill IDs, evidence schemas and access decisions without circular engine imports or duplicate skill records.
2. Define Fretboard Mastery prerequisite graph and evidence gates alongside the **Adaptive Skill Assessment & Placement Engine**. Three universal background questions route a practical adaptive assessment (~5–12 prompts, more when evidence insufficient). A validated candidate item bank (~60–80) is a Wave 1 target, not a substitute for verification. Per-student placement, prior-lesson access, locked future lessons and per-student/per-curriculum Admin **Open All Lessons** (access only, audited and revocable; distinct from Unlock All Workspaces) are Wave 1 engine deliverables. The full wizard, Admin UI and other learning screens are later integration work. Detailed behavior: [fretboard-mastery-placement.md](fretboard-mastery-placement.md).
3. **Metronome Wave 1 UI:** On Windows add a compact pendulum-like dot traversing a semicircular/half-arc track above-right of the tempo setting, synchronized to the authoritative audio beat. Make Play/Stop, Tap Tempo, Volume and Time Signature compact **equal-size 2×2 control blocks**, with tempo display above. On Android place the indicator responsively near tempo and preserve touch targets and no overflow. Respect reduced motion; do not create a second audio clock (confirmed as decision 21, 2026-11-23). Preserve existing functions and test synchronization and layout.
4. Test each engine seam and persistence/authorization behavior before wiring the wizard, dashboard, Learn, Practice, Progress and Admin UI. The metronome redesign can be implemented independently within Wave 1. Preserve Windows-first/Android-later and local JSON/Rust ownership boundaries.

**Status (2026-11-23, Jason):** Wave 1 remains approved scope, but Phase 2 coding does not begin until the outstanding Phase 2 decisions are settled (P1, P2, P3, P7 and P11 before engine work; see the "Phase 2 decisions and Wave 1 plan" document). Documentation records decisions; it does not by itself authorise implementation beyond Jason's direct instructions. Wave 1 builds engines, persistence and Rust seams plus the metronome redesign; the placement wizard, Admin Open All Lessons UI, missions, XP, achievements and dashboard wiring are later Phase 2 milestones.

**Sequence note:** The older recommendation immediately below remains historical planning context; this Wave 1 decision takes precedence where its priority/order differs. It does not approve unrelated roadmap features.

## 9. Recommendation for the next development stage

*Historical (written before PRs #1 to #8). The Wave 1 section above and its status note take precedence; the chord manifest review it mentions is complete (PR #7).*

After the currently authorised work (Phase 1 hardware verification, fixes and merging PRs #1 to #4 in order on your authorisation):

1. **Start Phase 2** as already approved, with workspace navigation Stages A and B alongside.
2. **Alongside, only where it takes no time from Phase 2:** X0.1 (Instrument & Tuning Manager) and X0.2 (theory additions), then X0.3 (chord catalog, loading the 75 shapes once you've reviewed the 18 flagged ones) and X0.5 (clock sources). These are small, low-risk and used by everything later.
3. **Before X1:** authorise Spike C (PDF writer), since Print Studio Core and Save to PDF depend on it.
4. **First visible expansion: X1** (Visual Chord Library, Chord Finder, Print Studio Core with Save to PDF, Offline Field Library and Low-Power Field).

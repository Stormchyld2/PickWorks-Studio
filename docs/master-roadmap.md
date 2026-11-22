# PickWorks Studio master roadmap and feature inventory

Consolidated 2026-11-22 after Jason approved the overall direction of the creative workstation and operating profiles, with refinements. **Documentation only.** No feature is implemented, no code is changed, no dependency is installed and no spike is run until Jason authorises it.

Detailed designs: [creative-workstation.md](creative-workstation.md) · [composition-model.md](composition-model.md) · [operating-profiles.md](operating-profiles.md) · [chord-system.md](chord-system.md) · [notation-rendering.md](notation-rendering.md) · [guided-tours.md](guided-tours.md) · [feature-roadmap.md](feature-roadmap.md) · Workspace Navigation Implementation Plan (Claude Doc).

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
- Mastery engine (attempts, events, the locked mastery rule) and dashboard summaries.
- Print worksheet engine (blank, all-notes and anchor fretboards, paper sizes): Print Materials still says "Coming soon".
- Shared audio engine, shared transport (only the metronome uses it), reference tones (plucked-string synthesis), pitch detection.
- Tuning presets (Standard, Drop D, Half-Step Down, Open G, plus Whole-Step Down, Open D and DADGAD defined but not in the picker).
- Performance pipeline (UI input only; microphone, MIDI and camera inputs typed but not built).
- Connectivity guard (always offline). Help page ("Coming soon").

**Planned (architecture approved, not built):**

- Phase 2 learning core: courses (Fretboard Foundations), ADHD-friendly missions, mastery verification and review scheduling, progress, XP, levels, achievements, dashboard tied to real data.
- Workspace navigation (selector, Tools group), administrator Workspace Access, student visibility.
- Guided tours and contextual help.
- Operating Profiles (Full Studio, Low-Power Field, No-Power Preparation) and the Field Dashboard.
- Instrument & Tuning Manager.
- Chord system: CSV catalog (75 shapes first, 18 awaiting review), Visual Chord Library, Voicing Explorer, Alternate Chord Explorer, Compare Chords, Reverse Chord Finder ("What Chord Am I Playing?").
- Unified notation rendering (chords, scales, exercises, blank fretboards).
- Print Studio, Offline Field Library, Prepare for Grid-Down binder.
- Song Project model; Songwriting Studio; Song Arrangement Board; Personal Songbook; Performance Mode.
- Chord Progression Generator and Workshop; Rhythm & Strumming Studio; Melody & Harmony Assistant; Music Theory Tools.
- MIDI engine and SoundFont synthesizer; TAB Editor; Standard Notation Editor; combined view; MIDI import and export.
- Ear Training Studio.
- Riff Recorder and Idea Vault; Backing Tracks.
- MusicXML interchange; lead sheet, TAB and notation printing; project export and restore.

**Deferred (agreed, not in the initial release):**

- Country, worship and jazz generator styles; modal harmony; mood controls beyond the first set.
- Teacher-specific administration (no new user role yet); administrator-managed shared song library.
- Two-track overdub; in-app chord pack import; curricula for bass, seven-string, ukulele and mandolin.
- Any online feature (content downloads, sync, AI assistant).
- Out of scope: professional multitrack, VST hosting, mixing consoles, mastering, cloud production, online collaboration, subscription sounds, automatic transcription.

## 2. Feature cards

Complexity: **S** (days), **M** (1 to 2 weeks), **L** (several weeks), **XL** (a month or more). Profiles: **FS** Full Studio, **LP** Low-Power Field, **NP** No-Power Preparation. Every feature also passes the standing checks in section 4.

### Instrument & Tuning Manager
- **Reuse:** `music-theory/tuning.ts` (Tuning model), the 7 tuner presets, `fretboard.ts` mapping; chord shapes already carry `tuningId`.
- **New:** `engines/instruments/`: instrument definitions (string count, open pitches, fret count, range, clef, MIDI program), one shared tuning list (moved from the tuner), capo maths (sounding vs shape pitch), playable position suggestions for a pitch.
- **Depends on:** nothing. **Placement:** engine only; tuning pickers in Fretboard Explorer, Tuner and song settings use it.
- **FS/LP/NP:** identical (pure calculation). **Windows/Android:** identical.
- **Acceptance:** every tool reads tunings from one list; Drop D, Open G, Open D, DADGAD and capo 1 to 12 give correct notes in Fretboard Explorer, chord analysis and TAB; a 4-string bass and 7-string test definition work in the fretboard engine without code changes; the curriculum stays guitar-only.
- **Complexity:** S to M. **Stage:** X0.

### Operating Profiles
- **Reuse:** account-index installation settings, admin Settings page, checkpoint, reduced-motion styling, lazy AudioContext.
- **New:** `capabilities()` engine, Operating Profile admin card, profile badge, explanation cards, Field Dashboard, audio suspension and synth unload timers (30 s and 2 min initial values), measurement scripts.
- **Depends on:** workspace navigation Stage B (capability layer sits beside access); Print Studio for NP's home.
- **Placement:** Admin Settings; Field Dashboard replaces the dashboard in LP; Print/Export Center is the home in NP.
- **Behaviour:** as in operating-profiles.md. Full Studio is the default on Windows and Android.
- **Acceptance:** see operating-profiles.md tests, including measured CPU, memory, startup and battery.
- **Complexity:** M (framework and LP), S (NP once Print Studio exists). **Stage:** X0 (framework), X1 (LP and Field Dashboard), X2 (NP).

### Chord system (catalog, Library, Voicing and Alternate Explorers, Compare)
- **Reuse:** shape model, analysis, validation, diagram layout and renderer, Fretboard, theory engine.
- **New:** CSV importer and JSON catalog, review records, `transposeShape`, search index, related-chord rules, new qualities, Compare view.
- **Depends on:** Instrument & Tuning Manager; Jason's review of the 18 flagged shapes.
- **Placement:** Learning Studio › Fretboard Explorer › Chords.
- **FS/LP:** full; LP uses flat cards. **NP:** browsing plus "Print selected chords".
- **Windows/Android:** card grid adapts at 600 and 840 px.
- **Acceptance:** chord-system.md Stages 1 to 3. **Complexity:** L. **Stage:** X0 (catalog), X1 (Library and Explorers).

### Reverse Chord Finder ("What Chord Am I Playing?")
- **Reuse:** Fretboard (input), theory engine, chord renderer.
- **New:** `identifyChord`, one-position-per-string input store, Chord Finder tab.
- **Depends on:** chord qualities and catalog (for "open in library" links only).
- **Placement:** Fretboard Explorer › Chord Finder; links from Chords and the dashboard.
- **FS/LP/NP:** identical (no audio). **Windows/Android:** large touch targets on phones.
- **Acceptance:** chord-system.md Stage 4. **Complexity:** M. **Stage:** X1.

### Unified notation rendering
- **Reuse:** `chordDiagram`, `ChordDiagram.svelte`, `Fretboard.svelte`, `scalePositions`, worksheet engine.
- **New:** `neckLayout` shared by screen and print, `fretGrid` for scale boxes, SVG serializers, fret-number and open-string labels, spoken descriptions.
- **Depends on:** Instrument & Tuning Manager. **Placement:** shared components.
- **FS/LP/NP:** identical; print variant is black and white.
- **Acceptance:** notation-rendering.md tests. **Complexity:** M. **Stage:** X0.

### Print Studio, Offline Field Library and Prepare for Grid-Down
- **Reuse:** worksheet engine (page layout, paper sizes), shared renderers, platform print adapter, backup export to folder or USB.
- **New:** Print Studio screen; templates for chord reference sheets, fretboard maps, scale charts, lesson worksheets, blank TAB, blank staff paper, blank chord boxes, songwriting worksheets, songbook and lead sheets; compact ink-efficient layouts; Save to PDF (default, no printer needed) with paper and screen-reading layouts; the field binder builder.
- **Depends on:** unified rendering; Song Projects (for songbook pages); lesson content (for lesson worksheets).
- **Placement:** Reference › Printable Resources and Offline Field Library (Reference opens when this ships, as the plan expected). In Learning Studio, "Print Materials" points here until then.
- **FS/LP:** full. **NP:** the home screen.
- **Windows:** WebView2 print and PDF. **Android:** Android print framework for printing; PDF export path to be decided (gap G4).
- **Acceptance:** each template's output is black and white, matches the screen, and has a test before its button appears; Save to PDF works with no printer installed; the binder test in operating-profiles.md.
- **Complexity:** L (templates added in waves). **Stage:** X1 (chord, fretboard, scale, blank sheets, worksheets), X2 (songbook, lead sheets, binder, lesson worksheets once Phase 2 lessons exist).

### Song Project model and storage
- **Reuse:** Rust storage core (ownership, atomic writes, migrations, backups).
- **New:** composition-model.md: project folder, operations engine with undo, invariants, autosave journal, revisions, export and import, Rust song commands.
- **Depends on:** Instrument & Tuning Manager, theory additions. **Placement:** engine and storage.
- **FS/LP/NP:** identical files in every profile. **Android:** app-private storage, file picker for export.
- **Acceptance:** composition-model.md tests; recordings included in backups by default with an opt-out. **Complexity:** L. **Stage:** X0.

### Songwriting Studio and Song Arrangement Board
- **Reuse:** chord catalog and search, renderer, theory engine.
- **New:** writing and chords-and-lyrics views, chord chips, sections, key and capo tools, arrangement board.
- **Depends on:** Song Project model, chord catalog.
- **Placement:** Play & Create (opens the workspace).
- **FS/LP:** full (text-based, no audio needed). **NP:** open, edit and print.
- **Android:** drawer and bottom-sheet layouts; editing on phones kept simple.
- **Acceptance:** creative-workstation.md Stage 3 criteria. **Complexity:** L. **Stage:** X2.

### Personal Songbook and Performance Mode
- **Reuse:** Song Projects, search patterns, high-contrast and text-size settings.
- **New:** songbook list, tags, favourites, setlists, import and export; Performance Mode with auto-scroll.
- **Depends on:** Song Project model. **Placement:** Play & Create.
- **FS/LP:** full; LP disables auto-scroll animation smoothing. **NP:** printable songbook.
- **Acceptance:** works with no audio device; auto-scroll matches the arrangement timing; setlists survive reload. **Complexity:** M. **Stage:** X2.

### Chord Progression Generator and Workshop
- **Reuse:** theory engine, chord catalog, related-chord rules, seeded RNG, renderer, transport.
- **New:** generator engine, versioned style, template and mood data files, Workshop screen, saved progressions.
- **Depends on:** chord catalog, Song Project model (Send to Song), MIDI engine for playback (G2).
- **Placement:** Play & Create.
- **FS:** full. **LP:** full; playback loads only on Play. **NP:** generate and print progression charts.
- **Acceptance:** creative-workstation.md section 5 (styles at first: rock, pop, folk, blues). **Complexity:** L. **Stage:** X3 (G1 including Lock Chord + Regenerate), X4 (G2 playback), X7 (G3 and G4).

### Rhythm & Strumming Studio
- **Reuse:** shared transport and metronome (one timing system), practice drills engine, renderer patterns, print engine.
- **New:** rhythm pattern model (strums and fingerpicking), pattern editor, presets as data, silent clock source for visual-only playback, printable rhythm charts.
- **Depends on:** transport; MIDI engine for strummed audio; Song Project model for attaching patterns to sections.
- **Placement:** Play & Create (the studio); a Practice entry in Learning Studio links to the same studio.
- **FS:** full. **LP:** works without audio (visual beat stepping); audio loads on Play if allowed. **NP:** printable charts.
- **Acceptance:** creative-workstation.md section 6. **Complexity:** M to L. **Stage:** X3 (editor, visual playback, presets, print), X4 (audio).

### MIDI engine and synthesizer
- **Reuse:** shared AudioContext, transport, metronome, performance `midi-note` types.
- **New:** event conversion from the composition model, scheduler, WebAudio SoundFont synth (preferred, pending performance tests and licence verification), compact sound set, mute and solo.
- **Depends on:** composition model; Jason's spike authorisation.
- **Placement:** shared service; the transport bar appears in every tool with playback.
- **FS:** loaded on first playback. **LP:** loaded on Play, unloaded after 2 minutes idle. **NP:** never loaded.
- **Android:** CPU and latency measured on a mid-range tablet before committing.
- **Acceptance:** creative-workstation.md Stage 4 timing criteria; idle CPU back to baseline. **Complexity:** L. **Stage:** X4.

### TAB Editor, Standard Notation Editor and combined view
- **Reuse:** composition model, Instrument & Tuning Manager (position suggestions), Fretboard for entry, transport.
- **New:** editors, VexFlow-based rendering (preferred, pending comparison with alphaTab), measure layout, techniques, printing.
- **Depends on:** composition model, notation renderer decision, MIDI engine for playback.
- **Placement:** Play & Create.
- **FS/LP:** full (LP playback on demand). **NP:** print TAB and notation; blank paper.
- **Android:** tablets edit; phones view and do simple entry first.
- **Acceptance:** creative-workstation.md Stage 5. **Complexity:** XL. **Stage:** X5.

### Melody & Harmony Assistant
- **Reuse:** `scalePositions`, `chordToneLabel`, intervals, Fretboard highlights, harmony track, composition model, MIDI audition.
- **New:** an assistant panel: compatible scale tones per chord, chord tones and target notes, melody-to-chord interval labels, suggested approach, passing and resolution notes, arpeggio shapes; writes only notes the user chooses into a melody clip.
- **Depends on:** composition model, TAB and notation editors (for writing phrases); can show fretboard guidance earlier.
- **Placement:** Play & Create, as a panel inside the TAB and notation editors and the Progression Workshop (one panel, not a separate app).
- **FS:** full. **LP:** full; audition on demand. **NP:** print target-note and arpeggio charts for a progression.
- **Acceptance:** creative-workstation.md section 7. **Complexity:** M (guidance), L (composing). **Stage:** X3 (fretboard guidance over a progression), X5 (composing into clips).

### Ear Training Studio
- **Reuse:** lessons and practice engines, mastery engine (with its own skill names), reference tones service (plucked-string synthesis already works offline), MIDI engine later, seeded RNG.
- **New:** ear-training exercise types (intervals, major and minor, chord quality, scales and melodic patterns, progressions, rhythm), missions, adaptive difficulty, its own progress view.
- **Depends on:** Phase 2 learning core (missions, progress); MIDI engine for chord and progression sounds (intervals and simple chords can use the existing tones).
- **Placement:** Learning Studio (its own page under Practice, or a Learning Studio sidebar item; see decision D4).
- **FS:** full. **LP:** audio starts only when an exercise starts. **NP:** not applicable (needs sound); printable answer sheets are not useful, so it is simply not featured.
- **Acceptance:** creative-workstation.md section 8; existing course, XP, mastery and progress records are unchanged by ear-training activity. **Complexity:** L. **Stage:** X3 (intervals and major/minor with existing tones), X4 (chords, progressions and rhythm with the synth).

### Music Theory Tools
- **Reuse:** theory engine, generator data, Instrument & Tuning Manager.
- **New:** circle of fifths, scale finder, key finder, chord construction, scale harmonizer, Roman and Nashville analysis, transposition and capo calculators.
- **Placement:** Play & Create › Music Theory Tools (one copy; the Workshop embeds the circle of fifths component).
- **FS/LP/NP:** identical (no audio); NP prints charts. **Complexity:** M. **Stage:** X3.

### Riff Recorder and Idea Vault
- **Reuse:** shared audio engine, device selection, mic input, Song Project media folder, backup system.
- **New:** recorder worklet, WAV writing in Rust, takes list, trim, loop, pitch-preserving speed, attach to sections.
- **Placement:** Play & Create. **FS:** full. **LP:** loads on Record if allowed. **NP:** not initialised.
- **Android:** microphone permission flow; storage quotas.
- **Acceptance:** creative-workstation.md Stage 6. **Complexity:** L. **Stage:** X6.

### Backing Tracks
- **Reuse:** audio engine, transport, recorder playback path, MIDI engine for generated arrangements.
- **Placement:** Play & Create; links from songs and exercises. **FS:** full. **LP:** off by default, administrator may allow. **NP:** not initialised.
- **Complexity:** M. **Stage:** X6.

### Guided tours
- **Reuse:** guided-tours.md architecture. **Depends on:** Help page and the features each step describes.
- **Placement:** Learning Studio tour in Phase 2; Play & Create and Reference tours when each opens. **FS/LP:** full; LP without animation. **NP:** none.
- **Complexity:** M. **Stage:** Phase 2, then X1 and X2 for the other tours.

### MusicXML and MIDI file interchange
- **Reuse:** composition model, MIDI engine.
- **New:** MusicXML and Standard MIDI File converters with a published support list.
- **Placement:** Song menu (import and export). **FS/LP/NP:** identical.
- **Complexity:** L. **Stage:** X5 (MIDI files), X7 (MusicXML).

## 3. Dependency-aware roadmap

Phase 1 and the approved Phase 2 learning priorities come first and are not disrupted. The expansion stages (X0 to X7) are planning boundaries; each needs authorisation.

| Stage | Contents | Depends on | Student-visible result |
| --- | --- | --- | --- |
| Phase 1 | Hardware verification, fixes, PRs #1 to #4 merged | None | Current app accepted |
| Phase 2 | Courses, missions, mastery reviews, progress, XP, achievements, real-data dashboard, Learning Studio tour; workspace navigation Stages A and B alongside (no Phase 2 delay) | Phase 1 | Learn, Practice, Progress become real; workspace selector |
| X0 Foundations (no visible change; may overlap late Phase 2) | Instrument & Tuning Manager; theory additions (keys, Roman and Nashville, transposition, capo); capability layer and Operating Profile admin card (Full Studio); chord catalog pipeline (75 shapes after review); unified rendering (`neckLayout`, serializers); Song Project model and storage | Phase 1; Jason's review of 18 shapes | None |
| X1 Reference and print | Visual Chord Library, Voicing and Alternate Explorers, Compare; Chord Finder; **basic Print Studio** (chord sheets, fretboard maps, scale charts, blank TAB, staff paper, chord boxes, songwriting worksheets, Save to PDF); **Offline Field Library**; Low-Power Field and Field Dashboard; Reference workspace opens | X0 | Chord tools, printing, Field mode |
| X2 Songwriting core | Songwriting Studio, Arrangement Board, Songbook, Performance Mode, songbook and lead-sheet printing, lesson worksheets, **Prepare for Grid-Down** binder, No-Power Preparation; Play & Create opens | X0, X1 | Write, perform, print songs; field binder |
| X3 Creative tools without audio | Progression Generator G1 (rock, pop, folk, blues; Lock Chord + Regenerate), Rhythm & Strumming Studio (visual), Music Theory Tools, Melody & Harmony Assistant (fretboard guidance), Ear Training intervals and major/minor (existing tones) | X1, X2 | Generate, strum, theory, first ear training |
| X4 Playback | MIDI engine and synth (after spike), generator G2, rhythm audio, Ear Training chords, progressions and rhythm | X3; spike authorised | Hear progressions, patterns, ear training |
| X5 Composition | TAB Editor, Notation Editor, combined view, melody composing in the Assistant, MIDI file import and export, TAB and notation printing | X0, X4; renderer comparison | Write TAB and notation |
| X6 Recording and practice | Riff Recorder, Idea Vault, Backing Tracks, speed change | X4 | Record ideas, play along |
| X7 Interop and expansion | MusicXML, generator G3 (country, worship, jazz, mood controls) and G4 (modal), setlists polish, end-to-end tests | X5, X6 | Interchange, more styles |

**What changed from the previous order:** Print Studio and the Offline Field Library move from the last stage to X1 and X2, alongside the chord-reference and songwriting features they print. Creative tools that don't need audio (generator G1, Rhythm Studio visual mode, theory tools, melody guidance, first ear training) move ahead of the synthesizer, so they work in Low-Power Field from the start and deliver value sooner. The earlier provisional post-Phase-2 order is replaced by this table.

## 4. Standing acceptance checks (every stage)

1. All existing tests pass (Rust core, app, TypeScript and scripted click-throughs) and existing features behave as before.
2. No lesson, mastery, XP, progress or tour data changes except through its own feature.
3. Student and administrator permissions, workspace access and visibility are unchanged.
4. Everything works with networking blocked.
5. Unavailable features never appear as working controls.
6. Layouts work at 1280 px and at phone width, with keyboard and screen reader.
7. Behaviour is correct in each operating profile, and resource measurements are recorded for any new service.
8. Branding (logo, palette, glow cards) is unchanged.

## 5. Architectural gaps and unresolved technical decisions

- **G1 Notation renderer:** VexFlow preferred; the comparison against alphaTab is documented but not yet run (spikes not authorised).
- **G2 Synthesizer:** WebAudio SoundFont synth preferred; CPU, latency and battery on Windows laptops and Android tablets not yet measured.
- **G3 Sound licences:** no SoundFont licence is verified until checked against the actual distributable files and attribution requirements.
- **G4 PDF on Android:** Windows can use WebView2's print-to-PDF; Android needs either the Android print framework or a PDF writer in Rust. To be decided before X1 ships on Android.
- **G5 Silent clock:** the transport is driven by the audio clock; visual-only rhythm playback in Low-Power Field needs a timer-based clock source for the same transport (not a second transport).
- **G6 Measurement setup:** reference devices and a repeatable battery test are needed (Jason's actual laptop, tablet and phone).
- **G7 Lesson content:** lesson worksheets and the binder's lesson section depend on Phase 2 course content being written and approved.
- **G8 Ear-training mastery:** the locked mastery rule (90%, 10 attempts, under 3 s, 2 days) was written for note mastery; ear training needs its own criteria and a decision on XP (decision D3).
- **G9 Profile home vs visibility:** in No-Power Preparation the home is the Print/Export Center in Reference; a student who hid Reference still needs that home (decision D2).
- **G10 Song import collisions:** importing a song that already exists (same id) needs a rule: keep both with a new id, or replace after confirmation.
- **G11 Notation accessibility:** screen-reader support for TAB and notation editing needs its own design before X5.
- **G12 Recording storage on Android:** storage quotas and what happens when space runs low.

## 6. Conflicts with existing Phase 1 and Phase 2 plans

1. **Previous post-Phase-2 order** (Printable Resources, Theory Tools, Tuning & Field Skills, Maintenance, Songbook, Audio Engine, Backing Tracks and Recorder, Songwriting) is superseded by section 3. Please confirm.
2. **Workspace plan decision 2** (Print Materials stays in Learning Studio until Reference opens, then moves): consistent; Reference opens at X1 because Print Studio is its first substantial feature.
3. **Dashboard "Print Worksheet" quick action** stays "Coming soon" until basic Print Studio passes its tests at X1.
4. **Tuning presets** live in the tuner today; the Instrument & Tuning Manager moves them to one shared list. The tuner's behaviour and picker stay the same.
5. **Mastery rule** is locked for note mastery; ear training must not alter it (G8).
6. **PR #4 scope:** PR #4 now carries several architecture documents. They don't change code, but you may prefer them moved to a separate documentation PR so PR #4 stays focused on Phase 1.
7. **Phase 2 priority:** X0 foundations may overlap late Phase 2 only if they never delay the learning core.

## 7. Decisions still needing Jason

- **D1** Confirm the roadmap in section 3 (replacing the earlier post-Phase-2 order).
- **D2** In No-Power Preparation, show the Print/Export Center as home even if the student has hidden Reference (my recommendation), since profiles are administrator-set?
- **D3** Ear training: its own mastery criteria (my recommendation: accuracy and response-time thresholds per exercise type, reviewed by you) and whether it awards XP once Phase 2 XP exists.
- **D4** Ear Training Studio placement: a page under Practice (my recommendation, no new sidebar item) or its own Learning Studio sidebar item?
- **D5** Field binder: allow the administrator to read a student's songs (read-only, audited) for the binder, plus a student "My Field Binder" button?
- **D6** Move the architecture documents to a separate documentation PR?
- **D7** When convenient, authorise the two technology spikes (notation renderer and synthesizer) as throwaway code, never merged.

## 8. Recommendation for the next development stage

After the currently authorised work (Phase 1 hardware verification, fixes and merging PRs #1 to #4 in order):

1. **Start Phase 2 learning core** as already approved, with workspace navigation Stages A and B alongside. This makes Learn, Practice and Progress real, which the binder, lesson worksheets, ear training and tours all depend on.
2. **In parallel, without visible change, X0's two smallest and most reused foundations:** the Instrument & Tuning Manager and the chord catalog pipeline (loading the 75 shapes once you've reviewed the 18 flagged ones). Every later feature builds on these two, and they carry little risk.
3. **First visible expansion: X1** (Visual Chord Library, Chord Finder, basic Print Studio with Save to PDF, Offline Field Library and Low-Power Field). It serves learners immediately and gives the grid-down design its first practical value: chord charts, fretboard maps and blank sheets on paper or PDF, and a battery-friendly field mode on a tablet.

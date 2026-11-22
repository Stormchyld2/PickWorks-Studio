# Creative workstation: master expansion architecture

Architecture and roadmap planning only (Jason's Master Expansion Specification, 2026-11-22). **Overall direction approved by Jason on 2026-11-22, with the refinements folded in below. Implementation is not authorised**, and no spikes, dependency installs or code changes happen without his explicit go-ahead. The consolidated feature inventory, feature cards and roadmap are in [master-roadmap.md](master-roadmap.md). Nothing in this document changes existing code, Phase 1 work, branding, accounts or workspace navigation.

Related documents: [operating-profiles.md](operating-profiles.md) (Full Studio, Low-Power Field, No-Power Preparation), [chord-system.md](chord-system.md) (chord catalog, Visual Chord Library, Voicing and Alternate Chord Explorers, Reverse Chord Finder), [notation-rendering.md](notation-rendering.md) (diagram rendering), [guided-tours.md](guided-tours.md), [feature-roadmap.md](feature-roadmap.md), and the Workspace Navigation Implementation Plan.

## 1. Scope

PickWorks becomes a complete offline environment to learn, write, arrange, practise, play back, perform, print and preserve music, on battery-powered Windows laptops first and Android phones and tablets later. It is **not** a DAW. Outside the initial scope: professional multitrack production, VST hosting, mixing consoles, mastering, cloud production, online collaboration, subscription sound libraries, and automatic transcription of polyphonic recordings.

Placement follows the approved workspaces:

- **Learning Studio:** lessons, practice, mastery, progress, Ear Training Studio, Fretboard Explorer (including the Visual Chord Library and "What Chord Am I Playing?").
- **Play & Create:** Songwriting Studio, Rhythm & Strumming Studio, Melody & Harmony Assistant, Song Arrangement Board, Chord Progression Workshop, TAB Editor, Standard Notation Editor, combined TAB + notation, MIDI playback, Riff Recorder and Idea Vault, Personal Songbook, Performance Mode, Backing Tracks, Music Theory Tools, Music Library.
- **Reference:** Print Studio (Printable Resources) and the Offline Field Library, maintenance, tuning and field skills, offline reference, low-power tools.

Each tool lives in one place; other workspaces link to it rather than copying it. Administrators control workspace access, students control visibility, and Play & Create stays hidden until its first substantial feature works.

## 2. Codebase audit: what already exists

| Engine (spec name) | What exists today | Reuse | Must add |
| --- | --- | --- | --- |
| Music theory | `engines/music-theory`: notes and spelling (letter-correct), intervals, 16 chord qualities, 13 scales, scale spelling, tuning model | All of it | Keys and key signatures, diatonic harmony, Roman numerals and Nashville numbers, circle of fifths, transposition of spelled pitches, capo maths |
| Fretboard | `engines/fretboard`: `midiAt`, positions of a pitch or pitch class, octaves, scale positions; any tuning, up to 24 frets | All of it | Instrument definitions (string count, range, MIDI program); playable string/fret suggestions for a pitch, used by the TAB and notation editors |
| Chord | `engines/chords`: shape schema, analysis, validation, diagram layout, 27 shapes | All of it | Everything in chord-system.md (catalog, transposition, identification, related chords) |
| Notation | Nothing yet | Diagram renderer patterns only | Composition model, layout, rendering, editing, MusicXML |
| MIDI | `performance/types.ts` already defines `midi-note` observations; nothing plays MIDI | The observation types | Event conversion, scheduler, synthesizer, import and export |
| Audio | `services/audio/audio-engine.ts`: one shared AudioContext, device selection, input handling; `engines/audio/transport.ts`: shared tempo, bars, beats and loop region, already designed for backing tracks and TAB playback; metronome as a transport consumer; tuner and pitch detection | The shared context, the transport, the metronome, device selection and mic input | Recording to file, playback of local audio files, trimming, pitch-preserving speed change, waveform display |
| Song project | Nothing yet | The Rust storage core: per-student folders, ownership checks, `atomic_write`, versioned records with migration, SHA-256 backups and restore | Song Project format, project storage commands, media folders, revisions, export and import |
| Print | `engines/print/worksheet.ts`: black-and-white SVG pages, paper sizes, layouts; `services/platform.ts` print adapter | Page layout and print path | Lead sheets, TAB and notation pages, chord diagram sheets, PDF export (Print Studio still needs authorisation) |
| UI shell | Workspaces plan, glow cards, responsive breakpoints, touch targets, guided-tour architecture | All of it | The new screens (section 8) |

Two existing design choices make this expansion cheaper than it looks. First, the shared transport was built so that backing tracks, loops and TAB playback would use one clock. Second, the audio engine already keeps MIDI separate from audio. Both match the spec.

## 3. Technology recommendations

All candidates must work offline, ship inside the installer, and run on Windows WebView2 now and Android WebView later. Licence details below are from my knowledge and **must be re-checked against each project's current licence file before adoption.**

### Notation rendering

| Option | Licence | Fit | Concerns |
| --- | --- | --- | --- |
| **VexFlow** (TypeScript, SVG) | MIT | Draws standard staves and TAB staves together, with bends, slides, vibrato and articulations. We keep our own composition model and draw it, which suits an editor. | We write the measure layout and line breaking ourselves |
| alphaTab (TypeScript, SVG and canvas) | MPL-2.0 | Guitar-focused: TAB plus notation, techniques, built-in SoundFont playback and a synced cursor | Has its own score model; we'd convert into it every render, and editing support is limited |
| OpenSheetMusicDisplay | BSD-3 | Good MusicXML display on top of VexFlow | A viewer, not an editor |
| Verovio (C++/WebAssembly) | LGPL-3.0 | Very good engraving from MusicXML and MEI | Large, LGPL obligations, viewer-oriented |
| LilyPond | GPL | Print-quality engraving | External program, heavy, not interactive |

**Recommendation:** our own composition model as the single source of truth, drawn with **VexFlow** for on-screen editing and printing. Before deciding, run a short throwaway spike comparing VexFlow and alphaTab on: editing speed with 100 measures, guitar technique coverage, print quality, and Android WebView performance.

### MIDI synthesis

| Option | Licence | Fit | Concerns |
| --- | --- | --- | --- |
| **WebAudio SoundFont synth** (for example SpessaSynth, or our own small sampler) | Apache-2.0 (SpessaSynth) | Runs in the same AudioContext and transport as the metronome and recorder, so one clock and one output device. Identical on Windows and Android WebView. No native build. | CPU use on low-end devices needs measuring; load instruments on demand |
| rustysynth (Rust) | MIT | Pure Rust SoundFont synth, no C dependency, builds for Android | Audio must be bridged from Rust into the webview or a native output, which means a second clock to keep in sync |
| FluidSynth (C) | LGPL-2.1 | Mature, full General MIDI | LGPL means shipping it as a separately replaceable library; Android build is complex; a second audio path |

**Recommendation:** a **WebAudio SoundFont synthesizer** on the shared audio engine and transport, with rustysynth as the fallback if CPU measurements on battery-powered hardware are poor. FluidSynth is evaluated as the spec asks, but I don't recommend it because of the licence obligations and the Android build.

### Instrument sounds

Bundle one compressed SoundFont subset with only the needed instruments: steel and nylon acoustic, clean electric, electric bass, piano, and a basic drum kit for count-ins and backing. Candidates under permissive licences include MuseScore General (MIT) and FluidR3 GM (MIT); the exact licence and attribution text must be verified and listed in About. Target an install size increase of about 30 to 60 MB, loaded only when playback starts.

### Recording and audio files

- Capture through the shared audio engine with an AudioWorklet, saved by Rust as WAV (lossless, simple, no codec licence). Export as WAV, and optionally FLAC or Ogg Vorbis (royalty-free) later.
- Pitch-preserving speed change: the WebView's built-in `preservesPitch` playback for imported files first; a dedicated time-stretch library only if quality is poor.
- MP3 import uses the WebView's built-in decoder; no encoder is bundled.

### Interchange and print

- **MusicXML** (open format) as the main notation interchange, with our own TypeScript converter and a published list of supported and unsupported elements.
- **MIDI** files (Standard MIDI File types 0 and 1) for import and export.
- **PDF** through the WebView's print-to-PDF via the existing platform print adapter, using the same SVG renderers.

## 4. Shared data models

### Song Project and composition model

Designed in detail in **[composition-model.md](composition-model.md)**, which is the most important design in this expansion. In short:

- A song is a folder owned by the student (`project.json`, `media/`, `revisions/`, `autosave.json`), written atomically, versioned with migrations, with relative paths and checksummed export.
- Every musical fact has one home. The **arrangement** holds the form; each **section** holds its own conductor (bars, meter, tempo, key), **harmony track** (chord events), **lyrics** (with chord anchors that point at harmony events) and **part clips** (TAB and notation events where pitch is authoritative and string and fret are a validated choice).
- Chord progressions, chords over lyrics, TAB, notation, MIDI playback and the Arrangement Board are all views or editors of that one model, through one shared operation engine with one undo history.
- Roman numerals, Nashville numbers, capo shapes, MIDI and the playback timeline are calculated, never stored.

### Instrument & Tuning Manager (shared system)

Formalised at Jason's request so no tool keeps its own idea of strings, tunings or capo. It is an architectural foundation, not a curriculum expansion: lessons stay guitar-only.

- **One engine:** `engines/instruments/`, built on the existing `Tuning` model and `fretboard.ts` mapping.
- **Instrument definition:** `{ id, name, strings: [{ number, openMidi, label }], fretCount, range, clef, transposition, midiProgram }`. Six-string guitar first; bass, seven-string, ukulele and mandolin are data later.
- **One tuning list** shared by Fretboard Explorer, the Tuner, the chord engine, the TAB and notation editors and the composition tools. The seven presets already defined for the tuner (Standard, Drop D, Half-Step Down, Open G, Whole-Step Down, Open D, DADGAD) move here unchanged; the tuner's picker behaves as today.
- **Capo:** a capo raises every open string; tools show either the shape (as fingered) or the sounding pitch, and the conversion is one function.
- **Position mapping:** for any pitch, every playable string and fret within the instrument's range, ordered by how comfortable it is, used for staff-to-TAB suggestions and the Melody & Harmony Assistant.
- **Tests:** every tool reads the same list; capo 0 to 12 and every preset give correct notes; test definitions for a 4-string bass and a 7-string guitar work in the fretboard and chord engines with no code change.

### Ownership and recovery (confirmed by Jason)

Songs, compositions and recordings belong to the student who made them. Sharing is by explicit export and import; an administrator-managed shared library may come later. Recordings are included in backups by default, with an option to leave them out. Atomic saves, autosave, crash recovery, revisions and migration safety apply, unsaved work is never discarded by a profile change, and every song file is identical across all operating profiles.

## 5. Chord Progression Generator and Workshop

Expands spec section 12 (Jason's addendum, 2026-11-22). Lives in Play & Create; the same engine can later power "make a progression to practise" exercises in Learning Studio.

### Modes

- **Quick Generate:** pick key (or "surprise me"), style, length, complexity; press Generate; see chord cards with diagrams, Roman numerals and Nashville numbers; press Play. Lock the chords you like and press **Regenerate** for a new direction on the rest.
- **Advanced Workshop:** everything above plus mood and harmonic-character controls, harmonic rhythm (chords per bar, splits), cadence choice, extensions and substitutions, voicing choice, strumming and rhythm patterns, compare saved progressions.

### How generation works (no randomness without rules, no cloud AI)

1. **Data, not code.** Versioned local data files hold the rules, so styles can be added without changing the generator:
   - `progression-templates.json`: phrase shapes as chord-function sequences (tonic, predominant, dominant), cadence points, and special forms such as the 12-bar blues.
   - `styles/*.json` (rock, blues, country, folk, pop, worship, jazz): allowed scale degrees and borrowed chords per complexity level, transition weights between functions, preferred cadences, typical harmonic rhythm, extension rules (for example jazz uses 7ths and ii-V-I; worship favours I, V, vi, IV with sus and add9 colours), and strumming patterns.
   - `moods.json`: maps controls such as brighter/darker, calm/tense and resolved/open onto weights (for example darker favours minor and borrowed chords; tense favours dominants and extensions).
2. **Function first, then chords.** For each bar the generator chooses a harmonic function from the template and style weights, then a chord that fills that function in the key, then (by complexity) a colour: triads for beginner, 7ths and sus for intermediate, extensions and substitutions for advanced.
3. **Cadences and phrases.** Phrase ends (bars 4, 8, 12, 16) get cadences from the style's preferences, so results sound finished rather than random.
4. **Constraints from locked chords.** Locked chords are fixed. Each open slot is chosen so the transition from the chord before and into the chord after is allowed by the style; if no full solution exists, the generator tells the user which locked chord makes it hard instead of breaking the lock.
5. **Deterministic.** Uses the existing seeded random number generator (`engines/practice/rng.ts`). A saved result records `{ seed, key, style, mood, complexity, length, rules data version }`, so the same settings give the same progression. If the rules data has changed since, the app says so and still keeps the saved chords exactly.
6. **Never silently replaced.** Any chord the user edits by hand becomes locked automatically. Regenerate only changes unlocked, generated chords; undo restores the previous result.

All chords use the shared theory engine (spelling, Roman and Nashville numbers), the chord catalog (voicings and diagrams through the shared renderer), and the Alternate Chord Explorer's rules for suggestions. Playback uses the shared MIDI engine and transport (tempo, loop, metronome, count-in). Saved progressions are stored as `progressions[]` in a song or in the student's progression library (same format), with name, tags and favourite. "Send to song" places them as harmony events in Songwriting Studio and the Arrangement Board with lock state kept (see composition-model.md).

### Delivery order inside the generator

| Step | Contents |
| --- | --- |
| G1 (first) | Major and minor keys; rock, pop, folk and blues styles; beginner and intermediate complexity; 4, 8, 12 (blues) and 16 bars; chord names, Roman and Nashville numbers; diagrams; **Lock Chord + Regenerate** (prioritised by Jason); manual replace and drag reorder; undo and redo; transposition and capo; save, name, tag, favourite; Send to Song |
| G2 | Playback through the MIDI engine (block chords, then simple strums), tempo, loop, metronome sync, count-in |
| G3 | Country, worship and jazz styles; advanced complexity; mood controls; suggestions for voicings, extensions, sus chords and substitutions; harmonic rhythm controls; strumming and rhythm patterns; compare; print and export |
| G4 | Modal harmony (Dorian, Mixolydian and others) through the same data files; multi-part accompaniment playback |

G1 needs only the theory engine and chord catalog, so it can arrive before MIDI playback.

### Acceptance criteria and tests

- **Key correctness:** in all 24 major and minor keys, every generated chord is diatonic or a borrowed or secondary chord allowed by the chosen style and complexity; spelling is correct; Roman and Nashville numbers match.
- **Length:** 4, 8, 12 and 16 bars always produce exactly that many bars; 12-bar blues follows the blues form.
- **Cadences:** each phrase ends on a cadence allowed by the style (tested over 10,000 seeded generations per style).
- **Locking:** across 10,000 seeded regenerations with random locks, locked and hand-edited chords never change; impossible lock combinations give a clear message and change nothing.
- **Determinism:** the same configuration and seed give an identical progression on Windows and Android builds.
- **Transposition and capo:** transposing through all keys and back restores the original; capo display shows correct shapes.
- **Playback (G2):** chords sound on the transport's beats within 5 ms at 60, 120 and 200 BPM; loops repeat seamlessly.
- **Persistence:** save, close and reload keeps chords, locks, settings and seed; tags and favourites filter correctly.
- **Songwriting integration:** Send to Song creates harmony events with no re-typing; the same chords appear in the Arrangement Board, Performance Mode and playback; undo in the song removes them cleanly.
- **Data-driven styles:** adding a test style file changes results without any code change.

## 6. Rhythm & Strumming Studio

**Purpose:** learn, create and practise strumming and fingerpicking patterns, and attach them to songs and progressions.

- **Pattern editor:** a grid of steps per beat (subdivisions: quarters, eighths, triplets, sixteenths; time signatures 2/4, 3/4, 4/4, 6/8, 12/8 first). Each step is a downstroke, upstroke, muted stroke (chuck), rest or held; any stroke can be accented. Fingerpicking and arpeggio patterns choose strings per step (thumb on the bass string of the current chord, fingers on the treble strings), so the same pattern works for any chord.
- **Presets as data:** `rhythm-patterns.json`, versioned, grouped by style (rock, pop, folk, blues first, matching the generator) and level. Students save their own patterns to their own folder.
- **Playback:** uses the **existing shared transport and metronome**, never a second timing system. With audio: strums sound through the MIDI engine, with a moving highlight on the current step. In Low-Power Field without audio: the same transport runs from a silent timer clock and the highlight steps visually (gap G5 in master-roadmap.md). Tempo and looping come from the transport.
- **Integration:** the Progression Workshop and Songwriting Studio can attach a pattern to a progression or section (stored as a pattern reference on the section in the composition model); chords-over-lyrics views can show strum arrows; Performance Mode can show the pattern; the practice drills engine gets "strum along" drills that record practice like other drills.
- **Printing:** rhythm and strumming charts (arrows, counts, accents) in black and white.
- **Acceptance:** every preset fills its bar exactly in its time signature; playback steps land on the transport's beat times within 5 ms; visual-only mode stays in time without audio; a saved custom pattern survives reload and can be attached to a song section and printed; fingerpicking follows the chord's actual bass string after a chord change.

## 7. Melody & Harmony Assistant

**Purpose:** help musicians write melodies over a progression without making the creative choices for them.

- A panel inside the TAB and notation editors and the Progression Workshop (one component, not a separate app).
- For the chord under the cursor and the song's key, it shows on the interactive fretboard: compatible scale tones, chord tones (root highlighted), suggested target notes on strong beats, and basic arpeggio shapes near the current position.
- Selecting or entering a melody note shows its interval against the current chord ("the 3rd of Am", "a passing tone, resolves to C").
- Suggestions (approach notes, passing tones, resolutions) are highlights the user may click; nothing is written until the user places a note. There is no "write a melody for me" button.
- Notes go straight into a melody clip in the composition model, so they appear in TAB and notation and play through the MIDI engine (audition only when audio is enabled). Transposing the song moves the melody with it.
- Uses the existing `scalePositions`, `chordToneLabel`, interval engine, Instrument & Tuning Manager and harmony track.
- **Acceptance:** chord tones and scale tones shown are correct for every chord quality in all 12 keys; interval labels are correct against the chord at that beat; placing a suggested note writes exactly that note and nothing else; a transposed song keeps melody-to-chord relationships.

## 8. Ear Training Studio (Learning Studio)

Part of Learning Studio, not Play & Create, because it is structured learning.

- **Exercise types:** interval recognition; major vs minor chords; chord quality (7ths, sus, dim, aug); scale and melodic pattern recognition; chord progression recognition (I–IV–V, I–V–vi–IV and others, using the theory engine); rhythm recognition and tap-back repetition.
- **Structure:** short missions (2 to 5 minutes), beginner-to-advanced levels, immediate feedback with the correct answer played again, optional adaptive difficulty (raises or lowers the level from recent accuracy).
- **Engines:** the existing lessons and practice engines run the missions; attempts are recorded with their own skill names (for example `ear:interval:M3`) so they never change fretboard, note or course mastery, XP or progress. Intervals and simple triads can sound through the existing reference-tone synthesis; chord qualities, progressions and melodies use the MIDI engine once it exists.
- **Progress:** its own section in My Progress; mastery criteria for ear training are a decision for Jason (master-roadmap.md D3).
- **Profiles:** Low-Power Field initialises audio only when the student starts an exercise; not featured in No-Power Preparation.
- **Acceptance:** each exercise type plays exactly the intended notes (checked against the theory engine); answers and feedback are immediate; adaptive difficulty never jumps more than one level at a time; ear-training activity leaves existing course, XP, mastery and progress records byte-for-byte unchanged.

## 9. Print Studio and Offline Field Library (moved earlier)

Print Studio is essential to the grid-down design, so it now arrives with the early chord-reference and songwriting work (master-roadmap.md stages X1 and X2) instead of at the end.

- **First templates (X1):** chord reference sheets, fretboard maps, scale charts, blank TAB, blank staff paper, blank chord boxes, songwriting worksheets. **Then (X2):** personal songbook and lead sheets, lesson worksheets (once Phase 2 lessons exist), and the Prepare for Grid-Down binder.
- Compact, black-and-white, ink-efficient layouts (thin lines, no filled backgrounds, several charts per page), with paper sizes from the existing worksheet engine.
- **Save to PDF is the default and needs no printer**, in every profile; printing is optional. A screen-reading PDF layout is available for phones and tablets.
- All templates are drawn by the shared renderers; no template appears until its renderer, export path and tests are complete.
- The Offline Field Library is the home of No-Power Preparation and sits in the Reference workspace with Printable Resources.

## 10. Dependencies and conflicts

**Dependencies**

1. Phase 1 acceptance and PR merges come before any of this.
2. Workspace navigation Stage B (selector, admin access) must exist before any Play & Create feature can be shown.
3. The chord catalog (chord-system Stage 1) comes before structured chord symbols with preferred voicings, the Progression Workshop and Compare Chords.
4. Theory additions (keys, Roman numerals, transposition) come before songwriting transposition and the Progression Workshop.
5. Song Project storage (Rust commands, ownership, migration, backup inclusion) comes before any songwriting screen.
6. The composition model comes before the TAB editor, notation editor and MIDI playback. The synth spike result is needed before the playback design is final.
7. Print Studio authorisation is needed for lead sheets, chord sheets, TAB and notation printing.
8. The content sourcing and review process (already approved) applies before any bundled songs or public-domain material.

**Conflicts to resolve**

1. **Roadmap order.** The previously approved post-Phase-2 order puts Printable Resources first and Songwriting Studio last. This spec puts songwriting in Stage 3, ahead of recording and the songbook. Section 7 proposes a merged order for your approval.
2. **Phase 2 learning core.** Courses, missions, mastery reviews and XP are Phase 2's main purpose. The creative stages should not delay them unless you decide otherwise.
3. **Microphone sharing.** The tuner and Riff Recorder use the same input; only one can hold it at a time, through the shared audio engine.
4. **Backup size.** Recordings can make backups large. Backups need an option to include or leave out recordings.
5. **Per-student ownership.** Songs belong to a student. Sharing between students is by export and import, not a shared library, unless you want an installation-wide library.
6. **Android.** Import and export must use Android's file picker and app-private storage through the platform adapter; the synth and recorder must be measured on a mid-range tablet before Android work is committed.

## 11. Dependency-aware roadmap

Superseded by the consolidated roadmap in [master-roadmap.md](master-roadmap.md) section 3 (Phase 1, Phase 2, then stages X0 to X7), which moves Print Studio and the Offline Field Library to X1 and X2 and puts creative tools that need no audio ahead of the synthesizer.

## 12. Highest value first

See master-roadmap.md section 8. In short: Phase 2 learning core first, then the Instrument & Tuning Manager and chord catalog as foundations, then the Visual Chord Library, Chord Finder, basic Print Studio and Low-Power Field.

## 13. UI mockup specifications

All screens keep the white logo, dark navy theme, glow cards, blue accents and amber highlights, and the approved sidebar and workspace selector. Wide layout is 840 px and up (Windows is always wide); phones get single-column versions noted per screen. Advanced controls sit behind "More" or a side panel.

1. **Play & Create dashboard.** "Continue" card (last song), "New Idea" button, recent songs, Idea Vault shortcut, setlists. Empty states only, no sample data.
2. **Songwriting Studio, Writing View.** Top bar: song title, key, tempo, time signature, capo, tuning, view switch (Writing, Chords and Lyrics, Arrangement, Performance, Lead Sheet), undo and redo, save state ("Saved", "Saving…", "Recovered draft"). Left: section list (add, duplicate, reorder). Centre: lyric lines with chord chips above words; click a word to add a chord through a search popover that uses the chord catalog. Right panel (collapsible): chord palette for the song's key, diagrams of chords used, notes. Phone: section list becomes a drawer; the right panel becomes a bottom sheet.
3. **Song Arrangement Board.** A horizontal row of section cards (Intro, Verse, Chorus…) with colour-free labels and icons, drag to reorder, duplicate, remove from arrangement (content kept), repeat count. "Generate performance sheet" button. Phone: vertical list.
4. **Chord Progression Generator and Workshop.** Quick Generate strip at the top: key, style, length, complexity, a large Generate button. Centre: one card per bar with the chord name, a small diagram, Roman and Nashville numbers (toggle), and two buttons on each card, **Lock** and **Replace**; a **Regenerate** button that changes only unlocked chords. Drag cards to reorder. "Advanced" opens a side panel: mood and harmonic character, harmonic rhythm, cadence, extensions and substitutions, voicings, strumming pattern, circle of fifths. Bottom: the shared transport bar. Actions: Save, Send to Song, Print or Export. Phone: cards stack two per row, Advanced becomes a bottom sheet.
5. **TAB and Notation Editor.** Toolbar: durations, dots, tuplets, rests, techniques, view switch (TAB, Notation, Both). Score area with selected-note cursor. A collapsible interactive fretboard under the score for entry. Position-choice popover when a pitch has several positions. Transport bar with a playhead that follows playback. Phone: view only plus simple entry in the first release; full editing on tablet and desktop.
6. **Transport bar (shared).** Play, pause, stop, rewind, seek bar with measure numbers, tempo, count-in, loop start and end, metronome toggle, and per-part mute and solo in a "Parts" popover. The same component everywhere playback exists.
7. **Performance Mode.** Full screen, large lyrics with chords above, text size buttons, high-contrast toggle, auto-scroll speed, previous and next section, previous and next song in a setlist, and an exit button. No other controls visible.
8. **Personal Songbook.** Search bar, filters (tags, key, favourites, source), song cards, setlists tab, import and export buttons.
9. **Idea Vault and Riff Recorder.** A large record button with input level meter, list of takes with waveform, play, loop selection, speed, trim, rename, notes, and "Attach to song or section".
10. **Rhythm & Strumming Studio.** Pattern grid in the centre (one column per step, rows for stroke type, an accent toggle), counts underneath ("1 & 2 &"), preset list on the left grouped by style and level, transport bar at the bottom, "Attach to song" and "Print chart" buttons. Phone: the grid scrolls horizontally one bar at a time.
11. **Melody & Harmony Assistant panel.** A side panel in the editors and Workshop: current chord and key at the top, toggles for scale tones, chord tones, targets and arpeggios, a mini fretboard with highlights, and the interval label for the selected note.
12. **Ear Training Studio.** Mission cards by type and level; an exercise screen with a large Play button, answer buttons (large, touch-friendly), immediate feedback and a progress strip; a results card at the end.

These specifications become interactive mockups (captured from a throwaway prototype, as with the workspace selector) when you ask for them, one screen group per stage.

## 14. Acceptance criteria per stage

Every stage must also pass the standing checks: the existing app still works (all current Rust, TypeScript and click-through tests pass); no lesson, mastery, XP or progress data changes; student and administrator permissions are intact; everything works with networking disabled; unavailable features never appear as working controls; layouts work at 1280 px and at phone width.

- **Stage 1:** Song Project and composition schemas round-trip through save and load without loss for a set of 20 sample projects; a version-1 project migrates forward and an older app refuses a newer file; Rust refuses song access from another student; transposition of all 12 keys spells every chord and note correctly; spikes produce a written comparison with measurements, and their code is discarded.
- **Stage 2:** chord-system.md acceptance criteria for Stages 1 to 4; Compare shows up to four chords with shared notes highlighted.
- **Stage 3:** a song with 6 sections and 40 chords survives save, close and reload unchanged; changing key transposes all chords and no lyric character changes; killing the app mid-edit recovers the last autosave (within 5 seconds of edits); reordering the arrangement keeps all section content; undo and redo work for 100 steps; Performance Mode works with no audio device; songs are included in backups and restore correctly.
- **Stage 4:** the generator acceptance criteria in section 5; Roman numerals and Nashville numbers are correct for every diatonic chord in all major and minor keys; playback of a progression at 60, 120 and 200 BPM stays within 5 ms of the transport's beat times; loops repeat seamlessly for 50 repetitions; idle CPU returns to baseline within 2 seconds of stopping, and the synth is not loaded until first playback.
- **Stage 5:** TAB and notation views show the same events after every edit; every measure's durations are validated; a tuning change never alters pitches and flags unplayable positions; MIDI export then import reproduces pitches, durations and tempo exactly for a test suite of 30 passages; the playback highlight matches the sounding note within one rendering frame.
- **Stage 6:** a 5-minute recording saves as WAV with no dropouts and reopens; trim is non-destructive until "Save trimmed copy"; speed change from 50% to 150% keeps pitch; the tuner and recorder never hold the microphone at the same time; recordings move with the song on export and restore.
- **Stage 7:** MusicXML export then import preserves the supported element list exactly and reports anything unsupported; printed lead sheets, TAB and notation are black and white and match the screen; a whole song folder exports, restores on another installation and opens without broken references.

## 15. Decisions

**Resolved by Jason (2026-11-22):**

1. Roadmap: revised as in master-roadmap.md, with Print Studio moved earlier (confirmation of the full table is master-roadmap.md D1).
2. Notation rendering: VexFlow is the preferred candidate, subject to the documented comparison with alphaTab.
3. Synthesizer: a WebAudio SoundFont synthesizer is preferred, subject to performance testing and licence verification.
4. Sound set: the compact instrument set as proposed; no SoundFont licence is treated as verified until checked against the actual distributable files.
5. Song ownership: student-owned Song Projects; sharing by export and import; a shared administrator library may come later.
6. Recordings in backups: included by default, with an option to exclude them.
7. Spikes: none until Jason authorises them.
8. Generator styles: rock, pop, folk and blues first; country, worship and jazz in the advanced expansion.
9. Teacher tools: out of scope for the first release; no new user role, but nothing in the design prevents one later.

**Still open:** listed in master-roadmap.md section 7 (D1 to D7).

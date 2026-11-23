# Creative workstation: master expansion architecture

Architecture and roadmap planning only (Jason's Master Expansion Specification, 2026-11-22). **Overall direction approved by Jason on 2026-11-22, with the refinements folded in below. Implementation is not authorised**, and no spikes, dependency installs or code changes happen without his explicit go-ahead. The X0–X7 roadmap was **approved by Jason as the working development plan on 2026-11-22**, and this document was updated in the final refinement pass the same day (Print Studio Core and Expanded, ear-training mastery and XP, spike criteria, sound licences, notation accessibility). The consolidated feature inventory, feature cards and roadmap are in [master-roadmap.md](master-roadmap.md), which is the authoritative planning index. Nothing in this document changes existing code, Phase 1 work, branding, accounts or workspace navigation.

Related documents: [composition-model.md](composition-model.md) (the shared Song Project model), [transport-timing.md](transport-timing.md) (one transport, clock sources), [android-platform.md](android-platform.md) (Android interfaces and PDF export), [operating-profiles.md](operating-profiles.md) (Full Studio, Low-Power Field, No-Power Preparation), [chord-system.md](chord-system.md) (chord catalog, Visual Chord Library, Voicing and Alternate Chord Explorers, Reverse Chord Finder), [notation-rendering.md](notation-rendering.md) (diagram rendering), [guided-tours.md](guided-tours.md), [feature-roadmap.md](feature-roadmap.md), and the Workspace Navigation Implementation Plan.

## 1. Scope

PickWorks becomes a complete offline environment to learn, write, arrange, practise, play back, perform, print and preserve music, on battery-powered Windows laptops first and Android phones and tablets later. It is **not** a DAW. Outside the initial scope: professional multitrack production, VST hosting, mixing consoles, mastering, cloud production, online collaboration, subscription sound libraries, and automatic transcription of polyphonic recordings.

Placement follows the approved workspaces:

- **Learning Studio:** lessons, practice, mastery, progress, Ear Training Studio, Fretboard Explorer (including the Visual Chord Library and "What Chord Am I Playing?").
- **Play & Create:** Songwriting Studio, Rhythm & Strumming Studio, Melody & Harmony Assistant, Song Arrangement Board, Chord Progression Workshop, TAB Editor, Standard Notation Editor, combined TAB + notation, MIDI playback, Riff Recorder and Idea Vault, Personal Songbook, Performance Mode, Backing Track Generator and Arrangement Studio ([backing-track-generator.md](backing-track-generator.md)), Music Theory Tools, Music Library.
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
| Print | `engines/print/worksheet.ts`: black-and-white SVG pages, paper sizes, layouts; `services/platform.ts` print adapter | Page layout and print path | Print Studio Core and Expanded templates, and a PDF writer shared by Windows and Android (section 9) |
| UI shell | Workspaces plan, glow cards, responsive breakpoints, touch targets, guided-tour architecture | All of it | The new screens (section 13) |

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

Bundle one compressed SoundFont subset with only the needed instruments: steel and nylon acoustic, clean electric, electric bass, piano, and a basic drum kit for count-ins and backing. Target an install size increase of about 30 to 60 MB, loaded only when playback starts. The Backing Track Generator's realism requirement may need dedicated guitar, bass, drum and piano banks instead (larger; a separate lite set for Android); that is decided by Spike D ([backing-track-generator.md](backing-track-generator.md) section 6). **No sound asset is included until its licence is verified** by the procedure below. The synthesizer's software licence and the instrument samples' licences are separate, and both must be verified.

**Preliminary licence check (2026-11-22, desk research only, not a clearance):**

| Candidate | What was confirmed | Status |
| --- | --- | --- |
| FluidR3 GM / FluidR3Mono | The licence file shipped in MuseScore 3.6.1's source (`share/sound/FluidR3Mono_License.md`) states the MIT licence. Copyright notices for Frank Wen (original FluidR3), Michael Cowgill (mono conversion), S. Christian Collins (later adaptation) and the contributors of individual instruments must be included in any copy or derivative. The original was built "in part from samples found in the public domain" and from the author's own recordings; individual sample provenance is not itemised. | MIT confirmed from one source copy; provenance caveat noted; still to verify against the exact file we would ship |
| MuseScore General | Widely reported as MIT. Its licence file couldn't be read in this review (the hosting site blocked automated access). | **Unverified** |
| GeneralUser GS | Distributed under its author's own licence; the text couldn't be read in this review. | **Unverified** |

**Verification procedure before any sound asset is included:**

1. Obtain the exact file to be shipped from its original author's distribution, record its version and SHA-256, and keep the licence text that came with it in `licenses/sounds/`.
2. Read the licence for redistribution inside a commercial or free application, modification (our compact subset is a derivative), attribution wording and any restrictions on selling or extracting samples.
3. Record sample provenance where the licence or readme gives it; reject a sound set whose redistribution rights are unclear.
4. Carry every required notice into the About screen and the installer's licence file, including for the subset.
5. Jason approves the licence record before the asset is added to the repository.

### Recording and audio files

- Capture through the shared audio engine with an AudioWorklet, saved by Rust as WAV (lossless, simple, no codec licence). Export as WAV, and optionally FLAC or Ogg Vorbis (royalty-free) later.
- Pitch-preserving speed change: the WebView's built-in `preservesPitch` playback for imported files first; a dedicated time-stretch library only if quality is poor.
- MP3 import uses the WebView's built-in decoder; no encoder is bundled.

### Interchange and print

- **MusicXML** (open format) as the main notation interchange, with our own TypeScript converter and a published list of supported and unsupported elements.
- **MIDI** files (Standard MIDI File types 0 and 1) for import and export.
- **PDF** from one PDF writer that converts the shared SVG pages directly into PDF files on Windows and Android, with no print dialog or printer needed (section 9 and android-platform.md section 3). WebView printing is used only for optional printing.

### Spike evaluation criteria (spikes not authorised)

Each spike is throwaway code on a separate branch, never merged, ending in a written report with measurements. Each needs Jason's separate authorisation. Reference hardware: Jason's battery-powered Windows laptop now; a mid-range Android tablet when Android work starts (its numbers are recorded but not required to pass until then).

**Spike A: notation renderer (VexFlow, preferred, against alphaTab).** Test corpus: a 100-measure piece with TAB and standard staff together; bends, slides, hammer-ons, pull-offs, vibrato, palm mutes, harmonics, ties, grace notes; triplets, a septuplet and a nested tuplet; a pickup bar; 1st and 2nd endings; meter and key changes; two lyric lines.

| Criterion | Threshold |
| --- | --- |
| Drawn from our composition model, with our model staying authoritative | Required |
| Initial render of 100 measures | ≤ 300 ms laptop (≤ 800 ms tablet) |
| Re-render after a single-note edit | ≤ 50 ms laptop (≤ 120 ms tablet), measure-level update |
| Memory added for 100 measures | ≤ 60 MB |
| Guitar technique coverage | ≥ 90% of the corpus natively; the rest drawable with custom glyphs |
| Print | Black-and-white SVG that the PDF writer converts with no visible difference |
| Accessibility | Every drawn event can be mapped to our accessible structure (section 16) |
| Offline and size | Works offline; adds ≤ 2 MB compressed to the app |
| Licence | Verified against the version tested |

**Decision rule:** VexFlow is chosen unless it misses two or more thresholds that alphaTab meets.

**Spike B: synthesizer (WebAudio SoundFont synth, preferred, against rustysynth).** Test corpus: a 3-minute, four-part song (guitar, bass, piano, drums) at 120 BPM with up to 32 simultaneous voices, looped for 10 minutes, plus the metronome alone as a baseline.

| Criterion | Threshold |
| --- | --- |
| Beat alignment against the transport (offline render analysis) | ≤ 5 ms at 60, 120 and 200 BPM |
| Audio dropouts during a 10-minute loop, window visible and minimised | 0 |
| Average CPU during playback | ≤ 10% of one core on the laptop on battery (≤ 15% tablet) |
| Sound set load time | ≤ 1.5 s laptop (≤ 3 s tablet) |
| Memory with the sound set loaded | ≤ 150 MB; after unload, back within 20 MB of baseline |
| Idle CPU after stopping | back to baseline within 2 s |
| Battery over 30 minutes of playback | measured against the metronome-only baseline and recorded |
| Clock | One clock with the shared transport (rustysynth must show no drift above 1 ms over 10 minutes) |
| Licence | Synth verified; sound set verified by the procedure above |

**Decision rule:** the WebAudio synth is chosen unless it misses the CPU, dropout or alignment threshold on the laptop and rustysynth meets them.

**Spike C: PDF writer (Rust SVG-to-PDF, preferred, against a TypeScript PDF library).** Test corpus: a 120-page field binder of chord charts, fretboard maps, lead sheets and blank sheets in both paper and screen-reading layouts.

| Criterion | Threshold |
| --- | --- |
| Build time for 120 pages | ≤ 20 s laptop (≤ 60 s tablet) |
| Peak memory | ≤ 300 MB |
| Works with no printer installed and networking blocked | Required |
| Output | Opens in Edge, Adobe Reader and a common Android viewer; fonts embedded; text searchable; black and white only |
| Geometry | Matches the on-screen preview (pixel comparison within a small tolerance) |
| Licence | Verified for every library and the embedded fonts |

**Decision rule:** the Rust writer is chosen if it meets every threshold; otherwise the TypeScript library, if it does.

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
- **Playback:** uses the **existing shared transport and metronome**, never a second timing system. With audio: strums sound through the MIDI engine, with a moving highlight on the current step. In Low-Power Field without audio: the same transport runs from the TimerClock and the highlight steps visually ([transport-timing.md](transport-timing.md)). Tempo and looping come from the transport.
- **Integration:** the Progression Workshop and Songwriting Studio can attach a pattern to a progression or section (a copy in the song's `patterns[]`, referenced by the section's `rhythm`, as defined in composition-model.md section 8; the studio has no data model of its own); chords-over-lyrics views can show strum arrows; Performance Mode can show the pattern; the practice drills engine gets "strum along" drills that record practice like other drills.
- **Printing:** rhythm and strumming charts (arrows, counts, accents) in black and white.
- **Acceptance:** every preset fills its bar exactly in its time signature; playback steps land on the transport's beat times within 5 ms; visual-only mode stays in time without audio; a saved custom pattern survives reload and can be attached to a song section and printed; fingerpicking follows the chord's actual bass string after a chord change.

## 7. Melody & Harmony Assistant

**Purpose:** help musicians write melodies over a progression without making the creative choices for them.

- A panel inside the TAB and notation editors and the Progression Workshop (one component, not a separate app).
- For the chord under the cursor and the song's key, it shows on the interactive fretboard: compatible scale tones, chord tones (root highlighted), suggested target notes on strong beats, and basic arpeggio shapes near the current position.
- Selecting or entering a melody note shows its interval against the current chord ("the 3rd of Am", "a passing tone, resolves to C").
- Suggestions (approach notes, passing tones, resolutions) are highlights the user may click; nothing is written until the user places a note. There is no "write a melody for me" button.
- Notes go straight into a melody clip (an ordinary clip with the melody role) in the composition model, with no separate melody format, so they appear in TAB and notation and play through the MIDI engine (audition only when audio is enabled). Transposing the song moves the melody with it.
- Uses the existing `scalePositions`, `chordToneLabel`, interval engine, Instrument & Tuning Manager and harmony track.
- **Acceptance:** chord tones and scale tones shown are correct for every chord quality in all 12 keys; interval labels are correct against the chord at that beat; placing a suggested note writes exactly that note and nothing else; a transposed song keeps melody-to-chord relationships.

## 8. Ear Training Studio (Learning Studio › Practice)

Part of Learning Studio, not Play & Create, because it is structured learning. It is a page under **Learning Studio › Practice**, not a new top-level workspace and not a new sidebar item (resolved by Jason, 2026-11-22).

- **Exercise types:** interval recognition; major vs minor chords; chord quality (7ths, sus, dim, aug); scale and melodic pattern recognition; chord progression recognition (I–IV–V, I–V–vi–IV and others, using the theory engine); rhythm recognition and tap-back repetition.
- **Engines:** the existing lessons and practice engines run the missions; attempts are recorded with their own skill names (for example `ear:interval:M3:asc`) so they never change fretboard, note or course mastery. Intervals and simple triads sound through the existing reference-tone synthesis (X3); chord qualities, progressions and melodies use the MIDI engine once it exists (X4). Rhythm exercises use the shared transport ([transport-timing.md](transport-timing.md)).

### Missions (short and ADHD-friendly)

- 2 to 5 minutes, 8 to 15 questions, one new item introduced at a time alongside familiar ones.
- 80/20 order: the most useful sounds first (octave and perfect 5th; major vs minor; major and minor 3rds; perfect 4th; then 2nds, 6ths, the tritone and 7ths), each with an immediate musical example ("this is the jump at the start of a familiar kind of melody", played on guitar sounds).
- Immediate feedback: the correct answer is shown and played again; a wrong answer can be compared with the right one side by side.
- Each mission ends with a short results card and one suggested next step. No streak pressure and no penalties for stopping early.

### Ear-training mastery (its own rule; the locked note-mastery rule is not reused or changed)

Mastery is tracked per item (for example "major 3rd, ascending") with its own configuration, `EAR_MASTERY_CONFIG`, kept in data and internally adjustable like the note rule. Initial values, for Jason's review before implementation:

| Exercise type | Window | Accuracy | Response-time expectation | Days |
| --- | --- | --- | --- | --- |
| Intervals, major vs minor | last 12 attempts | ≥ 85% | answer within 5 s of the sound ending | qualifying answers on ≥ 2 days |
| Chord quality | last 12 | ≥ 85% | within 6 s | ≥ 2 days |
| Scales and melodic patterns | last 10 | ≥ 80% | within 8 s | ≥ 2 days |
| Progressions | last 8 | ≥ 80% | no time expectation (judged on accuracy) | ≥ 2 days |
| Rhythm tap-back | last 8 | ≥ 80% of taps within the timing window (±60 ms standard, ±90 ms beginner) | timing accuracy replaces response time | ≥ 2 days |

- Only **first answers** qualify. Replaying the sound before answering is allowed and never penalised; a second try after a wrong answer is good practice but doesn't count as correct.
- Answers given within 0.3 s of the sound starting are treated as guesses and don't qualify.
- Mastery is an event in the existing permanent mastery log under the `ear:` skills, so history is never lost.

**Accessibility accommodations:**

- **Untimed ear training** (an Accessibility setting the student can turn on, and the administrator can set per student): response time is not measured at all, and mastery is judged on accuracy and days only. The resulting mastery is identical, not a lesser badge.
- **Wider rhythm windows** (±120 ms) for students with motor difficulties; tap-back accepts any key, a large on-screen button, a touch anywhere or (later) the microphone.
- Unlimited replays, adjustable volume and choice of instrument sound; every question and answer is available to screen readers and the keyboard; feedback never relies on colour alone.

### Progression and review

- Items are introduced in small sets. The next set opens when 80% of the current set is mastered.
- Mastered items return for review after 2, 7 and 21 days, mixed into missions. An item that falls below 70% across 5 review attempts goes back to "learning" (its earlier mastery event stays in the history) and gets more practice.
- Optional adaptive difficulty adjusts by at most one level at a time from recent accuracy.

### XP and achievements (anti-farming)

Ear training uses the existing Phase 2 XP and achievement system (Planning Update 04, Decision 37: Practice XP, Mastery XP, transaction ledger, anti-farming rules). It does not create its own currency.

- **Practice XP per completed mission, not per answer**, and only when the mission reaches at least 60% accuracy with no more than 20% of answers flagged as guesses.
- **Daily cap** on ear-training Practice XP (initially equal to about six missions). Missions made up only of items already mastered earn a quarter of the normal Practice XP and count toward the cap.
- **Mastery XP once per item and once per set**, the first time each is mastered. Re-mastering after a lapse earns no new Mastery XP.
- Replays, retries after a wrong answer, abandoned missions and the Learn More "Try it" examples earn nothing.
- Achievements are data entries in the existing achievement files (for example "First interval set mastered", "Hears every major and minor triad"), awarded from mastery events, never from repetition counts alone.
- All XP goes through the ledger, so it can be audited and never bypasses a mastery gate.

### Other rules

- **Progress:** its own section in My Progress, under Practice.
- **Profiles:** Low-Power Field initialises audio only when the student starts an exercise; not featured in No-Power Preparation (it needs sound).
- **Acceptance:** each exercise type plays exactly the intended notes (checked against the theory engine); answers and feedback are immediate; adaptive difficulty never jumps more than one level; ear-training activity leaves fretboard, note and course mastery records byte-for-byte unchanged; XP awarded matches the rules above in a seeded simulation of 1,000 missions with guessing, replaying and repeated mastered items (the cap and per-item limits always hold); untimed mode never records response-time failures.

## 9. Print Studio: Core (X1) and Expanded (X2 onward)

Print Studio is essential to the grid-down design, so it arrives with the early chord-reference and songwriting work instead of at the end. It is delivered at two levels (Jason, 2026-11-22).

**Print Studio Core (X1):**

- chord reference sheets;
- fretboard diagrams;
- scale charts;
- blank TAB;
- blank notation (staff) paper;
- blank chord boxes;
- songwriting worksheets;
- Save to PDF;
- black-and-white, ink-efficient layouts.

**Expanded Print Studio (X2 onward):**

- personal songbooks and lead sheets (X2, with Songwriting Studio and the Songbook);
- lesson worksheets (X2, once Phase 2 lesson content exists);
- the Prepare for Grid-Down field binder (X2, [operating-profiles.md](operating-profiles.md));
- TAB and standard notation printing when those editors exist (X5);
- rhythm and strumming charts, progression charts and Melody Assistant target-note charts with their tools (X3).

**Rules for every template:**

- Compact, black-and-white, ink-efficient layouts (thin lines, no filled backgrounds, several charts per page), with paper sizes from the existing worksheet engine and the locked 1, 2, 4 or 6 fretboards per page option.
- All templates are drawn by the shared renderers as SVG pages; no template appears until its renderer, export path and tests are complete.
- **Save to PDF is the default and needs no printer**, in every profile; printing is optional. A screen-reading PDF layout is available for phones and tablets.
- The Offline Field Library is the home of No-Power Preparation and sits in the Reference workspace with Print Studio.

**PDF export architecture (investigated; confirmed by Spike C before implementation):**

- One **PDF writer** converts the shared SVG pages to PDF on both platforms, with fonts embedded, offline and with no printer. The Rust core is the preferred home (an SVG-to-PDF converter), with a TypeScript PDF library as the fallback.
- Windows WebView2 can print to PDF, but **that does not establish Android support**: Android's WebView can't print from JavaScript and saving to PDF through Android's print dialog depends on a print service being present. Neither WebView print path is used to create PDFs. Details: [android-platform.md](android-platform.md) section 3.
- Saving uses the Rust folder picker on Windows and the system document picker or share sheet on Android. Optional printing uses WebView2's print dialog on Windows and Android's print framework with the generated PDF.
- Output is written to a `.partial` file and renamed when complete; free space is checked first.

**Acceptance (Core):** every Core template prints and saves to PDF in black and white with no printer installed and networking blocked; the PDF matches the on-screen preview; 1, 2, 4 and 6 per page work where applicable; every paper size works; left-handed fretboards are mirrored correctly; an interrupted save leaves no complete-looking file. **Acceptance (Expanded):** as Core, plus the songbook, lead sheet and binder tests in operating-profiles.md, and TAB and notation pages that match the editors.

## 10. Dependencies and conflicts

**Dependencies**

1. Phase 1 acceptance and PR merges come before any of this.
2. Workspace navigation Stage B (selector, admin access) must exist before any Play & Create feature can be shown.
3. The chord catalog (chord Stage 1, milestone X0.3) comes before structured chord symbols with preferred voicings, the Progression Workshop and Compare Chords.
4. Theory additions (keys, Roman numerals, transposition) come before songwriting transposition and the Progression Workshop.
5. Song Project storage (Rust commands, ownership, migration, backup inclusion) comes before any songwriting screen.
6. The composition model comes before the TAB editor, notation editor and MIDI playback. The synth spike result is needed before the playback design is final.
7. Print Studio authorisation is needed for lead sheets, chord sheets, TAB and notation printing.
8. The content sourcing and review process (already approved) applies before any bundled songs or public-domain material.

**Conflicts to resolve**

**Conflicts (all resolved 2026-11-22):**

1. **Roadmap order.** Resolved: the X0–X7 roadmap in master-roadmap.md replaces the earlier post-Phase-2 order.
2. **Phase 2 learning core.** Resolved: Phase 2 priorities are protected; parallel foundation work must never delay them.
3. **Microphone sharing.** The tuner and Riff Recorder use the same input; only one can hold it at a time, through the shared audio engine.
4. **Backup size.** Resolved: recordings included by default, with an option to leave them out.
5. **Per-student ownership.** Resolved: songs belong to the student; sharing by export and import; administrator binder access only with the student's authorisation (operating-profiles.md).
6. **Android.** Import and export use the system document picker and app-private storage through the platform adapter; the synth and recorder are measured on a mid-range tablet before Android work is committed ([android-platform.md](android-platform.md)).

## 11. Dependency-aware roadmap

Superseded by the consolidated roadmap in [master-roadmap.md](master-roadmap.md) section 3 (Phase 1, Phase 2, then stages X0 to X7), which moves Print Studio and the Offline Field Library to X1 and X2 and puts creative tools that need no audio ahead of the synthesizer.

## 12. Highest value first

See master-roadmap.md section 9. In short: Phase 2 learning core first, then X0 milestones that never delay it (Instrument & Tuning Manager, theory additions, chord catalog, clock sources), then X1: the Visual Chord Library, Chord Finder, Print Studio Core and Low-Power Field.

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

14. **Backing Track Generator.** Easy mode: style, key and major/minor, tempo, length, instrument tick boxes, a large Generate button, Play, Stop, Regenerate and Save to Song Project, with the chord chart of the result. Advanced side panel (bottom sheet on phones) with one collapsible group open at a time: Harmony, Feel, Arrangement, Instruments (per-instrument lock and regenerate), Mix (volume, pan, mute, solo), Playback (loop, preset). Details: backing-track-generator.md section 3.
15. **Notation editing accessibility.** See section 16 for the keyboard, screen-reader and nonvisual entry design that screens 5 and 11 must follow.

These specifications become interactive mockups (captured from a throwaway prototype, as with the workspace selector) when you ask for them, one screen group per stage.

## 14. Acceptance criteria per stage

Every stage must also pass the standing checks: the existing app still works (all current Rust, TypeScript and click-through tests pass); no lesson, mastery, XP or progress data changes; student and administrator permissions are intact; everything works with networking disabled; unavailable features never appear as working controls; layouts work at 1280 px and at phone width.

Stage names follow master-roadmap.md. (Earlier drafts numbered these "Stage 1 to 7"; the mapping is Stage 1 → X0, Stage 2 → X0 and X1, Stage 3 → X2, Stage 4 → X3 and X4, Stage 5 → X5, Stage 6 → X6, Stage 7 → X7.)

- **X0 (foundations):** Song Project and composition schemas round-trip through save and load without loss for a set of 20 sample projects; a version-1 project migrates forward and an older app refuses a newer file; Rust refuses song access from another student; transposition of all 12 keys spells every chord and note correctly; spikes, if authorised, produce a written report against the thresholds in section 3, and their code is discarded.
- **X0 and X1 (chords):** chord-system.md acceptance criteria for chord Stages 1 to 5; Compare shows up to four chords with shared notes highlighted. **X1 (print):** Print Studio Core acceptance in section 9.
- **X2 (songwriting):** a song with 6 sections and 40 chords survives save, close and reload unchanged; changing key transposes all chords and no lyric character changes; killing the app mid-edit recovers edits made up to 2 seconds before (composition-model.md section 11); reordering the arrangement keeps all section content; undo and redo work for 100 steps; Performance Mode works with no audio device; songs are included in backups and restore correctly; song import and export pass the safety tests in composition-model.md section 17; Expanded Print Studio (songbook, lead sheets, binder) passes its tests.
- **X3 (creative tools without audio):** generator G1 acceptance in section 5; Rhythm Studio (section 6) in visual mode; Melody Assistant guidance (section 7); first ear training (section 8). **X4 (playback):** Roman numerals and Nashville numbers are correct for every diatonic chord in all major and minor keys; playback of a progression at 60, 120 and 200 BPM stays within 5 ms of the transport's beat times; loops repeat seamlessly for 50 repetitions; idle CPU returns to baseline within 2 seconds of stopping, and the synth is not loaded until first playback.
- **X5 (composition):** TAB and notation views show the same events after every edit; every measure's durations are validated; a tuning change never alters pitches and flags unplayable positions; MIDI export then import reproduces pitches, durations and tempo exactly for a test suite of 30 passages; the playback highlight matches the sounding note within one rendering frame; the accessibility requirements in section 16 pass.
- **X6 (recording):** a 5-minute recording saves as WAV with no dropouts and reopens; trim is non-destructive until "Save trimmed copy"; speed change from 50% to 150% keeps pitch; the tuner and recorder never hold the microphone at the same time; recordings move with the song on export and restore; a recording interrupted by a crash is recovered as a playable file; the Backing Track Generator passes backing-track-generator.md section 13 for each of its four first styles.
- **X7 (interchange):** MusicXML export then import preserves the supported element list exactly and reports anything unsupported; printed lead sheets, TAB and notation are black and white and match the screen; a whole song folder exports, restores on another installation and opens without broken references.

## 15. Decisions

**Resolved by Jason (2026-11-22):**

1. Roadmap: revised as in master-roadmap.md, with Print Studio moved earlier.
2. Notation rendering: VexFlow is the preferred candidate, subject to the documented comparison with alphaTab.
3. Synthesizer: a WebAudio SoundFont synthesizer is preferred, subject to performance testing and licence verification.
4. Sound set: the compact instrument set as proposed; no SoundFont licence is treated as verified until checked against the actual distributable files.
5. Song ownership: student-owned Song Projects; sharing by export and import; a shared administrator library may come later.
6. Recordings in backups: included by default, with an option to exclude them.
7. Spikes: none until Jason authorises them.
8. Generator styles: rock, pop, folk and blues first; country, worship and jazz in the advanced expansion.
9. Teacher tools: out of scope for the first release; no new user role, but nothing in the design prevents one later.

10. Roadmap: X0–X7 approved as the working development plan, with X0 split into milestones (master-roadmap.md).
11. Print Studio: Core at X1, Expanded from X2; Android PDF architecture documented before implementation.
12. Ear Training: under Learning Studio › Practice; its own mastery criteria; uses the existing XP system with anti-farming limits.
13. Song import: a separate copy with a new id by default; replacement only by explicit confirmation after validation and backup.
14. Spikes stay unauthorised; evaluation criteria and thresholds are documented in section 3.

**Still open:** see master-roadmap.md section 7.

## 16. Accessibility of TAB and standard notation editing

Required before the X5 editors ship, and designed now so the renderer choice (Spike A) can be checked against it. The drawn score is never the only way to read or edit music.

**Keyboard navigation (Windows, and tablets with keyboards):**

- Left and Right move the cursor by event; Ctrl+Left and Ctrl+Right by bar; Home and End to the start and end of the bar; Ctrl+Home and Ctrl+End to the start and end of the section.
- Up and Down change pitch by a step in notation (Shift for a semitone) or move between strings in TAB; Alt+Up and Alt+Down move between voices and parts.
- Letters A to G enter a pitch, digits choose a duration, `.` adds a dot, `r` a rest, `t` a tie, Ctrl+3 a triplet; in TAB, typing a fret number on the current string enters a note.
- Every command is also in menus and a searchable command palette, so no action depends on remembering a shortcut, and shortcuts can be listed from Help.
- Focus is always visible, never trapped, and returns to the score after dialogs.

**Screen-reader descriptions:**

- The SVG score is hidden from assistive technology; a parallel accessible structure (sections, bars, voices, events) is what screen readers navigate.
- Moving the cursor announces the event in words: "Bar 3, beat 2, quarter note, G4, string 3 open, tied to next". Chords are read low to high; techniques and dynamics are read after the note.
- On request: a bar summary ("Bar 3: 4 of 4 beats, chord G, lyric 'home'"), a section summary, and warnings for incomplete or overfull bars, broken links and preserved imported items.
- Changes made by the student are confirmed through a polite live region; nothing is announced only by sound or colour.

**Nonvisual note-entry alternatives:**

- **Text entry:** a line editor accepting compact notation such as `G4 q, A4 8, B4 8 | C5 h` or TAB entry such as `s3f0 q, s3f2 8`, validated with clear spoken errors.
- **Fretboard entry by keyboard** using the fretboard's existing roving focus.
- **Audio confirmation:** when audio is allowed, the entered note or the current bar can be played back on a key press.
- **Chords-over-lyrics and the Chord Finder** remain fully usable without the score, so song writing never requires reading notation.
- Later: MIDI keyboard or MIDI guitar step entry, through the existing MIDI input seam.

**Visual accessibility:** zoom to 400% with bars reflowing onto new lines, the high-contrast theme, text-size settings applied to labels and lyrics, no colour-only meaning (incomplete bars also get a text marker), and reduced motion for the playhead.

**Tests:** keyboard-only creation of a 16-bar passage with chords, ties, a triplet and lyrics; screen-reader announcements checked against expected text for every event type; text entry round-trips to the same events as visual entry; zoom and high-contrast layouts have no clipping; automated accessibility checks on the editor screens.

# Chord system: catalog, Visual Chord Library, Voicing Explorer, Alternate Chord Explorer, Reverse Chord Finder

Architecture, updated 2026-11-22. First written as Phase 2 architecture; now scheduled in [master-roadmap.md](master-roadmap.md) as **X0.3** (Stage 1, the catalog pipeline) and **X1** (Stages 2 to 5). Phase 2 itself is the learning core and workspace navigation, which use the existing 27 shapes. **Documented only.** No code is written until Jason explicitly authorises it. Diagrams follow [notation-rendering.md](notation-rendering.md). The first catalog is the 75-shape manifest; its 18 flagged shapes still need Jason's review before final approval.

## Principles

- **One chord engine.** Note calculation, chord formulas, spelling and validation live in `engines/music-theory` and `engines/chords`. The Chord Library, Voicing Explorer, Alternate Chord Explorer, Reverse Chord Finder, lessons, practice and printables all call the same functions. There are no duplicated chord definitions, no second renderer and no hard-coded search results.
- **Data, not images or code.** Shapes are authored in CSV, validated, and turned into a bundled JSON catalog. Adding or correcting a shape, or adding a chord pack, never touches rendering or UI code. There is no limit on catalog size.
- **Theory is not limited by the catalog.** The catalog holds curated, playable shapes. Identifying a chord (Reverse Chord Finder) and listing related chords (Alternate Chord Explorer) work from chord formulas, so they work for fingerings the catalog doesn't contain.
- **Machine checks and human approval stay separate.** Automated validation runs on every import. Human playability review is a separate record that only a person can set.
- **Simple first, depth on request.** Search box and visual cards first, beginner shapes first, advanced detail behind "More" sections. Nothing is gated behind lessons (Fretboard Explorer stays a free tool).
- **Local-first.** Everything ships inside the app and works offline. JSON only, no SQLite, no network.

## Where it lives in the app

Everything sits inside **Fretboard Explorer** (Learning Studio). No new sidebar item.

| Fretboard Explorer tab | Contents |
| --- | --- |
| Notes | Unchanged |
| **Chords** (becomes the Visual Chord Library) | Search and catalog, chord detail view, Voicing Explorer, Alternate Chord Explorer panel |
| Scales | Unchanged (gains scale box diagrams per the notation plan) |
| Intervals | Unchanged |
| **Chord Finder** (new) | The Reverse Chord Finder. It opens with the large prompt "What chord am I playing?", and the Chords tab and the dashboard can link straight to it with that same wording |

This matches the workspace navigation plan (Fretboard Explorer stays in Learning Studio). If Play & Create's Music Theory Tools later need chords, they link to these same views rather than copying them.

## What exists today and what is new

| Area | Reuse as is | Extend | New |
| --- | --- | --- | --- |
| Theory | Notes, spelling (`spellAbove`), intervals, `CHORD_QUALITIES`, `chordToneLabel`, tuning model, `midiAt` | Qualities: add maj9, m9, 11, 13, 7#9, 7b9, 6/9, m(maj7), 7sus4, and slash bass. Add aliases, an omittable flag per tone (for example the 5th), and a family per quality | `identifyChord()` (reverse identification) and `relatedChords()` (alternates) |
| Shapes | Schema, `analyzeShape`, `validateShape` | Metadata (level, family, voicing type, difficulty, movable range, root string, uses, aliases, bass) and `transposeShape()` | CSV importer, JSON catalog, review records, chord-pack loader |
| Diagrams | `chordDiagram` layout and `ChordDiagram.svelte` (SVG, screen and print, left-handed, concealed answers) | Label modes: fingers, **fret numbers** (new), notes, intervals, none; open-string labels; spoken descriptions | Diagram cards and a large detail diagram, both using the same component |
| Fretboard | `Fretboard.svelte` (interactive, highlights, left-handed, keyboard) | Per-string open and mute toggles and a one-position-per-string input mode for the Chord Finder | None |
| Search | None | None | In-memory search index built from the catalog and quality aliases |

## Stage 1: Expandable chord catalog and validation

**Authoring format.** One CSV file per pack in `content/chords/` (for example `core.csv` holding the 75 shapes). Columns:

`id, name, root, quality, bass, tuning, instrument, frets, fingers, barres, level, family, voicing_type, difficulty, movable, root_string, min_root_fret, max_root_fret, uses, aliases, notes`

- `frets` and `fingers` are written low string to high, for example `x 3 2 0 1 0`. `barres` is `fret:from-to:finger`, separated by `;`.
- `voicing_type` is one of: open, full-barre, partial-barre, caged, power, triad, inversion, drop-2, shell, slash, other.
- `tuning` and `instrument` refer to tuning and instrument definitions; standard-tuning guitar is the only one at first.

**Import.** A build script (`scripts/import-chords`) parses every CSV, runs validation and writes `src/lib/data/chords/catalog.json` (bundled with the app). It fails the build on any error, so a broken shape can never ship. The catalog groups shapes by chord identity (root, quality and bass) so that several voicings and fingerings of one chord sit together. Movable shapes are stored once; transpositions are calculated.

**Stable ids.** Ids are unique, lower-case and never reused or renamed. The importer compares against the previous catalog and fails if an id disappears without being listed in a `retired` file. Lessons, practice and printables refer to shapes by id only.

**Automated validation** (on every import): chord tones only, required tones present (omittable tones may be missing), expected bass note, frets within range, barre consistency, one fret per finger, open strings with no finger, stretch limit, every movable position in range, and tuning and instrument match. The result is a report, never an approval.

**Human review.** Stored separately in `content/chords/reviews.csv`: shape id, status (not reviewed, approved, changes requested), reviewer, date, note, and a fingerprint of the shape's frets, fingers and barres. If a shape is edited later, its fingerprint changes and its review falls back to "not reviewed" automatically. Nothing marks a review automatically.

**Chord packs.** A pack is another CSV in the same format. At first, packs ship with app updates through the same import. Importing a pack file inside the app (administrator-only, validated the same way, stored in the installation data folder) is a later option and needs Jason's decision.

**Acceptance criteria**

- The 75 manifest shapes import from `core.csv` with zero errors and match the manifest exactly.
- A deliberately wrong shape (wrong note, bad barre, missing finger) fails the import with a clear message naming the shape and the problem.
- Two voicings of one chord appear under one chord identity; a movable shape transposes to every root in its range.
- Editing a reviewed shape resets its review to "not reviewed".
- The app runs fully offline with the bundled catalog; no database is added.

**Tests:** CSV parsing (quotes, blank cells, comments), every validation rule with passing and failing samples, id stability and the retired list, review fingerprint reset, `transposeShape` at every root in every movable range, the round trip CSV → JSON → `analyzeShape` for all shapes, and an import test with a 1,000-shape synthetic pack to prove there's no size limit.

## Stage 2: Searchable Visual Chord Library

**Catalog view.** A large search box at the top of the Chords tab with live suggestions as the student types. Below it, a grid of chord cards, each drawn by `ChordDiagram`. Filters: level (Beginner, Intermediate, Advanced), family, root note and tuning. Beginner filter is the default for new students; "All" is one tap away.

**Search.** Matches chord names ("C major"), symbols ("Cmaj7", "CΔ7", "CM7"), aliases and quality names ("minor seventh", "half diminished"), and accepts sharps and flats either way ("C#", "Db"). Search runs on an in-memory index built from the catalog and the quality registry when the tab opens, so results and suggestions are never hard-coded. A typed chord that is valid in theory but has no shape in the catalog still shows its notes on the fretboard, with "No diagram in the library yet".

**Detail view.** A larger diagram, the chord's notes and formula, display mode switch (fingers, fret numbers, note names, intervals), left-handed mirroring from the student's setting, "Show on fretboard" (highlights the shape on the interactive fretboard), and the Voicing Explorer and Alternate Chord Explorer panels from Stage 3. Compare Chords, Print and Practice This Chord appear only when each one works (Stage 5).

**Who sees what.** Students see the catalog read-only. Review controls are administrator-only. Whether unreviewed shapes are shown to students is a decision for Jason (see below).

**Acceptance criteria**

- Typing "cm" suggests C minor and C minor 7 within the first keystrokes; "Db7" and "C#7" find the same chord.
- Every card and the detail diagram come from the shared renderer; no image files are added.
- Filters combine (for example Intermediate + minor family + root B) and show a clear empty state.
- Left-handed mode mirrors every card and the detail view without changing notes or labels.
- Works at 1280 px and at phone width, with keyboard and screen reader.

**Tests:** search index (names, symbols, aliases, enharmonics, misspacing, no-result handling), filter combinations, the catalog-versus-theory fallback, display mode labels for every shape, left-handed mirroring, accessibility names, a search response time budget (under 50 ms on 2,000 shapes), and Playwright flows for search → detail → fretboard.

## Stage 3: Voicing Explorer and Alternate Chord Explorer

**Voicing Explorer.** For the selected chord, list every validated voicing in the current tuning: fixed shapes with that root, plus movable shapes that can be transposed to that root within their checked range. Each row shows a small diagram, fret position, fingering, bass note, voicing type, difficulty and suggested use. Selecting a row updates the large diagram and the interactive fretboard at once.

- Default order: level, then difficulty, then position on the neck (open shapes first). Students can sort by position or filter by voicing type (open, barre, CAGED, triads and inversions, drop-2).
- Inversions and slash voicings are labelled with their bass ("first inversion, E in the bass").
- The panel only ever shows the same chord quality. Different qualities belong in the Alternate Chord Explorer, so the two are never mixed.

**Alternate Chord Explorer.** A separate panel, grouped and labelled so the student can see the kind of relationship:

| Group | Example for C major | What the panel says |
| --- | --- | --- |
| Other voicings of the same chord | Link to the Voicing Explorer | Same notes, different shape or position |
| Extensions and colours | Cmaj7, C6, Cadd9, C6/9 | Adds a note on top of C major; describes the sound (for example maj7 "softer, jazzier") |
| Suspended | Csus2, Csus4 | Replaces the 3rd; sounds open or unresolved |
| Inversions and slash chords | C/E, C/G | Same chord, different bass note |
| Possible substitutions | Am (relative minor), Em | Shares notes with C; can work in some progressions. Always shown with "depends on the song" |

- Relationships come from a small data file of rules (for example "relative minor: root a minor 3rd below, minor quality"), applied by `relatedChords()` to any root. Results are calculated, not listed by hand per chord.
- Each explanation is short, says how the sound changes and when a player might use it, and is reviewed like other student-facing text. Substitutions never claim to work in every song.
- A related chord with a catalog shape shows its diagram; one without shows its notes and "No diagram in the library yet".

**Acceptance criteria**

- Selecting C shows open C, the A-shape barre at fret 3 and the E-shape barre at fret 8, CAGED shapes and triads, beginner shapes first.
- Choosing a voicing updates the diagram and fretboard immediately, with correct bass and fingering.
- No different chord quality appears in the Voicing Explorer.
- C major's alternates include Cmaj7, Cadd9, C6, Csus2, Csus4, C/E, C/G and Am, each in the right group with an explanation; Am is marked as context-dependent.

**Tests:** voicing collection (fixed plus transposed, tuning filter, range limits), ordering, the quality-separation rule, `relatedChords()` for every quality and all 12 roots with correct spelling, every relationship rule against hand-checked examples, explanation text present for every group, and Playwright flows for selecting voicings.

## Stage 4: Reverse Chord Finder ("What chord am I playing?")

**Input.** The interactive fretboard in a one-position-per-string mode. Clicking a fret on a string sets that string; clicking it again clears it. Each string has an open or mute toggle beside its label. Strings start muted. Controls: **Undo** (last change), **Clear** (mute every string), **Reset** (clear and return the view to its defaults). The selected notes are shown live, string by string, with their names. Right- and left-handed layouts both work; keyboard entry uses the fretboard's existing roving focus.

**Identification: `identifyChord(positions, tuning)`.**

1. Work out each sounding pitch from the tuning definition (`midiAt`), the lowest sounding pitch (the bass) and the set of pitch classes.
2. For every candidate root (each pitch class present) and every quality in the registry, compare the chord's formula with the notes: tones matched, required tones missing, omittable tones missing (for example the 5th), and notes outside the chord.
3. Candidates with notes outside the chord are dropped, except as slash chords: if the upper notes form a chord and the bass is not part of it, the result is a slash chord (for example D/F#, or C/D).
4. Inversions are named from the real bass ("C major, first inversion", shown as C/E).
5. Rank by completeness (no required tones missing), then fewest omissions, then root in the bass, then the simpler and more common quality, then fewer accidentals in the spelling. Rootless readings are allowed but ranked last and labelled as such.
6. Return every plausible candidate with an explanation, for example "Am7 (A C E G)" and "C6 with A in the bass (C E G A)" for the same notes, or "C major with no 5th".
7. One note shows the note name; two notes show the interval (and "power chord" for a 5th).

**Output.** A ranked list of candidates with explanations and any missing tones, a diagram of the student's own fingering drawn by `ChordDiagram` (fret numbers by default, since no fingering was chosen), and "Open in Chord Library" or "See other voicings" for each candidate that exists in the catalog. Identification never requires the fingering to be in the catalog.

**Acceptance criteria**

- x32010 → C major first; 320003 → G major; 2x0232 → D/F# (D major, first inversion); x02210 → Am; x02010 → Am7 and C6/A both offered, with explanations.
- Muted, open and fretted strings all work, and a string can only have one sounding position.
- Undo, Clear and Reset behave as described; left-handed mode gives the same results.
- A valid chord not in the catalog (for example an unusual Cmaj7 voicing) is still named correctly.
- Fully offline.

**Tests:** `identifyChord` against a table of at least 200 hand-checked fingerings covering every quality, inversion and slash case, plus ambiguous sets (C6/Am7, Cdim7 symmetry, aug symmetry, sus2/sus4 overlap) that must return several candidates; ranking order; missing-tone explanations; alternate tunings (the same fingering in Drop D gives the right new name); the input store (one position per string, undo stack, clear, reset); and Playwright flows in right- and left-handed modes.

## Stage 5: Integration with lessons, practice, comparison and printing

- **Lessons** refer to shapes by id (and a display mode); the lesson renderer uses `ChordDiagram`. A corrected shape updates every lesson that uses it.
- **Practice This Chord** starts a chord drill (for example a chord-change or chord-identification drill) using the same shape data; it records practice like other drills and never changes mastery except through the normal mastery rules.
- **Compare Chords** shows two or three chords side by side with shared and different notes highlighted on one fretboard.
- **Print** sends selected diagrams to Print Studio (when Print Studio is authorised) as black-and-white SVG in the worksheet page layout.
- Each action button appears only once its feature works.

**Acceptance criteria:** a lesson diagram, a practice drill and a printed sheet built from one shape id all show the corrected shape after a single CSV change; Compare highlights shared notes correctly; print output is black and white only.

**Tests:** shape-id references resolve for every lesson and drill (a missing or retired id fails the build), the single-correction test across lesson, practice and print, Compare highlighting, print SVG colour check, and Playwright flows for each action.

## Permissions, data and branding

- Students read the catalog; administrators review shapes (approve or request changes) and, if approved later, import packs. Rust enforces administrator-only writes, and every review or import is audited.
- Per-student data stays in the student's own folder (for example recently viewed chords, if added); the catalog is shared and read-only.
- All screens use the existing logo, theme, glow cards, blue accents and amber highlights. Diagrams follow the existing renderer's colours.

## Decisions for Jason

1. **Unreviewed shapes:** in released builds, should students see only approved shapes (my recommendation), or all validated shapes with a "not yet reviewed" label?
2. **Chord Finder tab name:** "Chord Finder" as the tab, with the "What chord am I playing?" prompt inside and on links (my recommendation), or "What Chord Am I Playing?" as the tab name itself?
3. **Chord packs:** ship packs only with app updates for now (my recommendation), or also allow administrators to import a pack file inside the app?
4. **Stage order:** build Stages 1 to 5 in order (my recommendation), with the Reverse Chord Finder able to start after Stage 1 because it depends only on the theory engine?

# Shared composition model (Song Project)

Architecture only. First written 2026-11-22; section-based design **approved by Jason on 2026-11-22**, then strengthened in the final refinement pass the same day (timing, form, anchors, imports, migrations, import and export safety). **Not authorised for implementation.** Roadmap placement: [master-roadmap.md](master-roadmap.md) milestone X0.6 (model and storage, including the backing representation), then X2 onward for the editors that use it.

This is the piece Jason asked to be examined most carefully: one model that lets chord progressions, lyrics, arrangements, rhythm patterns, TAB, standard notation, melodies, MIDI playback and recordings work together instead of becoming separate systems. The Rhythm & Strumming Studio, the Melody & Harmony Assistant and the Backing Track Generator have **no data model of their own**; they read and write the structures below.

## 1. The core idea: one song, one timeline, one source of truth for each fact

Separate systems drift apart when each keeps its own copy of the same facts: its own bars, its own tempo, its own chords. This model gives every musical fact exactly one home and makes every tool a **view or editor of that one home**.

| Fact | Its one home | Everything else |
| --- | --- | --- |
| Section order (the form) | `arrangement` (a list of references to sections) | Performance sheet, playback order and printed lead sheet are calculated from it |
| Bars, pickup, time signature, tempo, key, feel (swing) | Each section's **conductor** | Parts, harmony, lyric timing, rhythm patterns and MIDI read it; they never store their own meter or tempo |
| Repeat endings (1st and 2nd time bars) | Each section's `endings` | Playback, printing and the Arrangement Board read them |
| Chords | Each section's **harmony track** (chord events on the bar grid) | Chords above lyrics, the Progression Workshop, Roman and Nashville numbers, chord diagrams and accompaniment are views of it |
| Lyrics | Each section's lyric lines | Chord positions in lyrics are links to harmony events, not copies of chords |
| Strumming and picking patterns | `patterns[]` in the song (copies of library patterns), referenced by each section's `rhythm` | Strum arrows, the Rhythm Studio, accompaniment playback and rhythm charts |
| Notes (TAB, notation, melody) | Each section's **part clips** (events with pitches, optional string and fret) | TAB, notation, combined view, the Melody & Harmony Assistant, MIDI and playback highlighting are views of it |
| Audio | Files in `media/`, referenced by recordings | Waveforms, attachments to sections |
| Generated backing arrangements (style, seeds, locks, mix, variations) | `backings[]` in the song; their notes are ordinary clips marked with their source | The Backing Track Generator, playback, mixer and exports read them ([backing-track-generator.md](backing-track-generator.md)) |
| Imported content the app can't edit | `extensions` on the nearest element | Shown as markers, exported back where possible, never silently dropped |
| Everything derived | Never stored | Roman numerals, Nashville numbers, capo shapes, MIDI events, accompaniment, the flattened timeline, diagrams |

So a chorus played three times is one section referenced three times: correct one chord, one lyric or one TAB note in the chorus and every repeat changes. A variation ("Chorus, last time") is a duplicated section, made on purpose and linked back with `variationOf`.

## 2. Structure

```
SongProject
├── schemaVersion
├── metadata           title, artist, credits, source (original | public domain | imported), tags, favourite, notes
├── defaults           key, tempo, time signature, feel, capo, tuning, instruments
├── instruments[]      parts: guitar 1, bass, piano, melody...  (instrument id, role, tuning, capo, display: tab | notation | both)
├── patterns[]         rhythm patterns used by this song (copies, so the song stays portable)
├── sections[]
│   ├── id, name, variationOf?
│   ├── conductor      bar count, pickup, meter changes, tempo changes, key changes, feel changes
│   ├── endings[]      first/second (and later) time bars at the end of the section
│   ├── harmony[]      chord events: position or loose, length, ChordSymbol, locked, origin, voicing
│   ├── lyrics[]       lines of text with chord anchors that point at harmony event ids
│   ├── rhythm?        pattern reference and bar ranges for strum arrows and accompaniment
│   ├── clips[]        one per instrument part (and per backing part): voices of note, chord and rest events on the section's bars
│   ├── recordings[]   references to takes, with an optional bar offset
│   └── extensions[]   preserved imported content (see section 9)
├── arrangement[]      ordered entries: { id, sectionId, repeats, label?, overrides? }
├── progressions[]     saved progressions not yet placed in the song (from the Workshop)
├── backings[]         generated backing arrangements and their saved variations (section 7a)
├── extensions[]       song-level preserved content
└── revision           number, saved at, note
```

## 3. Positions and time

- A position is `{ bar, tick }` inside a section, with **960 ticks per quarter note** (PPQ). Bars come only from the section's conductor, so every part, chord, lyric anchor and pattern sits on the same grid.
- Bar numbers start at 1. A pickup bar, when present, is bar 0 (section 4).
- The **flattened timeline** is calculated by walking the arrangement: each section instance (each pass of each entry) gets a start tick and a start time from the conductor's tempo map, the chosen ending and any instance override. Playback, MIDI export, the playhead, auto-scroll and rhythm highlighting all use this one calculation, through the shared transport ([transport-timing.md](transport-timing.md)).

### Is 960 ticks per quarter note enough? (analysis)

960 = 2⁶ × 3 × 5, so it divides exactly into:

| Value | Ticks |
| --- | --- |
| Whole, half, quarter, eighth, 16th, 32nd, 64th | 3840, 1920, 960, 480, 240, 120, 60 |
| 128th | 30 |
| Dotted and double-dotted values down to the 64th | exact |
| Triplets at every level down to 64th triplets | 640, 320, 160, 80, 40 |
| Quintuplets and sextuplets of 8ths and 16ths | exact (for example a 16th quintuplet is 192) |
| Swing offsets at the common ratios (2:1, 3:2 of eighths) | exact |

**Concrete limitation found:** tuplets whose count has a prime factor other than 2, 3 or 5 (septuplets, 9-tuplets with 7 in them, 11- and 13-tuplets) do not divide 960 exactly. A 16th-note septuplet member would be 34.29 ticks.

**Resolution (keeps 960):** durations are stored as **rational values** (`base`, `dots`, `tuplet: { actual, normal }`), never as tick counts, and a tuplet's members are stored as a **tuplet group** with a start tick and an index for each member. The exact onset of a member is calculated with rational arithmetic from the group; it is rounded to a tick only when scheduling sound or drawing, never when stored. At 120 BPM one tick is 0.52 ms, so the rounding is inaudible, and because nothing rounded is written back, saving and loading never accumulates error. Imported files whose resolution doesn't divide into 960 (for example a MIDI file at 1000 PPQ, or a MusicXML `divisions` value with a factor of 7) are converted exactly where possible; any onset that can't be represented is moved to the nearest tick and listed in the import report (section 9).

## 4. Meter, tempo and form

### Pickup measures and incomplete opening bars

- A section's conductor may declare `pickup: ticks` (for example 480 for an eighth-note pair in 4/4). The pickup is **bar 0**, played before bar 1, and lasts exactly that many ticks. Only the first bar of a section can be a pickup.
- A pickup is validated against its own length, not the full time signature, so it isn't marked incomplete.
- The final bar of a section may be shortened with `finalBarTicks`, the usual way notation balances a pickup. It is validated against that length.
- In the flattened timeline the pickup occupies its own time before bar 1 on every pass. An arrangement entry can set `overrides.skipPickup` (for example a repeated verse whose pickup is already covered by the previous bar's notes). Nothing in the section is changed by skipping it.
- In chords-over-lyrics writing, words before the first chord simply sit in the pickup; a beginner never has to think about it.
- MusicXML implicit measures (`implicit="yes"`) and MIDI files that start part-way through a bar import as a pickup.

### Time signature changes within songs and sections

- `conductor.meters` is a list of `{ bar, numerator, denominator, grouping? }`. A change always starts at a bar line, never mid-bar. `grouping` describes irregular beats (for example 7/8 as 2+2+3), which drives beaming, accents, the metronome and rhythm patterns.
- **Each section starts with its own meter.** If a section sets none, it uses the song default. A meter never carries over from the previous section, because the arrangement can reorder sections and the same section can follow different ones.
- Changes inside a section are allowed at any bar (for example a 2/4 bar in a 4/4 verse).

### What happens to existing notes when a time signature changes

Changing the meter is one operation, `setMeter(section, fromBar, meter, mode)`, previewed before it's applied and undone in one step. It **never deletes or changes a pitch**. The user picks one of two modes:

1. **Keep bar lines** (default when the section already has notes in the bars affected). Each bar keeps its contents and simply gets the new length. Bars that become shorter than their contents are marked **overfull** and bars that become longer are marked **incomplete**. Nothing moves and nothing is cut. Overfull events beyond the bar's end are drawn in a warning colour (with a text label, not colour alone) and are not played until the user fixes them.
2. **Re-bar the music.** Every event keeps its absolute position from the start of the section, and new bar lines are drawn through the music. A note that now crosses a bar line is split into tied notes of the same pitch whose durations add up to the original. Harmony events, lyric anchors (through their harmony events) and recordings keep their absolute positions. The section's bar count is recalculated, and a leftover partial bar at the end is marked incomplete.

Loose chords (section 5) have no positions, so they are unaffected by either mode.

### Tempo changes and repeated sections

- `conductor.tempos` is a list of `{ at: { bar, tick }, bpm, beatUnit, transition: 'immediate' | 'ramp' }`. A ramp changes the tempo smoothly up to the next change (rit. and accel.). Each section starts at its own first tempo, or the song default if it sets none. Like meter, tempo never carries over from the previous section unless the section's first entry is `{ bpm: 'continue' }`, which means "keep whatever tempo was in effect at the end of the previous section instance". This is calculated on the flattened timeline, so it stays correct when sections are reordered.
- **Repeats are identical by default.** A section referenced three times plays its own tempo map identically each time.
- **Per-instance overrides** live on the arrangement entry, never in the section, so the section stays shared: `overrides.tempo` (a fixed bpm for that instance), `overrides.tempoScale` (for example 1.05 for a lifted last chorus), `overrides.finalRitardando` (a ramp over the last bars of that instance), `overrides.ending` (which ending to use) and `overrides.skipPickup`. Anything that changes notes, chords or lyrics is not an override: it needs a deliberate variation (a duplicated section with `variationOf`).
- Fermatas and pauses are expressive markings on events (section 4, expressive timing), not tempo changes.

### First and second endings and other repeat variations

- A section can have `endings[]`: `{ id, passes: [1], bars: [9, 10] }`, `{ id, passes: [2, 3], bars: [11, 12] }`. The bars named by endings sit after the section's main bars in the same conductor.
- An arrangement entry with `repeats: n` plays the section n times. On pass k it plays the main bars, then the ending whose `passes` include k, skipping the others. A pass with no matching ending plays the main bars only and is flagged in the Arrangement Board. `overrides.ending` can force an ending for a single-pass entry (for example a final chorus that takes the 2nd ending).
- **D.S., D.C., coda and fine are not stored as jumps.** The arrangement already states the form explicitly, so a song never needs a jump to play correctly. MusicXML and other imports **unroll** jumps into arrangement entries and keep the original jump markings as preserved content, so an export can write them back and printing can show them. Printing can also compress consecutive identical entries back into repeat signs with 1st and 2nd endings.
- Larger variations (a chorus with a different last line, an extra bar, a key change for the last chorus) are variations: a duplicated section linked with `variationOf`, so the Arrangement Board can show "Chorus (last time) is a variation of Chorus" and offer to compare them.

### Swing, triplets, tuplets and expressive timing

- **Feel:** `conductor.feels` is a list of `{ bar, type: 'straight' | 'swing' | 'shuffle', unit: 8 | 16, ratio }`, with ratio defaulting to 2:1 and adjustable from 1.5:1 to 3:1. Notation stays written as straight eighths (or sixteenths) with a "swing" marking; only playback and rhythm-pattern timing shift the off-beats. Rhythm patterns and accompaniment follow the section's feel, so a pattern never needs separate swung and straight versions.
- **Triplets and tuplets:** stored as rational durations in tuplet groups (section 3). Nested tuplets are allowed to one level in the first editor release; deeper nesting is imported and preserved but shown read-only.
- **Expressive timing** is always a marking that playback interprets, never a change to the grid:
  - fermata on an event (playback holds it for 1.5 times its length by default, adjustable per fermata), caesura and breath marks;
  - rit. and accel. as tempo ramps (above);
  - grace notes, which take no time on the grid and borrow a short time from the following note in playback;
  - arpeggiated chords and strum direction, played with a small spread;
  - optional "humanize" in playback (small seeded timing and velocity variation), off by default, never written into the song.
- Because the grid is never changed by expression, notation, TAB, chord positions and MIDI export stay exact.

### Key changes

`conductor.keys` is a list of `{ bar, key }`. Like meter, each section starts with its own key or the song default. Roman and Nashville numbers are calculated against the key in effect at each chord.

## 5. Harmony events

```ts
HarmonyEvent { id; at: { bar; tick } | null; length?: ticks; chord: ChordSymbol; locked: boolean;
               origin: 'user' | 'generated' | 'imported'; voicing?: shapeId }
ChordSymbol { root: Spelling; quality: string; bass?: Spelling }
```

- **Timed or loose.** A beginner can write chords over lyrics without thinking about bars. Those chords are *loose* (`at: null`), kept in order. "Fit to bars" (a guided step, or automatically when the section is sent to playback or the Arrangement Board) gives them positions. Nothing is lost either way, so the simple chords-and-lyrics workflow and the precise workflow share one model.
- `voicing` links to a catalog shape for diagrams and accompaniment; changing the voicing never changes the chord.
- `locked` and `origin` let the Progression Generator regenerate other chords without touching ones the user locked or edited (see creative-workstation.md section 5).
- A harmony event with no lyric anchor is still part of the song; the section's **chord tray** lists unanchored chords so none is ever invisible.

## 6. Lyrics and chord anchors

```ts
LyricLine { id; text: string; anchors: { at: number; harmonyId: string; needsCheck?: boolean }[] }
```

`at` is an offset in Unicode code points, so it is identical on Windows and Android; the editor snaps the caret to whole characters (grapheme clusters), so an accented letter or emoji is never split. Each harmony event is anchored at most once.

Anchor rules, applied by the lyric operations so every editor behaves the same way:

| Edit | What happens to anchors |
| --- | --- |
| Typing before an anchor | The anchor moves right with its character |
| Typing exactly at an anchor's position | The anchor stays with the character it was on (the new text goes before the chord), so a chord stays over its word |
| Typing after an anchor | Unchanged |
| Deleting text that doesn't contain an anchor | Anchors after it move left |
| Deleting text that contains an anchor | The anchor moves to where the deleted text started and is marked `needsCheck` (shown as a small dot until the user confirms or moves it). The chord is never deleted with the text |
| Replacing a word (select and type) | Same as delete then type: the anchor ends up at the start of the new word, marked `needsCheck` |
| Splitting a line (Enter) | Anchors go with their characters to the first or second line |
| Joining lines | Anchors of the second line are offset by the first line's length |
| Moving or reordering lines | Anchors travel with their line |
| Deleting a whole line | The line goes; its chords stay in the harmony track and appear in the chord tray, timed ones keeping their positions. Undo restores the line and its anchors exactly |
| Cutting and pasting lines within a section | Anchors travel with the text (the same harmony events) |
| Copying or pasting into another section | New harmony events are created for the pasted chords (new ids), so the two sections don't share chords by accident |
| Transposing | Text and anchors never change; only the chord symbols do |

When a melody part exists, syllables can also attach to melody note ids for notation lyrics; the same insertion rules apply to those links.

## 7. Part clips (TAB, notation and melody)

```ts
Clip { instrumentId; voices: Voice[] }              // covers exactly the section's bars, including pickup and endings
Voice { events: Event[]; tuplets: TupletGroup[] }
TupletGroup { id; start: { bar; tick }; actual; normal; base }
Event { id; at: { bar; tick } | { tuplet: id; index }; kind: 'note' | 'chord' | 'rest';
        duration: { base; dots; tuplet? }; notes: Note[];
        dynamics?; articulations?; techniques?; expression?: { fermata?; grace?; arpeggiate? } }
Note { id; pitch: { midi; spelling }; string?; fret?; tie?; techniques?; bend?; finger? }
```

- **Pitch is authoritative; string and fret are a validated assignment.** Staff entry suggests positions (lowest stretch first, from the Instrument & Tuning Manager) and the player can choose another; TAB or fretboard entry sets both.
- Each bar's durations must fill the conductor's length for that bar (including pickup and final-bar lengths). Otherwise the bar is shown as incomplete or overfull. Bars are never silently padded or trimmed.
- Tuning change: pitches are kept, assignments re-checked, impossible ones flagged. Transposition: pitches move with correct spelling for the new key, assignments re-suggested and flagged.
- A **melody part** is an ordinary clip on an instrument with `role: 'melody'`. The Melody & Harmony Assistant writes only the notes the user chooses into it.

## 7a. Generated backing arrangements

Added 2026-11-22 for the Backing Track Generator ([backing-track-generator.md](backing-track-generator.md)). Generated music is stored in the same structures as written music.

```ts
BackingArrangement { id; name; active: boolean; styleRef: { packId; version }; rootSeed;
                     settings: { complexity; fills; humanize; intro; ending; feelOverride? };
                     preset: 'practice' | 'natural' | 'performance'; parts: BackingPart[];
                     mix: { partId; volume; pan; mute; solo }[]; createdAt; basedOn?: string }
BackingPart { id; role: 'drums' | 'bass' | 'rhythm-guitar' | 'keys' | string; instrumentId; sound;
              generator: { id; version }; seed; locked: boolean; hasEdits: boolean;
              harmonyFingerprint: { sectionId; bar; hash }[] }
Clip.source?: { backingId; partId }            // present on generated clips
Event.edited?: boolean                         // set when a user edits a generated event
InstanceOverlay { backingId; partId; entryId; pass; bars: number[]; clip: Clip }   // per-instance fills and endings
```

- **Notes are clips.** Each backing part has one clip per section, marked with `source`. TAB, notation, MIDI export and playback read them like any other clip. Drum clips use a drum instrument and General MIDI drum note numbers.
- **One active backing.** `backings[]` holds saved variations; exactly one (or none) is `active` and played. Variations never share clips, so restoring one can't damage another.
- **Instance overlays.** Because a section can be played several times, per-instance differences (a fill before the second chorus, an ending, a count-in) are stored as overlays that replace specific bars for one arrangement entry and pass only. The flattened timeline applies them. This is the only way generated material differs between repeats; the section's own clips stay shared.
- **Edits are preserved.** A user edit to a generated event sets `edited` on the event and `hasEdits` on the part. Regeneration skips edited events and locked parts unless the user confirms a dialog listing exactly what would change.
- **Staleness, not silent change.** `harmonyFingerprint` records the harmony each bar was generated against. When harmony changes, mismatching bars are shown as out of date and updated only by an explicit Update action. Transposition, tempo and feel changes need no regeneration (pitches transpose like every clip; tempo and feel apply at playback).
- **Playback presets** (Practice, Natural, Performance) are stored on the backing as a playback preference and affect rendering only; they never change events.
- **Reproducibility.** Style pack id and version, generator id and version and seeds are stored, so the arrangement can be regenerated identically; the notes themselves are stored too, so a newer style pack never changes a saved arrangement.

## 8. Rhythm patterns on sections and in accompaniment

The Rhythm & Strumming Studio edits this structure; it has no separate format.

```ts
RhythmPattern { id; name; meter: { numerator; denominator; grouping? }; lengthBars: 1 | 2 | 4;
                steps: { at: ticks; duration: ticks; stroke: 'down' | 'up' | 'mute' | 'rest' | 'hold' | 'pick';
                         strings?: StringSelector; accent?: boolean }[];
                origin: { library: 'builtin' | 'student'; id; version } }
SectionRhythm { patternId; ranges?: { from: bar; to: bar }[]; overrides?: { bar; patternId | null }[] }
```

- `StringSelector` names strings relative to the current chord (`bass`, `bass-alt`, `treble-1`...) rather than fixed strings, so a fingerpicking pattern follows any chord shape and the actual bass string after each chord change.
- When a library pattern is attached to a song it is **copied into `patterns[]`** with its origin, so the song plays and prints the same after export to another installation. "Update from library" is an explicit action.
- **Accompaniment** is derived, never stored: pattern × harmony track × conductor (meter, feel, tempo) produces MIDI events at playback time. Sections with a guitar clip play the clip instead unless the user chooses both.
- A pattern only applies to bars whose meter matches its own. In other bars (for example a 2/4 bar in a 4/4 verse) it isn't stretched or cut: the bar is shown as "pattern doesn't fit this bar", plays block chords on the beat if accompaniment is on, and the user can choose another pattern for that bar.
- Patterns use the same 960-tick grid and follow the section's swing setting.

## 9. Imported content the app can't edit (never silently destroyed)

- Every import (MusicXML, MIDI file, a song from a newer minor schema, later formats) produces an **import report** before anything is saved: what was imported, what was converted (for example unrolled repeats or rounded onsets), and what isn't supported. The user can cancel at that point and nothing is written.
- Unsupported content is **preserved**, not dropped. It is stored in `extensions` on the nearest element (song, section, part, event or note) as `{ source: 'musicxml' | 'midi' | ..., version, path, payload }`, where `payload` is the original fragment (XML text, MIDI events) and `path` says where it sat.
- Preserved items appear as small markers ("Imported item: ornament not editable here"), travel with their element through copy, transposition (unchanged) and export, and are written back on export to the same format when their position is still valid. If the user deletes the element that holds them, they go with it, as an explicit choice that undo can reverse.
- The original imported file is kept in `media/imports/` by default (an option for large files), so the source is always recoverable.
- Examples: unsupported ornaments, guitar techniques the editor doesn't yet draw, multiple lyric verses beyond the first release's limit, D.S./coda markings, MIDI controller events, text directions and layout hints.

## 10. Recordings

`{ id, file: 'media/take-3.wav', durationMs, sha256, sectionId?, offset?: { bar, tick }, note }`. With an offset, a take lines up with the section in playback; without one it is simply attached. Recordings are never overwritten: a new take is always a new file. Partially written takes are recovered as in section 14.

## 11. Operations: one system for undo, redo, autosave and recovery

Editors never change the model directly. They send **operations** (add chord, move event, set lyric text, set meter, transpose song, attach pattern, reorder arrangement...). One operation engine serves every tool, including the Rhythm Studio, the Melody Assistant, the Progression Workshop and imports:

- applies the change and checks the invariants below;
- records the inverse, so every editor shares the same **undo and redo** history (at least 100 steps per open song); compound changes (re-barring, transposing, fit-to-bars, Send to Song, an import) are one undo step;
- emits the changes every open view needs, so the TAB view, notation view, Workshop, lyrics and Arrangement Board stay in sync without knowing about each other;
- appends each operation to the **autosave journal** (`autosave.json`) within 2 seconds of the change; the full `project.json` is rewritten atomically at the end of an editing burst, on leaving the song, on checkpoint (background, sign-out, profile or workspace switch) and at least every 60 seconds while editing;
- on reopening after a crash or power loss, replays the journal over the last good `project.json` and shows "Recovered draft", with the option to discard the recovered changes (kept as a revision either way).

No tool keeps its own undo stack, save path or recovery file. Operating profiles never relax autosave.

## 12. Invariants (checked after every operation and on load)

1. Every id is unique within the project; every reference (arrangement → section, anchor → harmony event, rhythm → pattern, recording → file, voicing → shape, `variationOf` → section, tuplet member → group) resolves, or is reported as a broken link with a repair choice.
2. Timed harmony events and clip events lie within their section's bars (including pickup and endings); only events in a bar marked overfull may extend past its end.
3. Clip bars are checked against the conductor's lengths; incomplete and overfull bars are marked, never altered.
4. No pitch is changed except by an explicit transpose or edit.
5. Locked harmony events change only by a direct user edit.
6. Meter, tempo, key and feel changes start where allowed (meter and feel at bar lines); endings name bars that exist and passes that don't overlap.
7. Each harmony event has at most one lyric anchor.
8. Derived data is never stored, so it can't go stale.
9. Preserved `extensions` are never removed except with the element that holds them.
10. At most one backing is active; every backing clip's `source` names an existing backing and part; every instance overlay names an existing arrangement entry, a valid pass and bars inside its section; a locked backing part or an edited event changes only through a direct user edit or a confirmed regeneration.

## 13. Song Project migration rules

- `schemaVersion` is a single increasing integer. Every change to the format, however small, increments it.
- **Ordered migrations**, one pure function per step (v1 → v2 → v3...), run in order on load. Each has a fixture project from the version it upgrades and a test that the result passes every invariant.
- **Additive first.** New features add optional fields with documented defaults, so older songs need only the default filled in. Renaming or restructuring is a migration step, never a silent reinterpretation.
- **Nothing is lost.** A field that a later schema no longer uses is moved into `extensions` (`source: 'legacy'`), not deleted.
- **Backup before upgrade.** Before a song is migrated, its current `project.json` is copied to `revisions/pre-migration-v<n>.json`. The migrated file is written atomically; if migration fails, the original stays untouched and the song opens read-only with a clear message.
- **Newer files are refused, not damaged.** An older app opening a newer `schemaVersion` shows "This song was saved by a newer PickWorks Studio" and offers read-only viewing of what it understands; it never writes to the file.
- **Bundled data has its own versions.** Rhythm presets, generator styles and the chord catalog are versioned separately. Songs store copies (patterns) or ids (voicings, styles with a data version), so a data update never silently changes an existing song.
- Migrations also run on songs inside imported archives and restored backups, through the same code path.

## 14. Storage, import, export and recovery

```
<student>/songs/<song-id>/
  project.json     the model above
  autosave.json    operation journal since the last full save
  media/           audio files (never inside JSON); media/imports/ keeps original imported files
  revisions/       saved versions and pre-migration copies
<student>/songs/.staging/   temporary area for imports (cleared on start-up)
```

**Ownership.** Songs and recordings belong to the student (confirmed by Jason 2026-11-22). Rust resolves every song path inside the signed-in student's folder from a session token and a song id; the interface never passes a file path. Students can never read, import into, export from or back up another student's songs. Administrator access is only the narrow, student-authorised, read-only binder access in [operating-profiles.md](operating-profiles.md) ("Field binder permissions"). Backups include recordings by default, with an option to leave them out. Paths inside a song are relative to its folder.

**Export.** A song exports as an archive of its folder with a `manifest.json` listing every file, its size and SHA-256, the schema version and the app version. Export writes to `<name>.partial` and renames to the final name only after the manifest is written and the copy is verified, so an interrupted export never leaves a file that looks complete. A partial file left by a crash is deleted on the next export attempt or start-up. Recordings can be left out of an export by choice.

**Import (default: a separate copy).**

1. **Pre-flight:** check free space for the archive's declared size plus a margin (10% and at least 50 MB) and refuse with a clear message before writing anything if there isn't enough.
2. **Validate the archive before extracting anything:** the manifest is present and parses; every entry has a relative path with no `..`, no absolute or drive-letter paths, no backslash tricks, no links, no device names and no duplicate names when compared case-insensitively; only expected file types (JSON, WAV, FLAC, Ogg, MusicXML, MIDI); total and per-file size limits and a compression-ratio limit (protection against archive bombs); file count limit. Anything failing is rejected as a whole with the reason.
3. **Extract into `.staging/`**, verify every checksum against the manifest, then load and validate `project.json` (migrations and invariants).
4. **New identity:** the song gets a new id (and new ids for its recordings' files if needed), so it can never collide with an existing song. The original project, if present, is not touched. The copy's metadata records where it came from.
5. **Atomic move** from staging into `songs/<new-id>/`. Only then does the song appear in the Songbook.

**Replacing an existing song** (same project id) is offered only after the archive has passed every check above, and only through an explicit confirmation that names the song being replaced and its last-saved date. Before replacing, the current song folder (project, revisions and media) is backed up as a complete revision snapshot. Recordings and revisions are never overwritten in place: incoming media with a name that already exists is renamed, and the existing revisions are kept alongside the incoming ones.

**Interrupted imports and exports.** An import interrupted at any point leaves only the staging folder, which is discarded on the next start; the Songbook is unchanged. An interrupted replacement leaves the backed-up original, which is restored automatically on the next start if the replacement didn't complete. Exports follow the `.partial` rule above.

**Low storage.** Saves, imports, exports and recordings check free space first. A save that fails for lack of space never truncates the existing file (atomic writes keep the previous version) and tells the student what happened and how much space is needed. Recording stops gracefully below a safety threshold and keeps what was captured.

**Partially written media.** The recorder writes `take-n.wav.partial` and updates the WAV header every few seconds, so a crash or power loss leaves a playable file up to the last update. On the next start, partial takes are repaired (lengths fixed from the file size), checksummed and offered as "Recovered take" in the song; they are never deleted automatically. Imported media failing its checksum is rejected with the import.

## 15. Cross-tool flows

| Flow | What happens in the model |
| --- | --- |
| Workshop → song | A progression's chords become harmony events in a chosen section (new or existing), keeping their lock state and a link to the generator settings |
| Song → Workshop | A section's harmony opens in the Workshop as a progression; saving writes back to the section |
| Arrangement Board | Reorders, repeats or duplicates entries, sets endings and per-instance overrides; section content is untouched |
| Reverse Chord Finder → song | The identified chord is added as a harmony event, optionally with the student's fingering as its voicing |
| Rhythm Studio → song | A pattern is copied into `patterns[]` and referenced by a section's `rhythm` |
| Melody Assistant → song | Chosen notes are added to the melody clip through ordinary operations |
| Backing Track Generator → song | Generated parts become clips with a `source`, plus overlays and a `backings[]` entry, in one compound operation; regeneration replaces only unlocked, unedited events |
| TAB / notation | Edit clips on the section grid; the harmony track is shown above the staff for reference |
| Playback | Flatten the arrangement (passes, endings, overrides), convert clips to MIDI events, add accompaniment derived from harmony and patterns, apply feel and expressive markings, schedule on the shared transport, and map sounding event ids back to the views for highlighting |
| Performance Mode | Reads lyrics, anchors and the arrangement; auto-scroll speed comes from the flattened timeline |
| MusicXML | Parts and measures to clips, `<harmony>` to harmony events, `<lyric>` to lyrics, voltas to endings, jumps unrolled into the arrangement with the markings preserved; unsupported elements preserved and listed |
| MIDI file | Tracks to clips, tempo and meter maps to conductors (one section by default, with a "split into sections" step), markers to section names; controller data preserved |

## 16. Why this design (and the alternatives rejected)

- **One linear score for the whole song** (the DAW approach) makes repeated sections copies, so a correction must be made several times and chords-over-lyrics writing becomes awkward. Rejected.
- **Separate files per tool** (lyrics file, TAB file, progression file, rhythm file) is exactly the disconnected systems Jason wants to avoid. Rejected.
- **Chords stored as text in lyrics** breaks transposition, playback and diagrams. Rejected.
- **Repeat jumps (D.S., coda) as the stored form** makes playback, auto-scroll and editing depend on jump interpretation. Rejected in favour of an explicit arrangement, with jumps preserved for printing and export.
- **Section-based clips on one shared conductor** keeps the form explicit, makes repeats free, keeps lyrics-first writing simple, and maps directly to MusicXML and MIDI. Chosen.

## 17. Tests for the model (X0.6)

- Round trip save → load → save is byte-stable for 30 varied sample projects, including pickups, meter changes inside sections, tempo ramps, `continue` tempos, voltas with three passes, swing, septuplets and nested triplets, preserved extensions and every rhythm-pattern form.
- Every invariant has a passing and a failing example; a broken reference is reported, never crashes.
- Operations: each has an undo that restores the exact previous state; 1,000 random operation sequences (seeded) keep all invariants; compound operations undo in one step.
- Meter change: both modes on a test suite of 20 passages never change a pitch or delete an event; re-barring preserves every absolute onset and total duration; keep-bar-lines marks exactly the expected bars.
- Flattened timeline: a 3x repeated chorus edited once shows the change in all three instances; endings play the right bars on each pass; per-instance tempo overrides affect only their instance; pickups and `skipPickup` give the expected start times; tuplet onsets match rational calculation within one tick.
- Lyric anchors: every rule in the table in section 6 has a test, including emoji and accented text; deleting text never deletes a chord.
- Transposing a whole song through all 12 keys and back returns the original exactly; lyric text never changes.
- Loose chords fitted to bars keep their order.
- Import preservation: MusicXML with unsupported elements round-trips them back out unchanged; the import report lists every converted or preserved item.
- Migration from schema version 1 with a pre-migration copy; refusal of a newer version with no write; a failed migration leaves the original untouched.
- Import safety: archives with `..`, absolute paths, duplicate case-insensitive names, bad checksums, oversized entries or a missing manifest are rejected with nothing written; importing a song with an existing id creates a separate copy and leaves the original byte-identical; replacement requires confirmation and keeps a backup; kill-tests at every step of import, export and replacement leave the Songbook consistent.
- Recovery: killing the app mid-edit recovers changes made up to 2 seconds before; a recording interrupted mid-take is recovered as a playable file.
- Backings: generate, regenerate one part, add or remove an instrument and restore a variation each undo in one step; regenerating never changes a locked part or an edited event without confirmation; transposing a song transposes generated pitched parts exactly; a harmony change marks exactly the affected bars out of date; overlays apply only to their entry and pass.

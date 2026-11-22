# Shared composition model (Song Project)

Architecture only, 2026-11-22. **Not authorised for implementation.** This is the piece Jason asked to be examined most carefully: one model that lets chord progressions, lyrics, arrangements, TAB, standard notation, MIDI playback and recordings work together instead of becoming five separate systems.

## The core idea: one song, one timeline, one source of truth for each fact

Five systems become disconnected when each keeps its own copy of the same facts: its own bars, its own tempo, its own chords. This model gives every musical fact exactly one home and makes every tool a **view or editor of that one home**.

| Fact | Its one home | Everything else |
| --- | --- | --- |
| Section order (the form) | `arrangement` (a list of references to sections) | Performance sheet, playback order, printed lead sheet are calculated from it |
| Bars, time signature, tempo, key | Each section's **conductor** (its meter, tempo and key map) | Parts, harmony, lyrics timing and MIDI read it; they never store their own meter |
| Chords | Each section's **harmony track** (chord events on the bar grid) | Chords above lyrics, the Progression Workshop, Roman and Nashville numbers, chord diagrams and accompaniment playback are views of it |
| Lyrics | Each section's lyric lines | Chord positions in lyrics are links to harmony events, not copies of chords |
| Notes (TAB and notation) | Each section's **part clips** (events with pitches, optional string and fret) | TAB, notation, combined view, MIDI and playback highlighting are views of it |
| Audio | Files in `media/`, referenced by recordings | Waveforms, attachments to sections |
| Everything derived | Never stored | Roman numerals, Nashville numbers, capo shapes, MIDI, the flattened timeline, diagrams |

So a chorus played three times is one section referenced three times: correct one chord, one lyric or one TAB note in the chorus and every repeat changes. A variation ("Chorus, last time") is a duplicated section, made on purpose.

## Structure

```
SongProject
├── metadata           title, artist, credits, source (original | public domain | imported), tags, favourite, notes
├── defaults           key, tempo, time signature, capo, tuning, instruments
├── instruments[]      parts: guitar 1, bass, piano...  (instrument id, tuning, capo, display: tab | notation | both)
├── sections[]
│   ├── conductor      length in bars; meter, tempo and key changes at bar positions (defaults inherited)
│   ├── harmony[]      chord events: position, length, ChordSymbol, locked, origin
│   ├── lyrics[]       lines of text with chord anchors that point at harmony event ids
│   ├── clips[]        one per instrument part: voices of note/chord/rest events on the section's bars
│   └── recordings[]   references to takes, with an optional bar offset
├── arrangement[]      ordered entries: { sectionId, repeats, label? }
├── progressions[]     saved progressions not yet placed in the song (from the Workshop)
└── revision           number, saved at, note
```

### Positions and time

- A position is `{ bar, tick }` inside a section, with **960 ticks per quarter note**. Bars come only from the section's conductor, so every part, chord and lyric anchor sits on the same grid.
- The **flattened timeline** is calculated by walking the arrangement: each section instance gets a start tick and start time from the conductor's tempo map. Playback, MIDI export, the playhead and auto-scroll all use this one calculation.

### Harmony events

```ts
HarmonyEvent { id; at: { bar; tick } | null; length?: ticks; chord: ChordSymbol; locked: boolean;
               origin: 'user' | 'generated' | 'imported'; voicing?: shapeId }
ChordSymbol { root: Spelling; quality: string; bass?: Spelling }
```

- **Timed or loose.** A beginner can write chords over lyrics without thinking about bars. Those chords are *loose* (`at: null`), kept in order. "Fit to bars" (a guided step, or automatically when the section is sent to playback or the Arrangement Board) gives them positions. Nothing is lost either way, so the simple chords-and-lyrics workflow and the precise workflow share one model.
- `voicing` links to a catalog shape for diagrams and accompaniment; changing the voicing never changes the chord.
- `locked` and `origin` let the Progression Generator regenerate other chords without touching ones the user locked or edited (see creative-workstation.md, Chord Progression Generator).

### Lyrics

```ts
LyricLine { id; text: string; anchors: { at: number /* character index */; harmonyId: string }[] }
```

Moving a chord in the lyrics moves the anchor; editing lyric text adjusts anchor positions; transposing never touches text. When a melody part exists, syllables can also attach to melody note ids for notation lyrics.

### Part clips (TAB and notation)

```ts
Clip { instrumentId; voices: Voice[] }              // covers exactly the section's bars
Voice { events: Event[] }
Event { id; at: { bar; tick }; kind: 'note' | 'chord' | 'rest';
        duration: { base; dots; tuplet? }; notes: Note[];
        dynamics?; articulations?; techniques? }
Note { id; pitch: { midi; spelling }; string?; fret?; tie?; techniques?; bend?; finger? }
```

- **Pitch is authoritative; string and fret are a validated assignment.** Staff entry suggests positions (lowest stretch first) and the player can choose another; TAB or fretboard entry sets both.
- Each measure's durations must fill the conductor's time signature, or the measure is shown as incomplete. They are never silently padded.
- Tuning change: pitches are kept, assignments re-checked, impossible ones flagged. Transposition: pitches move with correct spelling for the new key, assignments re-suggested and flagged.

### Recordings

`{ id, file: 'media/take-3.wav', durationMs, sectionId?, offset?: { bar, tick }, note }`. With an offset, a take lines up with the section in playback; without one it is simply attached.

## Operations (shared by every editor)

Editors never change the model directly. They send **operations** (add chord, move event, set lyric text, transpose song, reorder arrangement...). One operation engine:

- applies the change and checks the invariants below;
- gives every editor the same **undo and redo** history (100 steps or more);
- emits the changes every open view needs, so the TAB view, notation view, Workshop and lyrics stay in sync without knowing about each other;
- feeds autosave and the crash-recovery journal.

## Invariants (checked after every operation and on load)

1. Every id is unique within the project; every reference (arrangement → section, anchor → harmony event, recording → file, voicing → shape) resolves, or is reported as a broken link with a repair choice.
2. Timed harmony events and clip events lie within their section's bars.
3. Clip measures match the conductor's time signatures; incomplete measures are marked, never altered.
4. No pitch is changed except by an explicit transpose or edit.
5. Locked harmony events change only by a direct user edit.
6. Derived data is never stored, so it can't go stale.

## Cross-tool flows

| Flow | What happens in the model |
| --- | --- |
| Workshop → song | A progression's chords become harmony events in a chosen section (new or existing), keeping their lock state and a link to the generator settings |
| Song → Workshop | A section's harmony opens in the Workshop as a progression; saving writes back to the section |
| Arrangement Board | Reorders, repeats or duplicates entries; section content is untouched |
| Reverse Chord Finder → song | The identified chord is added as a harmony event, optionally with the student's fingering as its voicing |
| TAB / notation | Edit clips on the section grid; the harmony track is shown above the staff for reference |
| Playback | Flatten the arrangement, convert clips to MIDI events, add an optional accompaniment generated from harmony (strum or block chords) for sections with no guitar part, schedule on the shared transport, and map sounding event ids back to the views for highlighting |
| Performance Mode | Reads lyrics, anchors and the arrangement; auto-scroll speed comes from the flattened timeline |
| MusicXML | Maps cleanly: parts and measures to clips, `<harmony>` to harmony events, `<lyric>` to lyrics; unsupported elements are listed |

## Storage

```
<student>/songs/<song-id>/
  project.json     the model above, versioned with migrations
  media/           audio files (never inside JSON)
  revisions/       saved versions
  autosave.json    crash-recovery journal
```

Owned by the student, enforced by Rust, written atomically, included in backups. Paths are relative to the song folder. An older app refuses a newer `schemaVersion` instead of damaging it. Export is the folder with a manifest and SHA-256 checksums.

## Why this design (and the alternatives rejected)

- **One linear score for the whole song** (the DAW approach) makes repeated sections copies, so a correction must be made several times and chords-over-lyrics writing becomes awkward. Rejected.
- **Separate files per tool** (lyrics file, TAB file, progression file) is exactly the five disconnected systems. Rejected.
- **Chords stored as text in lyrics** breaks transposition, playback and diagrams. Rejected.
- **Section-based clips on one shared conductor** keeps the form explicit, makes repeats free, keeps lyrics-first writing simple, and maps directly to MusicXML and MIDI. Chosen.

## Tests for the model (Stage 1)

- Round trip save → load → save is byte-stable for 20 varied sample projects.
- Every invariant has a passing and a failing example; a broken reference is reported, never crashes.
- Operations: each has undo that restores the exact previous state; 1,000 random operation sequences (seeded) keep all invariants.
- Transposing a whole song through all 12 keys and back returns the original exactly; lyric text never changes.
- Loose chords fitted to bars keep their order; a 3x repeated chorus edited once shows the change in all three instances of the flattened timeline.
- Migration from schema version 1, and refusal of a newer version.

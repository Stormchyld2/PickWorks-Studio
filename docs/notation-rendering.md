# Unified diagram rendering (architecture, 2026-11-22)

Status: **architecture decision, documented only.** First written as Phase 2 architecture; now scheduled in [master-roadmap.md](master-roadmap.md) as milestone **X0.7** (shared layouts and serializers), with the Chord Library uses at X1. Nothing here is built until Jason authorises that milestone. "Notation" in this document means chord boxes, fretboards and scale boxes, not staff notation (which belongs to the X5 editors in [creative-workstation.md](creative-workstation.md)). Printed pages become PDFs through the shared PDF writer ([android-platform.md](android-platform.md) section 3).

## Decision

Every chord diagram, scale diagram, fretboard exercise and printable fretboard is drawn by the app from data, as SVG, at the moment it's shown. No PNG or JPG is stored or downloaded for any individual diagram. The chord manifest (and, later, scale and exercise data) is the single source of truth, so one correction to a shape updates every lesson, practice exercise, Chord Library entry and printed page that uses it. Everything works offline because the data ships inside the app.

The rule for the code: **data → pure layout engine → thin renderer.** Layout engines are plain TypeScript with tests and decide every position, label and mirror. Renderers only draw what the layout says, so the screen, print and future Android views can never disagree.

## What exists today (inspected 2026-11-22)

| Piece | File | What it does now |
| --- | --- | --- |
| Chord shape model | `engines/chords/shape.ts` | Zod schema: id, root, quality, `tuningId`, frets per string (null = muted), fingers (1–4, T), barres, voicing note. Supports 4–12 strings. |
| Chord analysis | `engines/chords/shape.ts` → `analyzeShape` | Calculates every note, spelling and interval from the tuning; nothing is typed in by hand. |
| Chord validation | `engines/chords/shape.ts` → `validateShape` | Chord tones, root and 3rd present, fingering rules, barre consistency, 5-fret stretch, tuning match. |
| Chord diagram layout | `engines/chords/diagram.ts` → `chordDiagram` | Pure layout: base fret and nut, rows, open/muted markers, dots, barres. Labels: fingers, notes, intervals or none. Left-handed mirror. Assessment `conceal` hides the name and note labels. |
| Chord diagram renderer | `components/chord/ChordDiagram.svelte` | SVG with a `viewBox` (resolution-independent). `screen` variant uses the theme tokens with the root in amber; `print` variant is black and white with a hollow root. Used today only by the Fretboard Explorer Chords tab. |
| Starter library | `engines/chords/library.ts` | 27 shapes as data, all validated by tests. |
| Neck renderer | `components/fretboard/Fretboard.svelte` | Interactive SVG neck: any tuning and fret range, highlights with labels, focus string, left-handed mirror, keyboard roving focus, click to select. Used by Fretboard Explorer (Notes, Intervals, Chords, Scales) and the practice drills. |
| Scale placement | `engines/fretboard/scale-positions.ts` | Every place a scale's notes fall in a fret range, with interval labels and root flags. Feeds the Scales tab through the neck renderer. |
| Print worksheet | `engines/print/worksheet.ts` → `renderWorksheetSvg` | Builds black-and-white SVG pages (Letter, A4, Legal; 1–6 boards; 5, 12 or 24 frets; blank, all notes or anchor notes; left-handed). Tested, but not reachable in the app yet (Print Materials is "Coming soon"). |
| Tuning model | `engines/music-theory/tuning.ts` | Strings with open MIDI pitch and label. Only standard tuning is defined, but nothing assumes six strings or E-standard. |

No chord, scale or fretboard images exist in the repository today; every diagram is already generated.

## Reuse as is

- The chord shape model, `analyzeShape` and `validateShape`. They are already tuning-driven, which covers the "no hard-coded standard tuning" requirement.
- `chordDiagram` layout and `ChordDiagram.svelte`, including left-handed mirroring, the root highlight, the print variant and assessment concealment.
- `Fretboard.svelte` for every horizontal neck view, including exercises and full-neck scales.
- `scalePositions` for scale placement.
- The worksheet page layout (paper sizes, grid of boards, header, notes area) in `engines/print/worksheet.ts`.

## Extend

1. **Shape metadata.** Add level, family, movable flag, root string, movable fret range, suggested uses, review status, and an optional slash bass to the schema, as listed in the chord manifest. The 48 new shapes are added as data only.
2. **Transposition.** A pure `transposeShape(shape, newRoot)` for movable shapes: it moves every fretted note by the same number of frets along the root string, keeps fingers and barres, and refuses roots outside the shape's checked range. Transposed shapes are calculated, never stored. The Chord Library root picker calls it and passes the result to the same layout.
3. **Chord qualities.** Add maj9, m9, 13 and 7#9 to `music-theory/chords.ts`, and slash chords (the bass note is shown in the name, for example D/F#).
4. **Display modes.** Map the five modes (plus fret numbers, added with the [chord system](chord-system.md)) onto the existing options:

   | Mode | Layout labels | Renderer variant |
   | --- | --- | --- |
   | Basic | none (root still highlighted) | screen |
   | Beginner Fingering | fingers, plus a finger key under the diagram | screen |
   | Note Names | notes, including open-string notes under the open markers | screen |
   | Intervals | intervals, including open strings | screen |
   | Fret numbers | fret numbers (added for the Chord Library and the Chord Finder, where a student's own fingering has no finger numbers) | screen |
   | Print | the student's chosen label set | print (black and white) |

   Print is a variant rather than a label set, so a printed sheet can use fingers, notes or intervals. Open strings currently show only a circle; Note Names and Intervals need a label for them.
5. **Accessibility.** The SVG's accessible name currently gives only the chord name and starting fret. Extend it with a spoken summary (for example "C major: string 6 muted, string 5 fret 3 finger 3, ...") and keep `conceal` hiding answers in assessments.
6. **One renderer for print and export.** Today the screen neck (`Fretboard.svelte`) and the print neck (`worksheet.ts`) each have their own drawing code. X0.7 moves neck geometry into one pure `neckLayout()` used by both, so printed and on-screen boards always match. Chord and scale diagrams get a small SVG-string serializer of the same layout so Print Studio pages can place them without a second drawing system.
7. **Size and theme.** `ChordDiagram` takes a width and scales through its `viewBox`; add size presets (Library card, lesson inline, practice large, print grid) and keep all colours as theme tokens (screen) or pure black and white (print).

## New, on the same foundation

- **Scale box diagrams.** A vertical scale "position" diagram (like a chord box but with several dots per string) is the chord grid with no barres and many dots. `chordDiagram` is generalised into a shared `fretGrid` layout used by both chord shapes and scale patterns. Full-neck scales keep using `Fretboard.svelte`.
- **Scale pattern data.** Scale positions (for example the five pentatonic boxes) stored once as movable data, transposed the same way as chords.
- **Fretboard exercises.** Exercises describe what to mark (positions, labels, hidden answers) as data; the neck renderer draws them. Practice and lessons already work this way; printable exercise sheets use the same marks.
- **Blank printable fretboards.** Already generated by `worksheet.ts`; they move onto `neckLayout()` and become reachable when Print Studio is authorised.

## One system, every place

| Used in | Component |
| --- | --- |
| Chord Library (Chords tab) | `ChordDiagram` via `fretGrid`, root picker → `transposeShape` |
| Lessons | Same `ChordDiagram`, looked up by shape id; lesson files store ids, never drawings |
| Practice exercises | Same `ChordDiagram` and `Fretboard`, with `conceal` in assessments |
| Printable resources | Same layouts, `print` variant or the SVG serializer, inside the worksheet page layout |
| Android phones and tablets | Same components; sizes follow the shared breakpoints |

Because lessons and printables refer to shapes by stable id, correcting a shape in the manifest changes every use at once, and the review status travels with it.

## Instruments and tunings

Diagrams draw one column (grid) or one line (neck) per string in the tuning, so Drop D, Open G, Open D and DADGAD only need tuning definitions. A shape records the tuning it was written for and is validated against it. A later Instrument Definition (bass, ukulele, mandolin) plugs into the same tuning model.

## Tests (planned)

- Every manifest shape lays out without errors in all five modes, right- and left-handed.
- `transposeShape` at every root in each movable range gives notes that still pass `validateShape`, and the stored shape never changes.
- Left-handed layouts are exact mirrors and never change notes, fingers or labels.
- `conceal` never leaks the chord name or note labels in any mode.
- Print output is black and white only (as the worksheet test already checks).
- Screen and print layouts of the same board give identical geometry.
- Snapshot tests of the SVG for a small set of shapes, so accidental drawing changes show up in review.
- A Playwright check of the Chords tab, a lesson diagram and a print preview at 1280 px and phone width.

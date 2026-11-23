# Chord manifest review (approved 2026-11-23)

Jason approved chord decisions 13–16 and the 75-shape manifest on 2026-11-23. He gave these corrections:

- Em7 primary 0-2-2-0-3-0.
- Gmaj7 3-2-0-0-0-2 with fingers 3-2-0-0-0-1.
- Bm primary x-2-4-4-3-2.
- Cadd9 beginner primary x-3-2-0-3-3, with the low E muted.
- D/F#: keep both the thumb-over and the fingered version.
- C6 primary x-3-2-2-1-0.
- G9: the fifth-string-root voicing, once its exact frets and fingers are documented.
- Advanced A: the four-string version, once its exact frets and fingers are documented.

He also approved the other fingering choices proposed earlier, keeping useful alternatives. The approved data is in [chord-manifest.csv](chord-manifest.csv).

**Verification status: validated programmatically only, NOT user-verified.** No screen in the app shows the full library yet, so nobody has checked these shapes by eye. Visual verification by the Project Owner happens once the Chord Finder and Visual Chord Library exist. The `review` column records approval of the decisions, not visual verification.

**This is data only.** The chord catalog pipeline (X0.3, chord Stage 1) is not part of this change and has not started. The app still ships the original 27 shapes unchanged.

## How to read the file

- Strings run from low E (string 6) to high E (string 1).
- `x` is a muted string and `0` an open string.
- In `fingers`, 1 is the index finger, 2 the middle, 3 the ring, 4 the little finger and T the thumb. `–` means no finger.
- `role` is `primary` or `alternative`. The primary is the shape taught first; an alternative names its primary in `alternative_of`. Every primary is numbered 1 to 74 in `n`.
- `notes` and `bass` are calculated from the frets, never typed by hand.
- `review_note` records why a shape was changed or kept.

**Why 74 primaries.** All 75 shapes of the original manifest are kept. The earlier list had Bm twice: x 2 4 4 3 2, and the four-string x x 4 4 3 2. You chose x 2 4 4 3 2 as the Bm primary, so the four-string shape is now its alternative. That leaves 74 primary chord entries and 11 alternatives, 85 shapes in all.

## The newly documented shapes

| Chord | Frets | Fingers | Barre | Sounds (low to high) |
| --- | --- | --- | --- | --- |
| **G9**, fifth-string root (primary) | x 10 9 10 10 10 | – 2 1 3 3 3 | ring finger at fret 10, strings 3–1 | G(R) B(3) F(b7) A(9) D(5) |
| **A**, four-string Advanced (primary) | x x 2 2 2 5 | – – 1 1 1 4 | index finger at fret 2, strings 4–2 | E(5) A(R) C#(3) A(R): the 5th is in the bass |

The G9 is the C9 shape (`dom9-root5`) moved up to root fret 10. The four-string A is the top of the CAGED G shape. The full six-string G shape is kept as its alternative.

## Every change from the earlier manifest

| Entry | Primary now | Kept as alternative |
| --- | --- | --- |
| A | x 0 2 2 2 0, fingers 1-2-3 (unchanged) | fingers 2-3-4; one-finger barre |
| G | 3 2 0 0 0 3, fingers 2-1-3 (unchanged) | fingers 3-2-4, for changes to Cadd9 |
| Em7 | **0 2 2 0 3 0**, fingers – 1 2 – 3 – (new id `em7-open-full`) | 0 2 0 0 0 0 (keeps the shipped id `em7-open`) |
| B | x 2 4 4 4 2, index barre with fingers 2-3-4 (unchanged) | x 2 4 4 4 x, ring-finger mini-barre with string 1 muted |
| Bm | **x 2 4 4 3 2** (B in the bass) | x x 4 4 3 2 (F# in the bass) |
| Cadd9 (beginner) | **x 3 2 0 3 3**, low E muted (unchanged) | none |
| Dmaj7 | x x 0 2 2 2, **fingers 1-2-3** | one-finger barre |
| Gmaj7 | **3 2 0 0 0 2, fingers 3 2 – – – 1** (unchanged) | none |
| D/F# | 2 x 0 2 3 2, thumb on the F# | **fingered version kept**: 2 – – 1 4 3, finger 2 on the F#, which also mutes string 5 |
| G9 | **x 10 9 10 10 10** (new id `g9-root5`) | 3 x 3 4 3 5 (sixth-string root) |
| C6 | **x 3 2 2 1 0**, fingers – 4 2 3 1 – (new id `c6-open`) | x 3 5 5 5 5 (movable barre) |
| A (Advanced) | **x x 2 2 2 5** (new id `caged-g-shape-four-string`) | 5 4 2 2 2 5 (full G shape) |

**Accepted as they were:** F (small), Am/G, C9, G13, Cdim7 (named from the chosen root) and the 8th-fret C (labelled as the first inversion). The movable Cadd9 x 3 2 x 3 3 was also kept, with finger 1 lightly touching string 3 to mute it.

## Corrections found while validating

- **E7#9 spelling.** The #9 above E is F## (F double-sharp). The earlier manifest wrote G, which is the same pitch. The stored spelling now follows the theory engine; screens may show G for readability.
- **C9 note.** The ring-finger barre covers strings 3–1, not 4–1 as the earlier note said. String 4 is fret 2 with finger 1. The shape itself was right.
- **Shipped shapes keep their ids.** The app has shipped `em7-open` (0 2 0 0 0 0) since Phase 1, so that id stays on that shape, now an alternative. The approved Em7 primary has a new id, so nothing saved under the old id changes meaning. The same rule gave new ids to the new G9, C6 and four-string A.

## Validation

`tests/content/chord-manifest.test.ts` checks every row (85 shapes) and runs in `npm test` and CI.

**Names and formulas.** The formula must match the chord name, for example `maj7` means R 3 5 7. Am/G is taught as Am7 with G in the bass.

**Notes, intervals, bass and root string.** These are recalculated from the frets in standard tuning, independently of the stored text, and must match it exactly:
- Every sounding string must be a chord tone.
- The root and the defining 3rd (or the 2nd or 4th in sus chords) must sound.
- A slash chord's bass must be its named note.
- Any other non-root bass must be labelled, as an inversion or with a note.

**Playable fingerings:**
- An open or muted string has no finger.
- Every fretted string has one finger.
- No finger is on two frets.
- One finger covers two strings only on a documented barre, and every string under a barre is at or above it.
- Lower-numbered fingers never sit on a higher fret than higher-numbered ones.
- The stretch is no wider than 5 frets.

**Cross-checks:**
- Every shape whose chord quality the app already knows is also run through the app's own `validateShape()`. That covers 81 of the 85 shapes. The other four (Cmaj9, Cm9, G13 and E7#9) use qualities the theory engine doesn't have yet; those arrive with X0.2.
- The 27 shapes the app ships today match the manifest exactly, frets and fingers, under the same ids.
- A negative test confirms the checks catch the mistakes they target: an unmuted low E, a wrong name, a wrong note, a missing barre, crossed fingers, and an unlabelled inversion.

Result: all rows pass, and `validateShape()` reports no problems for any shape it can check.

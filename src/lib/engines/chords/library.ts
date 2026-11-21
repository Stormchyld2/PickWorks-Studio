/**
 * Bundled starter chord shapes for standard tuning. Every shape is validated
 * by the tests against its chord. This is a provisional first set; the
 * release chord library scope is still an open decision (Planning Update 02).
 */
import { chordShapeSchema, type ChordShape } from './shape';

type Raw = [id: string, root: string, quality: string, frets: (number | null)[], fingers: (1 | 2 | 3 | 4 | null)[], barres?: ChordShape['barres'], voicing?: string];

const x = null;

const RAW: Raw[] = [
  ['c-major-open', 'C', 'major', [x, 3, 2, 0, 1, 0], [x, 3, 2, x, 1, x]],
  ['a-major-open', 'A', 'major', [x, 0, 2, 2, 2, 0], [x, x, 1, 2, 3, x]],
  ['g-major-open', 'G', 'major', [3, 2, 0, 0, 0, 3], [2, 1, x, x, x, 3]],
  ['e-major-open', 'E', 'major', [0, 2, 2, 1, 0, 0], [x, 2, 3, 1, x, x]],
  ['d-major-open', 'D', 'major', [x, x, 0, 2, 3, 2], [x, x, x, 1, 3, 2]],
  ['a-minor-open', 'A', 'minor', [x, 0, 2, 2, 1, 0], [x, x, 2, 3, 1, x]],
  ['e-minor-open', 'E', 'minor', [0, 2, 2, 0, 0, 0], [x, 2, 3, x, x, x]],
  ['d-minor-open', 'D', 'minor', [x, x, 0, 2, 3, 1], [x, x, x, 2, 3, 1]],
  ['a7-open', 'A', 'dominant7', [x, 0, 2, 0, 2, 0], [x, x, 2, x, 3, x]],
  ['b7-open', 'B', 'dominant7', [x, 2, 1, 2, 0, 2], [x, 2, 1, 3, x, 4]],
  ['c7-open', 'C', 'dominant7', [x, 3, 2, 3, 1, 0], [x, 3, 2, 4, 1, x]],
  ['d7-open', 'D', 'dominant7', [x, x, 0, 2, 1, 2], [x, x, x, 2, 1, 3]],
  ['e7-open', 'E', 'dominant7', [0, 2, 0, 1, 0, 0], [x, 2, x, 1, x, x]],
  ['g7-open', 'G', 'dominant7', [3, 2, 0, 0, 0, 1], [3, 2, x, x, x, 1]],
  ['am7-open', 'A', 'minor7', [x, 0, 2, 0, 1, 0], [x, x, 2, x, 1, x]],
  ['em7-open', 'E', 'minor7', [0, 2, 0, 0, 0, 0], [x, 2, x, x, x, x]],
  ['dm7-open', 'D', 'minor7', [x, x, 0, 2, 1, 1], [x, x, x, 2, 1, 1], [{ fret: 1, fromString: 2, toString: 1, finger: 1 }]],
  ['cmaj7-open', 'C', 'major7', [x, 3, 2, 0, 0, 0], [x, 3, 2, x, x, x]],
  ['fmaj7-open', 'F', 'major7', [x, x, 3, 2, 1, 0], [x, x, 3, 2, 1, x]],
  ['amaj7-open', 'A', 'major7', [x, 0, 2, 1, 2, 0], [x, x, 2, 1, 3, x]],
  ['dsus2-open', 'D', 'sus2', [x, x, 0, 2, 3, 0], [x, x, x, 1, 3, x]],
  ['dsus4-open', 'D', 'sus4', [x, x, 0, 2, 3, 3], [x, x, x, 1, 2, 3]],
  ['asus2-open', 'A', 'sus2', [x, 0, 2, 2, 0, 0], [x, x, 1, 2, x, x]],
  ['asus4-open', 'A', 'sus4', [x, 0, 2, 2, 3, 0], [x, x, 1, 2, 3, x]],
  ['e5-power', 'E', 'power', [0, 2, 2, x, x, x], [x, 1, 2, x, x, x]],
  ['f-major-barre-e', 'F', 'major', [1, 3, 3, 2, 1, 1], [1, 3, 4, 2, 1, 1], [{ fret: 1, fromString: 6, toString: 1, finger: 1 }], 'E-shape barre'],
  ['b-minor-barre-a', 'B', 'minor', [x, 2, 4, 4, 3, 2], [x, 1, 3, 4, 2, 1], [{ fret: 2, fromString: 5, toString: 1, finger: 1 }], 'A-shape barre'],
];

export const STARTER_CHORDS: readonly ChordShape[] = RAW.map(([id, root, quality, frets, fingers, barres = [], voicing]) =>
  chordShapeSchema.parse({ id, root, quality, tuningId: 'standard', frets, fingers, barres, voicing }),
);

export function findChord(id: string): ChordShape | undefined {
  return STARTER_CHORDS.find((c) => c.id === id);
}

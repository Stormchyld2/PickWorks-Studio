import { toPitchClass, type PitchClass } from './notes';

export interface IntervalInfo {
  semitones: number;
  /** Short label used on the fretboard, e.g. "R", "b3", "5". */
  short: string;
  name: string;
}

/** Simple intervals within one octave, by semitone count. */
export const INTERVALS: readonly IntervalInfo[] = [
  { semitones: 0, short: 'R', name: 'Unison / Root' },
  { semitones: 1, short: 'b2', name: 'Minor 2nd' },
  { semitones: 2, short: '2', name: 'Major 2nd' },
  { semitones: 3, short: 'b3', name: 'Minor 3rd' },
  { semitones: 4, short: '3', name: 'Major 3rd' },
  { semitones: 5, short: '4', name: 'Perfect 4th' },
  { semitones: 6, short: 'b5', name: 'Tritone' },
  { semitones: 7, short: '5', name: 'Perfect 5th' },
  { semitones: 8, short: 'b6', name: 'Minor 6th' },
  { semitones: 9, short: '6', name: 'Major 6th' },
  { semitones: 10, short: 'b7', name: 'Minor 7th' },
  { semitones: 11, short: '7', name: 'Major 7th' },
];

/** Ascending distance in semitones from root to note, 0..11. */
export function intervalBetween(root: PitchClass, note: PitchClass): number {
  return toPitchClass(note - root);
}

export function intervalInfo(root: PitchClass, note: PitchClass): IntervalInfo {
  return INTERVALS[intervalBetween(root, note)];
}

/** Half step = 1 semitone = 1 fret; whole step = 2. */
export const HALF_STEP = 1;
export const WHOLE_STEP = 2;

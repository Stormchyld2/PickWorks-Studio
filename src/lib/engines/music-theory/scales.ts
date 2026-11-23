/**
 * Scale definitions as interval data. Notes and fretboard positions are
 * always calculated from these with the note engine, never typed by hand.
 */
import { intervalBetween } from './intervals';
import { formatSpelling, spellingToPitchClass, toPitchClass, type PitchClass, type Spelling } from './notes';
import { spellAbove } from './spelling';

export interface ScaleDefinition {
  id: string;
  name: string;
  /** Semitones above the root, ascending, starting with 0. */
  intervals: readonly number[];
  /** Letter steps above the root for each note (spelling); omitted for scales with no one-letter-per-note spelling. */
  degrees?: readonly number[];
  /** Interval labels for each note, e.g. "R", "b3". */
  labels: readonly string[];
}

const SEVEN = [0, 1, 2, 3, 4, 5, 6];

export const SCALES: readonly ScaleDefinition[] = [
  { id: 'major', name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11], degrees: SEVEN, labels: ['R', '2', '3', '4', '5', '6', '7'] },
  { id: 'natural-minor', name: 'Natural Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10], degrees: SEVEN, labels: ['R', '2', 'b3', '4', '5', 'b6', 'b7'] },
  { id: 'harmonic-minor', name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11], degrees: SEVEN, labels: ['R', '2', 'b3', '4', '5', 'b6', '7'] },
  { id: 'melodic-minor', name: 'Melodic Minor (ascending)', intervals: [0, 2, 3, 5, 7, 9, 11], degrees: SEVEN, labels: ['R', '2', 'b3', '4', '5', '6', '7'] },
  { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], degrees: SEVEN, labels: ['R', '2', 'b3', '4', '5', '6', 'b7'] },
  { id: 'phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], degrees: SEVEN, labels: ['R', 'b2', 'b3', '4', '5', 'b6', 'b7'] },
  { id: 'lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], degrees: SEVEN, labels: ['R', '2', '3', '#4', '5', '6', '7'] },
  { id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], degrees: SEVEN, labels: ['R', '2', '3', '4', '5', '6', 'b7'] },
  { id: 'locrian', name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], degrees: SEVEN, labels: ['R', 'b2', 'b3', '4', 'b5', 'b6', 'b7'] },
  { id: 'major-pentatonic', name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9], degrees: [0, 1, 2, 4, 5], labels: ['R', '2', '3', '5', '6'] },
  { id: 'minor-pentatonic', name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10], degrees: [0, 2, 3, 4, 6], labels: ['R', 'b3', '4', '5', 'b7'] },
  { id: 'blues', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10], degrees: [0, 2, 3, 4, 4, 6], labels: ['R', 'b3', '4', 'b5', '5', 'b7'] },
  { id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], labels: ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'] },
];

export function getScale(id: string): ScaleDefinition {
  const s = SCALES.find((x) => x.id === id);
  if (!s) throw new RangeError(`Unknown scale "${id}"`);
  return s;
}

export function scalePitchClasses(root: PitchClass, scale: ScaleDefinition): PitchClass[] {
  return scale.intervals.map((i) => toPitchClass(root + i));
}

/**
 * Correctly spelled note names, e.g. F major gives Bb (not A#), and
 * D# harmonic minor gives C## for its 7th. Falls back to plain sharp/flat
 * names for scales without a letter-per-note spelling (chromatic).
 */
export function spellScale(root: Spelling, scale: ScaleDefinition): string[] {
  return scale.intervals.map((semi, i) => {
    const s = scale.degrees ? spellAbove(root, semi, scale.degrees[i]) : null;
    if (s) return formatSpelling(s);
    const pc = toPitchClass(spellingToPitchClass(root) + semi);
    return noteFallback(pc, root.accidental < 0);
  });
}

function noteFallback(pc: PitchClass, flats: boolean): string {
  const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flat = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  return (flats ? flat : sharps)[pc];
}

/** Interval label for a pitch class within a scale, or null if it isn't in the scale. */
export function scaleDegreeLabel(root: PitchClass, scale: ScaleDefinition, pc: PitchClass): string | null {
  const i = scale.intervals.indexOf(intervalBetween(root, pc));
  return i < 0 ? null : scale.labels[i];
}

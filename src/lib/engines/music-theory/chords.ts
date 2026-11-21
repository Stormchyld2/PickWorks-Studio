/**
 * Chord qualities as interval data. Chord tones and their names are always
 * calculated from these, never typed by hand (Planning Update 02).
 */
import { formatSpelling, toPitchClass, type PitchClass, type Spelling } from './notes';
import { spellAbove } from './spelling';

export interface ChordQuality {
  id: string;
  /** Suffix after the root, e.g. "" (major), "m", "7", "maj7". */
  symbol: string;
  name: string;
  /** Semitones above the root. */
  intervals: readonly number[];
  /** Letter steps above the root for spelling (0 root, 2 third, 4 fifth, 6 seventh...). */
  degrees: readonly number[];
  labels: readonly string[];
}

export const CHORD_QUALITIES: readonly ChordQuality[] = [
  { id: 'major', symbol: '', name: 'Major', intervals: [0, 4, 7], degrees: [0, 2, 4], labels: ['R', '3', '5'] },
  { id: 'minor', symbol: 'm', name: 'Minor', intervals: [0, 3, 7], degrees: [0, 2, 4], labels: ['R', 'b3', '5'] },
  { id: 'diminished', symbol: 'dim', name: 'Diminished', intervals: [0, 3, 6], degrees: [0, 2, 4], labels: ['R', 'b3', 'b5'] },
  { id: 'augmented', symbol: 'aug', name: 'Augmented', intervals: [0, 4, 8], degrees: [0, 2, 4], labels: ['R', '3', '#5'] },
  { id: 'sus2', symbol: 'sus2', name: 'Suspended 2nd', intervals: [0, 2, 7], degrees: [0, 1, 4], labels: ['R', '2', '5'] },
  { id: 'sus4', symbol: 'sus4', name: 'Suspended 4th', intervals: [0, 5, 7], degrees: [0, 3, 4], labels: ['R', '4', '5'] },
  { id: 'power', symbol: '5', name: 'Power chord', intervals: [0, 7], degrees: [0, 4], labels: ['R', '5'] },
  { id: 'dominant7', symbol: '7', name: 'Dominant 7th', intervals: [0, 4, 7, 10], degrees: [0, 2, 4, 6], labels: ['R', '3', '5', 'b7'] },
  { id: 'major7', symbol: 'maj7', name: 'Major 7th', intervals: [0, 4, 7, 11], degrees: [0, 2, 4, 6], labels: ['R', '3', '5', '7'] },
  { id: 'minor7', symbol: 'm7', name: 'Minor 7th', intervals: [0, 3, 7, 10], degrees: [0, 2, 4, 6], labels: ['R', 'b3', '5', 'b7'] },
  { id: 'half-diminished', symbol: 'm7b5', name: 'Half-diminished', intervals: [0, 3, 6, 10], degrees: [0, 2, 4, 6], labels: ['R', 'b3', 'b5', 'b7'] },
  { id: 'diminished7', symbol: 'dim7', name: 'Diminished 7th', intervals: [0, 3, 6, 9], degrees: [0, 2, 4, 6], labels: ['R', 'b3', 'b5', 'bb7'] },
  { id: 'major6', symbol: '6', name: 'Major 6th', intervals: [0, 4, 7, 9], degrees: [0, 2, 4, 5], labels: ['R', '3', '5', '6'] },
  { id: 'minor6', symbol: 'm6', name: 'Minor 6th', intervals: [0, 3, 7, 9], degrees: [0, 2, 4, 5], labels: ['R', 'b3', '5', '6'] },
  { id: 'add9', symbol: 'add9', name: 'Added 9th', intervals: [0, 4, 7, 2], degrees: [0, 2, 4, 1], labels: ['R', '3', '5', '9'] },
  { id: 'dominant9', symbol: '9', name: 'Dominant 9th', intervals: [0, 4, 7, 10, 2], degrees: [0, 2, 4, 6, 1], labels: ['R', '3', '5', 'b7', '9'] },
];

export function getChordQuality(id: string): ChordQuality {
  const q = CHORD_QUALITIES.find((x) => x.id === id);
  if (!q) throw new RangeError(`Unknown chord quality "${id}"`);
  return q;
}

export function chordPitchClasses(root: PitchClass, quality: ChordQuality): PitchClass[] {
  return quality.intervals.map((i) => toPitchClass(root + i));
}

/** Chord symbol, e.g. "C", "F#m", "Bbmaj7". */
export function chordSymbol(root: Spelling, quality: ChordQuality, unicode = false): string {
  return formatSpelling(root, unicode) + quality.symbol;
}

/** Correctly spelled chord tones, e.g. Eb major gives Eb G Bb. */
export function spellChord(root: Spelling, quality: ChordQuality): string[] {
  return quality.intervals.map((semi, i) => {
    const s = spellAbove(root, semi, quality.degrees[i]);
    if (!s) throw new RangeError(`Can't spell ${chordSymbol(root, quality)} with single or double accidentals`);
    return formatSpelling(s);
  });
}

/** Interval label of a pitch class within a chord, or null if it isn't a chord tone. */
export function chordToneLabel(root: PitchClass, quality: ChordQuality, pc: PitchClass): string | null {
  const i = quality.intervals.findIndex((semi) => toPitchClass(root + semi) === pc);
  return i < 0 ? null : quality.labels[i];
}

import { toPitchClass, type PitchClass } from './notes';

export interface GuitarString {
  /** Guitar convention: 1 = thinnest (high E), 6 = thickest (low E). */
  number: number;
  /** MIDI pitch of the open string. */
  openMidi: number;
  /** Display label, e.g. "E", "A". */
  label: string;
}

export interface Tuning {
  id: string;
  name: string;
  /** Ordered by string number, 1 first. */
  strings: readonly GuitarString[];
}

/** Standard tuning, low to high: E2 A2 D3 G3 B3 E4. */
export const STANDARD_TUNING: Tuning = {
  id: 'standard',
  name: 'Standard Tuning',
  strings: [
    { number: 1, openMidi: 64, label: 'E' },
    { number: 2, openMidi: 59, label: 'B' },
    { number: 3, openMidi: 55, label: 'G' },
    { number: 4, openMidi: 50, label: 'D' },
    { number: 5, openMidi: 45, label: 'A' },
    { number: 6, openMidi: 40, label: 'E' },
  ],
};

export function getString(tuning: Tuning, stringNumber: number): GuitarString {
  const s = tuning.strings.find((x) => x.number === stringNumber);
  if (!s) throw new RangeError(`Tuning "${tuning.id}" has no string ${stringNumber}`);
  return s;
}

export function openStringPitchClass(tuning: Tuning, stringNumber: number): PitchClass {
  return toPitchClass(getString(tuning, stringNumber).openMidi);
}

/** Ordinal name used in instructions, e.g. 5 -> "5th". */
export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

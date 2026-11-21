/**
 * Core pitch and spelling model.
 *
 * Distinguishes between:
 * - pitch class: 0..11, C = 0 (what a note "is", ignoring octave and spelling)
 * - spelling: letter + accidental (C#, Db), the name a note is written with
 * - pitch: a MIDI note number, which fixes both pitch class and octave
 *   (scientific pitch notation: MIDI 60 = C4, MIDI 40 = E2)
 */

export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
/** -2 = double flat, -1 = flat, 0 = natural, 1 = sharp, 2 = double sharp */
export type Accidental = -2 | -1 | 0 | 1 | 2;
export type AccidentalPreference = 'sharp' | 'flat';

export interface Spelling {
  letter: Letter;
  accidental: Accidental;
}

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Pitch class of each natural letter. */
export const LETTER_PITCH_CLASS: Readonly<Record<Letter, PitchClass>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const ACCIDENTAL_SYMBOL: Readonly<Record<Accidental, string>> = {
  [-2]: 'bb',
  [-1]: 'b',
  0: '',
  1: '#',
  2: '##',
};

/** Normalises any integer to a pitch class 0..11. */
export function toPitchClass(n: number): PitchClass {
  if (!Number.isInteger(n)) throw new RangeError(`Pitch must be an integer, got ${n}`);
  return (((n % 12) + 12) % 12) as PitchClass;
}

export function spellingToPitchClass(s: Spelling): PitchClass {
  return toPitchClass(LETTER_PITCH_CLASS[s.letter] + s.accidental);
}

/** True for C, D, E, F, G, A, B. */
export function isNatural(pc: PitchClass): boolean {
  return LETTERS.some((l) => LETTER_PITCH_CLASS[l] === pc);
}

/**
 * Default spelling for a pitch class: naturals stay natural, the five
 * black-key notes use a sharp or a flat depending on preference.
 */
export function spell(pc: PitchClass, preference: AccidentalPreference = 'sharp'): Spelling {
  const natural = LETTERS.find((l) => LETTER_PITCH_CLASS[l] === pc);
  if (natural) return { letter: natural, accidental: 0 };
  if (preference === 'sharp') {
    const below = LETTERS.find((l) => LETTER_PITCH_CLASS[l] === toPitchClass(pc - 1));
    return { letter: below as Letter, accidental: 1 };
  }
  const above = LETTERS.find((l) => LETTER_PITCH_CLASS[l] === toPitchClass(pc + 1));
  return { letter: above as Letter, accidental: -1 };
}

/** Every common spelling (single accidental or natural) of a pitch class. */
export function enharmonicSpellings(pc: PitchClass): Spelling[] {
  const result: Spelling[] = [];
  for (const letter of LETTERS) {
    for (const accidental of [-1, 0, 1] as const) {
      if (toPitchClass(LETTER_PITCH_CLASS[letter] + accidental) === pc) {
        result.push({ letter, accidental });
      }
    }
  }
  return result;
}

export function formatSpelling(s: Spelling, unicode = false): string {
  const symbol = ACCIDENTAL_SYMBOL[s.accidental];
  if (!unicode) return s.letter + symbol;
  return s.letter + symbol.replace(/#/g, '♯').replace(/b/g, '♭');
}

/** Formats a pitch class using the default spelling for the preference. */
export function noteName(pc: PitchClass, preference: AccidentalPreference = 'sharp'): string {
  return formatSpelling(spell(pc, preference));
}

/** Parses "C", "c#", "Db", "F##", "Bbb", or the Unicode ♯/♭ forms. */
export function parseSpelling(text: string): Spelling {
  const match = /^([A-Ga-g])(##|#|bb|b|♯|♭|)$/.exec(text.trim());
  if (!match) throw new SyntaxError(`Not a note name: "${text}"`);
  const letter = match[1].toUpperCase() as Letter;
  const acc = match[2];
  const accidental: Accidental =
    acc === '##' ? 2 : acc === '#' || acc === '♯' ? 1 : acc === 'bb' ? -2 : acc === 'b' || acc === '♭' ? -1 : 0;
  return { letter, accidental };
}

export function parsePitchClass(text: string): PitchClass {
  return spellingToPitchClass(parseSpelling(text));
}

/** Octave number in scientific pitch notation (MIDI 60 = C4). */
export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** e.g. 45 -> "A2". Uses the default spelling for the preference. */
export function pitchName(midi: number, preference: AccidentalPreference = 'sharp'): string {
  return `${noteName(toPitchClass(midi), preference)}${octaveOf(midi)}`;
}

/** Equal-tempered frequency, A4 (MIDI 69) = 440 Hz by default. */
export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** Nearest MIDI note and the offset from it in cents. */
export function frequencyToMidi(hz: number, a4 = 440): { midi: number; cents: number } {
  if (!(hz > 0)) throw new RangeError(`Frequency must be positive, got ${hz}`);
  const exact = 69 + 12 * Math.log2(hz / a4);
  const midi = Math.round(exact);
  return { midi, cents: (exact - midi) * 100 };
}

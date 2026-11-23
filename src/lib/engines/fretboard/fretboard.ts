import {
  octaveOf,
  toPitchClass,
  type PitchClass,
} from '../music-theory/notes';
import { getString, type Tuning } from '../music-theory/tuning';

/** A place on the neck. `fret` 0 = open string. */
export interface FretPosition {
  string: number;
  fret: number;
}

/** A position resolved to its sounding pitch. */
export interface ResolvedPosition extends FretPosition {
  midi: number;
  pitchClass: PitchClass;
  octave: number;
}

export interface FretRange {
  minFret: number;
  maxFret: number;
}

export const MAX_SUPPORTED_FRET = 24;

/** Single-dot inlays; 12 and 24 carry double dots. */
export const SINGLE_MARKER_FRETS: readonly number[] = [3, 5, 7, 9, 15, 17, 19, 21];
export const DOUBLE_MARKER_FRETS: readonly number[] = [12, 24];

export function markerAt(fret: number): 'none' | 'single' | 'double' {
  if (DOUBLE_MARKER_FRETS.includes(fret)) return 'double';
  if (SINGLE_MARKER_FRETS.includes(fret)) return 'single';
  return 'none';
}

function assertFret(fret: number): void {
  if (!Number.isInteger(fret) || fret < 0 || fret > MAX_SUPPORTED_FRET) {
    throw new RangeError(`Fret must be an integer from 0 to ${MAX_SUPPORTED_FRET}, got ${fret}`);
  }
}

/** Sounding MIDI pitch at a position, calculated from the tuning. */
export function midiAt(tuning: Tuning, pos: FretPosition): number {
  assertFret(pos.fret);
  return getString(tuning, pos.string).openMidi + pos.fret;
}

export function resolve(tuning: Tuning, pos: FretPosition): ResolvedPosition {
  const midi = midiAt(tuning, pos);
  return { ...pos, midi, pitchClass: toPitchClass(midi), octave: octaveOf(midi) };
}

export function samePosition(a: FretPosition, b: FretPosition): boolean {
  return a.string === b.string && a.fret === b.fret;
}

/** Every position on the board, strings in tuning order, frets ascending. */
export function allPositions(tuning: Tuning, range: FretRange): ResolvedPosition[] {
  assertFret(range.minFret);
  assertFret(range.maxFret);
  const out: ResolvedPosition[] = [];
  for (const s of tuning.strings) {
    for (let fret = range.minFret; fret <= range.maxFret; fret++) {
      out.push(resolve(tuning, { string: s.number, fret }));
    }
  }
  return out;
}

/** All positions of a pitch class (any octave) within the range. */
export function positionsOfPitchClass(tuning: Tuning, pc: PitchClass, range: FretRange): ResolvedPosition[] {
  return allPositions(tuning, range).filter((p) => p.pitchClass === pc);
}

/** All positions that sound exactly this pitch (unisons). */
export function positionsOfMidi(tuning: Tuning, midi: number, range: FretRange): ResolvedPosition[] {
  return allPositions(tuning, range).filter((p) => p.midi === midi);
}

/** Positions of a pitch class on one string within the range. */
export function positionsOnString(
  tuning: Tuning,
  stringNumber: number,
  pc: PitchClass,
  range: FretRange,
): ResolvedPosition[] {
  return positionsOfPitchClass(tuning, pc, range).filter((p) => p.string === stringNumber);
}

/** Positions that are the same pitch class but a different octave or place: the octave map from a position. */
export function octavesOf(tuning: Tuning, pos: FretPosition, range: FretRange): ResolvedPosition[] {
  const origin = resolve(tuning, pos);
  return positionsOfPitchClass(tuning, origin.pitchClass, range).filter((p) => !samePosition(p, pos));
}

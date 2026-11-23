import { frequencyToMidi, midiToFrequency, octaveOf, noteName, toPitchClass } from '../../music-theory/notes';
import type { GuitarString, Tuning } from '../../music-theory/tuning';

/** Cents from target to measured frequency. Positive = sharp. */
export function centsOff(frequency: number, targetMidi: number, a4 = 440): number {
  return 1200 * Math.log2(frequency / midiToFrequency(targetMidi, a4));
}

export interface ChromaticReading {
  midi: number;
  name: string;
  octave: number;
  cents: number;
  frequency: number;
}

/** Nearest equal-tempered note to a frequency. */
export function chromaticReading(frequency: number, a4 = 440): ChromaticReading {
  const { midi, cents } = frequencyToMidi(frequency, a4);
  return { midi, name: noteName(toPitchClass(midi)), octave: octaveOf(midi), cents, frequency };
}

/** The string whose open pitch is closest (in cents) to the frequency: automatic string detection. */
export function nearestString(tuning: Tuning, frequency: number, a4 = 440): GuitarString {
  let best = tuning.strings[0];
  let bestDist = Infinity;
  for (const s of tuning.strings) {
    const d = Math.abs(centsOff(frequency, s.openMidi, a4));
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

export type TuneDirection = 'in-tune' | 'raise' | 'lower';

export interface GuidedAdvice {
  direction: TuneDirection;
  message: string;
}

/**
 * Beginner instructions for guided mode. Large positive errors get an extra
 * warning, since over-tightening is how strings break.
 */
export function guidedAdvice(cents: number, toleranceCents: number): GuidedAdvice {
  if (Math.abs(cents) <= toleranceCents) return { direction: 'in-tune', message: 'In tune' };
  if (cents < -100) return { direction: 'raise', message: 'Much too low. Tighten gradually and re-check often.' };
  if (cents < 0) return { direction: 'raise', message: 'Too low. Tighten slightly.' };
  if (cents > 100)
    return { direction: 'lower', message: 'Much too high. Loosen now, and check you are tuning the right string.' };
  return { direction: 'lower', message: 'Too high. Loosen slightly.' };
}

export const DEFAULT_TOLERANCE_CENTS = 5;
export const PRECISE_TOLERANCE_CENTS = 2;
export const DEFAULT_A4 = 440;
export const A4_CHOICES: readonly number[] = [430, 432, 435, 438, 439, 440, 441, 442, 443, 444, 445, 446];

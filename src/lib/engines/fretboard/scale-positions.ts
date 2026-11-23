import { scaleDegreeLabel, type ScaleDefinition } from '../music-theory/scales';
import type { PitchClass } from '../music-theory/notes';
import type { Tuning } from '../music-theory/tuning';
import { allPositions, type FretRange, type ResolvedPosition } from './fretboard';

export interface ScalePosition extends ResolvedPosition {
  /** Interval label within the scale, e.g. "R", "b3". */
  label: string;
  isRoot: boolean;
}

/** Every place a scale's notes fall on the neck within a fret range. */
export function scalePositions(tuning: Tuning, root: PitchClass, scale: ScaleDefinition, range: FretRange): ScalePosition[] {
  return allPositions(tuning, range).flatMap((p) => {
    const label = scaleDegreeLabel(root, scale, p.pitchClass);
    return label === null ? [] : [{ ...p, label, isRoot: label === 'R' }];
  });
}

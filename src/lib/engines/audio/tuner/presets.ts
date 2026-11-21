import type { Tuning } from '../../music-theory/tuning';
import { STANDARD_TUNING } from '../../music-theory/tuning';
import { parsePitchClass } from '../../music-theory/notes';

export interface TuningPreset extends Tuning {
  /** Short description for the picker, low to high. */
  notes: string;
  /** Shown in the tuner's preset dropdown. Others are defined for lessons and later use. */
  inPicker: boolean;
}

/** Builds a tuning from open-string MIDI pitches listed low (6th) to high (1st). */
function preset(id: string, name: string, lowToHigh: [number, string][], inPicker: boolean): TuningPreset {
  const strings = lowToHigh
    .map(([openMidi, label], i) => ({ number: 6 - i, openMidi, label }))
    .sort((a, b) => a.number - b.number);
  return { id, name, strings, notes: lowToHigh.map(([, l]) => l).join(' '), inPicker };
}

export const TUNING_PRESETS: readonly TuningPreset[] = [
  { ...STANDARD_TUNING, name: 'Standard', notes: 'E A D G B E', inPicker: true },
  preset('drop-d', 'Drop D', [[38, 'D'], [45, 'A'], [50, 'D'], [55, 'G'], [59, 'B'], [64, 'E']], true),
  preset('half-step-down', 'Half-Step Down', [[39, 'Eb'], [44, 'Ab'], [49, 'Db'], [54, 'Gb'], [58, 'Bb'], [63, 'Eb']], true),
  preset('open-g', 'Open G', [[38, 'D'], [43, 'G'], [50, 'D'], [55, 'G'], [59, 'B'], [62, 'D']], true),
  preset('whole-step-down', 'Whole-Step Down', [[38, 'D'], [43, 'G'], [48, 'C'], [53, 'F'], [57, 'A'], [62, 'D']], false),
  preset('open-d', 'Open D', [[38, 'D'], [45, 'A'], [50, 'D'], [54, 'F#'], [57, 'A'], [62, 'D']], false),
  preset('dadgad', 'DADGAD', [[38, 'D'], [45, 'A'], [50, 'D'], [55, 'G'], [57, 'A'], [62, 'D']], false),
];

export const DEFAULT_TUNING_ID = 'standard';

export function getPreset(id: string): TuningPreset {
  const p = TUNING_PRESETS.find((t) => t.id === id);
  if (!p) throw new RangeError(`Unknown tuning preset "${id}"`);
  return p;
}

export interface CustomTuningInput {
  name: string;
  /** Open-string note names with octave, low (6th) to high (1st), e.g. ["D2","A2","D3","G3","B3","E4"]. */
  lowToHigh: string[];
}

/**
 * Validates and builds a user-defined tuning. The pitch engine works on
 * frequencies only, so custom tunings need no engine changes; they are saved
 * with the student's settings (storage arrives in Milestone 5).
 */
export function createCustomTuning(input: CustomTuningInput, id = `custom-${Date.now()}`): TuningPreset {
  const name = input.name.trim();
  if (!name) throw new Error('A custom tuning needs a name');
  if (input.lowToHigh.length !== 6) throw new Error('A guitar tuning needs exactly six strings');
  const parsed = input.lowToHigh.map((text): [number, string] => {
    const m = /^([A-Ga-g](?:#|b)?)(-?\d)$/.exec(text.trim());
    if (!m) throw new Error(`"${text}" is not a note with an octave, like E2 or F#3`);
    const midi = (Number(m[2]) + 1) * 12 + parsePitchClass(m[1]);
    if (midi < 28 || midi > 76) throw new Error(`${text} is outside a playable guitar range`);
    return [midi, m[1][0].toUpperCase() + m[1].slice(1)];
  });
  return preset(id, name, parsed, true);
}

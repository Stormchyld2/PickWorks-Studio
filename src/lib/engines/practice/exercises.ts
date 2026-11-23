import {
  octavesOf,
  positionsOfPitchClass,
  positionsOnString,
  resolve,
  type FretPosition,
  type FretRange,
} from '../fretboard/fretboard';
import {
  LETTERS,
  LETTER_PITCH_CLASS,
  noteName,
  toPitchClass,
  type AccidentalPreference,
  type PitchClass,
} from '../music-theory/notes';
import { ordinal, type Tuning } from '../music-theory/tuning';
import type { ExpectedPerformance } from '../performance/types';
import { pick, type Rng } from './rng';

/** Built-in fretboard exercise types. Other courses register their own via the exercise registry. */
export type FretboardExerciseType =
  | 'find-note' // find a named note (optionally on a given string)
  | 'name-note' // name the highlighted note
  | 'identify-position' // say which string and fret is highlighted
  | 'find-all' // locate every occurrence of a note
  | 'anchor' // find an anchor note on the 6th or 5th string
  | 'octave'; // find the octave of a highlighted note using octave shapes

/** Any registered exercise type: the built-ins above or a type added by another course. */
export type ExerciseType = FretboardExerciseType | (string & {});

export const FRETBOARD_EXERCISE_TYPES: readonly FretboardExerciseType[] = ['find-note', 'name-note', 'identify-position', 'find-all', 'anchor', 'octave'];

export type SkillDimension = 'fretboard' | 'chords' | 'rhythm' | 'technique' | 'ear';

export interface Exercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  hint?: string;
  expected: ExpectedPerformance;
  /** What the fretboard shows before the student answers. Never includes the answer. */
  display: { highlights: FretPosition[]; focusString: number | null; range: FretRange };
  /** Position or note this exercise trains, for mastery tracking, e.g. "pos:5:3" or "note:C". */
  skillKey: string;
  dimension: SkillDimension;
  /** The answer, revealed only by "Show Answer" or after answering. */
  answer: FretPosition[];
  answerText: string;
}

export interface GenerateOptions {
  tuning: Tuning;
  range: FretRange;
  rng: Rng;
  accidentals?: AccidentalPreference;
  /** Restrict to these strings. */
  strings?: number[];
  /** Restrict to natural notes (for early lessons). */
  naturalsOnly?: boolean;
  /** Restrict to these pitch classes. */
  pitchClasses?: PitchClass[];
  /** Explicit target (used by weak-area review). */
  target?: FretPosition;
  /** Free-form settings for exercise types registered by other courses. */
  params?: Record<string, unknown>;
}

/** Default anchor notes: the landmarks on the two bass strings that locate chord roots. */
export const DEFAULT_ANCHORS: readonly FretPosition[] = [
  { string: 6, fret: 0 },
  { string: 6, fret: 3 },
  { string: 6, fret: 5 },
  { string: 6, fret: 7 },
  { string: 6, fret: 12 },
  { string: 5, fret: 0 },
  { string: 5, fret: 3 },
  { string: 5, fret: 5 },
  { string: 5, fret: 7 },
  { string: 5, fret: 12 },
];

let counter = 0;
const newId = (type: string) => `${type}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const positionKey = (p: FretPosition) => `pos:${p.string}:${p.fret}`;

function candidatePositions(o: GenerateOptions): FretPosition[] {
  const strings = o.strings ?? o.tuning.strings.map((s) => s.number);
  const out: FretPosition[] = [];
  for (const string of strings) {
    for (let fret = o.range.minFret; fret <= o.range.maxFret; fret++) {
      const pc = resolve(o.tuning, { string, fret }).pitchClass;
      if (o.naturalsOnly && !LETTERS.some((l) => LETTER_PITCH_CLASS[l] === pc)) continue;
      if (o.pitchClasses && !o.pitchClasses.includes(pc)) continue;
      out.push({ string, fret });
    }
  }
  if (out.length === 0) throw new RangeError('No positions match the exercise options');
  return out;
}

function where(p: FretPosition): string {
  return `${ordinal(p.string)} string, ${p.fret === 0 ? 'open' : `${ordinal(p.fret)} fret`}`;
}

/** Generator for the built-in fretboard exercises. Use the registry (`getExerciseDefinition`) from sessions. */
export function generateExercise(type: FretboardExerciseType, o: GenerateOptions): Exercise {
  const acc = o.accidentals ?? 'sharp';
  const strings = o.tuning.strings;
  const label = (n: number) => strings.find((s) => s.number === n)?.label ?? String(n);
  const target = o.target ?? pick(type === 'anchor' ? DEFAULT_ANCHORS.filter((a) => a.fret <= o.range.maxFret) : candidatePositions(o), o.rng);
  const r = resolve(o.tuning, target);
  const name = noteName(r.pitchClass, acc);
  const base = { id: newId(type), type, dimension: 'fretboard' as const, skillKey: positionKey(target) };

  switch (type) {
    case 'find-note':
    case 'anchor': {
      const accept = positionsOnString(o.tuning, target.string, r.pitchClass, o.range);
      return {
        ...base,
        prompt: `Find the note ${name} on the ${label(target.string)} string.`,
        hint: `The ${label(target.string)} string is the ${ordinal(target.string)} string.`,
        expected: { kind: 'select-position', tuningId: o.tuning.id, accept },
        display: { highlights: [], focusString: target.string, range: o.range },
        answer: accept,
        answerText: `${name} is at ${accept.map(where).join(' and ')}.`,
      };
    }
    case 'name-note':
      return {
        ...base,
        prompt: 'Name the highlighted note.',
        expected: { kind: 'name-note', pitchClass: r.pitchClass },
        display: { highlights: [target], focusString: null, range: o.range },
        answer: [target],
        answerText: `That note is ${name} (${where(target)}).`,
      };
    case 'identify-position':
      return {
        ...base,
        prompt: `Select the ${ordinal(target.string)} string at the ${target.fret === 0 ? 'open position' : `${ordinal(target.fret)} fret`}, then name the note.`,
        expected: { kind: 'select-position', tuningId: o.tuning.id, accept: [target] },
        display: { highlights: [], focusString: null, range: o.range },
        answer: [target],
        answerText: `${where(target)} is ${name}.`,
      };
    case 'find-all': {
      const accept = positionsOfPitchClass(o.tuning, r.pitchClass, o.range);
      return {
        ...base,
        skillKey: `note:${noteName(r.pitchClass, 'sharp')}`,
        prompt: `Find every ${name} between frets ${o.range.minFret} and ${o.range.maxFret}.`,
        expected: { kind: 'select-all-positions', tuningId: o.tuning.id, accept },
        display: { highlights: [], focusString: null, range: o.range },
        answer: accept,
        answerText: `${name} appears ${accept.length} times: ${accept.map(where).join('; ')}.`,
      };
    }
    case 'octave': {
      const accept = octavesOf(o.tuning, target, o.range).filter((p) => Math.abs(p.string - target.string) === 2);
      if (accept.length === 0) return generateExercise(type, { ...o, target: undefined, strings: [6, 5, 4, 3] });
      return {
        ...base,
        prompt: `The highlighted note is ${name}. Find the same note an octave away using an octave shape.`,
        hint: 'Octave shapes skip one string.',
        expected: { kind: 'select-position', tuningId: o.tuning.id, accept },
        display: { highlights: [target], focusString: null, range: o.range },
        answer: accept,
        answerText: `The octave of ${name} is at ${accept.map(where).join(' or ')}.`,
      };
    }
  }
}

/** Note-name choices for "name the note": the answer plus distractors, all distinct. */
export function noteChoices(answer: PitchClass, rng: Rng, count = 4, acc: AccidentalPreference = 'sharp'): string[] {
  const pcs = new Set<PitchClass>([answer]);
  while (pcs.size < count) pcs.add(toPitchClass(Math.floor(rng() * 12)));
  return [...pcs].sort(() => rng() - 0.5).map((pc) => noteName(pc, acc));
}

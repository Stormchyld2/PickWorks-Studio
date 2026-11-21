/**
 * Exercise registry: each exercise type supplies its own generator and,
 * optionally, its own evaluator. Chord, scale, rhythm, ear-training and
 * game exercises plug in here without changing the fretboard ones or the
 * session, mastery and lesson engines that run them.
 */
import { ruleEvaluator } from '../performance/evaluate';
import type { Evaluation, ExpectedPerformance, Observation } from '../performance/types';
import {
  FRETBOARD_EXERCISE_TYPES,
  generateExercise,
  type Exercise,
  type ExerciseType,
  type FretboardExerciseType,
  type GenerateOptions,
  type SkillDimension,
} from './exercises';

export interface ExerciseDefinition {
  type: ExerciseType;
  label: string;
  dimension: SkillDimension;
  generate(options: GenerateOptions): Exercise;
  /** Defaults to the shared rule evaluator. */
  evaluate?(expected: ExpectedPerformance, observations: Observation[]): Evaluation;
}

const registry = new Map<string, ExerciseDefinition>();

export function registerExercise(def: ExerciseDefinition): void {
  if (registry.has(def.type)) throw new Error(`Exercise type "${def.type}" is already registered`);
  registry.set(def.type, def);
}

export function getExerciseDefinition(type: ExerciseType): ExerciseDefinition {
  const def = registry.get(type);
  if (!def) throw new RangeError(`Unknown exercise type "${type}"`);
  return def;
}

export function registeredExerciseTypes(): string[] {
  return [...registry.keys()];
}

export function evaluateExercise(exercise: Exercise, observations: Observation[]): Evaluation {
  const def = getExerciseDefinition(exercise.type);
  return (def.evaluate ?? ruleEvaluator.evaluate)(exercise.expected, observations);
}

const LABELS: Record<FretboardExerciseType, string> = {
  'find-note': 'Find the note',
  'name-note': 'Name the highlighted note',
  'identify-position': 'Identify the string and fret',
  'find-all': 'Locate all occurrences',
  anchor: 'Anchor notes',
  octave: 'Octave patterns',
};

for (const type of FRETBOARD_EXERCISE_TYPES) {
  registerExercise({ type, label: LABELS[type], dimension: 'fretboard', generate: (o) => generateExercise(type, o) });
}

import type { Attempt } from '../mastery/attempts';
import { weakestSkills } from '../mastery/mastery';
import type { Evaluation, Observation } from '../performance/types';
import { ruleEvaluator } from '../performance/evaluate';
import { generateExercise, type Exercise, type ExerciseType, type GenerateOptions } from './exercises';

export type PracticeMode = 'untimed' | 'timed';
export type PracticeSource = 'mixed' | 'weak-areas' | 'single';

export interface PracticeConfig {
  types: ExerciseType[];
  count: number;
  mode: PracticeMode;
  /** Per-exercise limit in timed mode, ms. */
  timeLimitMs?: number;
  source: PracticeSource;
  generate: Omit<GenerateOptions, 'target'>;
  lessonId?: string;
  /**
   * Mini Tests and assessments: no hints, no Show Answer, and feedback never
   * reveals the answer before the student submits.
   */
  assessment?: boolean;
}

export interface PracticeResult {
  exercise: Exercise;
  evaluation: Evaluation;
  feedback: string;
  attempt: Attempt;
}

export interface PracticeSession {
  id: string;
  config: PracticeConfig;
  exercises: Exercise[];
  index: number;
  results: PracticeResult[];
  /** Exercise ids where the student pressed "Show Answer". */
  revealed: string[];
  startedAt: string;
  finished: boolean;
}

const positionFromKey = (key: string) => {
  const m = /^pos:(\d+):(\d+)$/.exec(key);
  return m ? { string: Number(m[1]), fret: Number(m[2]) } : undefined;
};

/**
 * Builds a session. "weak-areas" targets the student's weakest positions
 * first and fills the rest with mixed exercises.
 */
export function createPracticeSession(config: PracticeConfig, history: readonly Attempt[] = [], now = new Date()): PracticeSession {
  if (config.types.length === 0) throw new Error('Choose at least one exercise type');
  const exercises: Exercise[] = [];
  const typeAt = (i: number) => config.types[config.source === 'mixed' ? Math.floor(config.generate.rng() * config.types.length) : i % config.types.length];

  if (config.source === 'weak-areas') {
    const weak = weakestSkills(history, config.count, undefined, now)
      .map((s) => positionFromKey(s.skillKey))
      .filter((p) => p !== undefined && p.fret <= config.generate.range.maxFret && p.fret >= config.generate.range.minFret);
    for (const target of weak) {
      if (exercises.length >= config.count) break;
      exercises.push(generateExercise(typeAt(exercises.length), { ...config.generate, target }));
    }
  }
  while (exercises.length < config.count) exercises.push(generateExercise(typeAt(exercises.length), config.generate));
  if (config.assessment) for (const ex of exercises) delete ex.hint;

  return {
    id: `session-${now.getTime().toString(36)}`,
    config,
    exercises,
    index: 0,
    results: [],
    revealed: [],
    startedAt: now.toISOString(),
    finished: false,
  };
}

export function currentExercise(s: PracticeSession): Exercise | null {
  return s.finished ? null : s.exercises[s.index];
}

function feedbackFor(ex: Exercise, ev: Evaluation, timedOut: boolean, assessment: boolean): string {
  if (assessment) return ev.correct ? 'Correct!' : timedOut ? "Time's up." : 'Not correct.';
  if (timedOut) return `Time's up. ${ex.answerText}`;
  if (ev.correct) return `Correct! ${ex.answerText}`;
  if (ev.findings.some((f) => f.code === 'missed-positions')) return 'Not all of them yet. Keep looking, or try again.';
  return 'Not quite. Try again.';
}

/**
 * Evaluates the student's answer to the current exercise and records an
 * attempt. Wrong answers keep the same exercise so the student can retry;
 * "Show Answer" is offered by the UI but never counts toward mastery.
 */
export function submitAnswer(
  s: PracticeSession,
  observations: Observation[],
  now = new Date(),
): { session: PracticeSession; result: PracticeResult } {
  const ex = currentExercise(s);
  if (!ex) throw new Error('The session is finished');
  const responseMs = observations.length ? observations[observations.length - 1].atMs : 0;
  const timedOut = s.config.mode === 'timed' && s.config.timeLimitMs !== undefined && responseMs > s.config.timeLimitMs;
  const evaluation = timedOut
    ? { correct: false, certainty: 'confirmed' as const, findings: [{ code: 'timed-out', certainty: 'confirmed' as const }], responseMs }
    : ruleEvaluator.evaluate(ex.expected, observations);

  const attempt: Attempt = {
    exerciseType: ex.type,
    skillKey: ex.skillKey,
    dimension: ex.dimension,
    correct: evaluation.correct === true,
    responseMs,
    at: now.toISOString(),
    sessionId: s.id,
    lessonId: s.config.lessonId,
    revealed: s.revealed.includes(ex.id) || undefined,
  };
  const result: PracticeResult = { exercise: ex, evaluation, feedback: feedbackFor(ex, evaluation, timedOut, !!s.config.assessment), attempt };
  return { session: { ...s, results: [...s.results, result] }, result };
}

/** Whether the UI may offer Show Answer or hints right now. */
export function answerAvailable(s: PracticeSession): boolean {
  return !s.config.assessment;
}

export function revealAnswer(s: PracticeSession): PracticeSession {
  if (s.config.assessment) throw new Error('Answers cannot be revealed during a Mini Test or assessment');
  const ex = currentExercise(s);
  return ex && !s.revealed.includes(ex.id) ? { ...s, revealed: [...s.revealed, ex.id] } : s;
}

/** Moves on. The student decides when; a correct answer is not required (clear stopping points). */
export function nextExercise(s: PracticeSession): PracticeSession {
  const index = s.index + 1;
  return { ...s, index, finished: index >= s.exercises.length };
}

export interface SessionSummary {
  answered: number;
  firstTryCorrect: number;
  accuracy: number | null;
  medianMs: number | null;
}

/** Accuracy counts each exercise once, by the student's first answer. */
export function summarizeSession(s: PracticeSession): SessionSummary {
  const first = new Map<string, PracticeResult>();
  for (const r of s.results) if (!first.has(r.exercise.id)) first.set(r.exercise.id, r);
  const firsts = [...first.values()];
  const ok = firsts.filter((r) => r.evaluation.correct);
  const times = ok.map((r) => r.attempt.responseMs).sort((a, b) => a - b);
  return {
    answered: firsts.length,
    firstTryCorrect: ok.length,
    accuracy: firsts.length ? ok.length / firsts.length : null,
    medianMs: times.length ? times[Math.floor(times.length / 2)] : null,
  };
}

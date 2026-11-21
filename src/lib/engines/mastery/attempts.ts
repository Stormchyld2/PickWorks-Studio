import type { ExerciseType, SkillDimension } from '../practice/exercises';

/** Where an attempt happened. Only lessons, assessments and placement count toward curriculum gates. */
export type AttemptContext = 'lesson' | 'practice' | 'assessment' | 'placement';

/**
 * How the result was judged (Decision 05). Only objective evidence (the app
 * checked the answer itself) can satisfy mastery. Guided and self-assessed
 * results are kept for history and coaching but never grant mastery.
 */
export type EvidenceKind = 'objective' | 'guided' | 'self';

/** One answered exercise. Stored in the student's practice history. */
export interface Attempt {
  exerciseType: ExerciseType;
  skillKey: string;
  dimension: SkillDimension;
  correct: boolean;
  /** Time to answer, ms. Untimed practice still records it, for recall-speed tracking. */
  responseMs: number;
  /** ISO timestamp. */
  at: string;
  sessionId: string;
  lessonId?: string;
  /** True when the student used "Show Answer" before answering. Never counts toward mastery. */
  revealed?: boolean;
  /** Defaults to 'lesson' when lessonId is set, otherwise 'practice'. */
  context?: AttemptContext;
  /** Defaults to 'objective'. */
  evidence?: EvidenceKind;
  /** Permanent id of the student who made the attempt. Stamped when saved. */
  studentId?: string;
}

export function attemptContext(a: Attempt): AttemptContext {
  return a.context ?? (a.lessonId ? 'lesson' : 'practice');
}

export function isObjective(a: Attempt): boolean {
  return (a.evidence ?? 'objective') === 'objective';
}

/**
 * Whether an attempt can count toward a curriculum mastery gate: objective
 * evidence from a lesson, assessment or placement. Standalone practice builds
 * current proficiency but never confers curriculum mastery on its own.
 */
export function countsTowardGate(a: Attempt): boolean {
  return isObjective(a) && attemptContext(a) !== 'practice';
}

export interface MasteryConfig {
  /** Most recent attempts considered per skill. */
  windowAttempts: number;
  /** Minimum attempts before a skill can be judged at all. */
  minAttempts: number;
  /** Share of the window that must be qualifying answers (correct, unrevealed, fast enough), 0..1. */
  masteredAccuracy: number;
  /** A correct answer only qualifies for mastery if it took at most this long, ms. */
  qualifyingMs: number;
  /** Qualifying answers must fall on at least this many different days. */
  masteredDistinctDays: number;
  /** Below this accuracy a practised skill is "weak". */
  weakAccuracy: number;
  /** A mastered skill is due for review after this many days without practice. */
  reviewAfterDays: number;
}

/**
 * Locked v1 thresholds (Jason, 2026-11-21): at least 90% of the last 10
 * attempts correct with responses under 3 seconds, shown on two different
 * days. Configurable internally; students cannot change them in v1.
 */
export const DEFAULT_MASTERY_CONFIG: MasteryConfig = {
  windowAttempts: 10,
  minAttempts: 5,
  masteredAccuracy: 0.9,
  qualifyingMs: 3000,
  masteredDistinctDays: 2,
  weakAccuracy: 0.7,
  reviewAfterDays: 7,
};

export function mergeMasteryConfig(partial: Partial<MasteryConfig> | undefined): MasteryConfig {
  return { ...DEFAULT_MASTERY_CONFIG, ...(partial ?? {}) };
}

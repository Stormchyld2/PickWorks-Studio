import type { SkillDimension } from '../practice/exercises';
import { countsTowardGate, DEFAULT_MASTERY_CONFIG, isObjective, type Attempt, type MasteryConfig } from './attempts';

export type SkillStatus = 'new' | 'learning' | 'weak' | 'mastered';

export interface SkillStats {
  skillKey: string;
  dimension: SkillDimension;
  attempts: number;
  correct: number;
  /** Accuracy over the recent window, 0..1. */
  recentAccuracy: number;
  medianMs: number | null;
  distinctDays: number;
  lastPracticed: string | null;
  /** Times answered wrong within the window. */
  recentMistakes: number;
  status: SkillStatus;
  dueForReview: boolean;
}

const DAY_MS = 86_400_000;
const dayOf = (iso: string) => iso.slice(0, 10);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Statistics for one skill (e.g. "pos:5:3"). Attempts in any order. */
export function skillStats(
  skillKey: string,
  attempts: readonly Attempt[],
  config: MasteryConfig = DEFAULT_MASTERY_CONFIG,
  now: Date = new Date(),
): SkillStats {
  // Revealed answers stay in the rolling window but never count as a recall.
  // Guided and self-assessed results are history only, never proficiency.
  const mine = attempts.filter((a) => a.skillKey === skillKey && isObjective(a)).sort((a, b) => a.at.localeCompare(b.at));
  const dimension = mine[0]?.dimension ?? 'fretboard';
  const window = mine.slice(-config.windowAttempts);
  const correctInWindow = window.filter((a) => a.correct && !a.revealed);
  const qualifying = correctInWindow.filter((a) => a.responseMs < config.qualifyingMs);
  const recentAccuracy = window.length ? correctInWindow.length / window.length : 0;
  const medianMs = median(correctInWindow.map((a) => a.responseMs));
  const distinctDays = new Set(qualifying.map((a) => dayOf(a.at))).size;
  const lastPracticed = mine.length ? mine[mine.length - 1].at : null;

  // All three conditions must hold at once, over a full window.
  let status: SkillStatus = 'new';
  if (mine.length > 0) status = 'learning';
  if (window.length >= config.minAttempts && recentAccuracy < config.weakAccuracy) status = 'weak';
  if (
    window.length >= config.windowAttempts &&
    qualifying.length / window.length >= config.masteredAccuracy &&
    distinctDays >= config.masteredDistinctDays
  )
    status = 'mastered';
  const stale = lastPracticed !== null && now.getTime() - new Date(lastPracticed).getTime() > config.reviewAfterDays * DAY_MS;

  return {
    skillKey,
    dimension,
    attempts: mine.length,
    correct: mine.filter((a) => a.correct && !a.revealed).length,
    recentAccuracy,
    medianMs,
    distinctDays,
    lastPracticed,
    recentMistakes: window.length - correctInWindow.length,
    status,
    dueForReview: status === 'weak' || (status === 'mastered' && stale),
  };
}

export function allSkillStats(attempts: readonly Attempt[], config = DEFAULT_MASTERY_CONFIG, now = new Date()): SkillStats[] {
  const keys = [...new Set(attempts.map((a) => a.skillKey))];
  return keys.map((k) => skillStats(k, attempts, config, now));
}

/**
 * Weakest practised skills first: weak status, then most recent mistakes,
 * then lowest accuracy. Feeds weak-area review.
 */
export function weakestSkills(attempts: readonly Attempt[], limit = 5, config = DEFAULT_MASTERY_CONFIG, now = new Date()): SkillStats[] {
  return allSkillStats(attempts, config, now)
    .filter((s) => s.status === 'weak' || s.recentMistakes > 0)
    .sort((a, b) => Number(b.status === 'weak') - Number(a.status === 'weak') || b.recentMistakes - a.recentMistakes || a.recentAccuracy - b.recentAccuracy)
    .slice(0, limit);
}

export const SKILL_DIMENSIONS: readonly { id: SkillDimension; label: string }[] = [
  { id: 'fretboard', label: 'Fretboard Knowledge' },
  { id: 'chords', label: 'Chord Accuracy' },
  { id: 'rhythm', label: 'Rhythm & Timing' },
  { id: 'technique', label: 'Technique' },
  { id: 'ear', label: 'Ear Training' },
];

export interface DimensionScore {
  dimension: SkillDimension;
  label: string;
  /** Share of the dimension's skills mastered, 0..1. null = nothing practised yet. */
  score: number | null;
  mastered: number;
  total: number;
}

/**
 * Skill profile: one score per dimension, never a single overall number.
 * `totals` gives how many skills each dimension contains (e.g. 72 fretboard
 * positions for frets 1-12), so unpractised skills count as not mastered.
 */
export function skillProfile(
  attempts: readonly Attempt[],
  totals: Partial<Record<SkillDimension, number>>,
  config = DEFAULT_MASTERY_CONFIG,
  now = new Date(),
): DimensionScore[] {
  const stats = allSkillStats(attempts, config, now);
  return SKILL_DIMENSIONS.map(({ id, label }) => {
    const mine = stats.filter((s) => s.dimension === id);
    const mastered = mine.filter((s) => s.status === 'mastered').length;
    const total = totals[id] ?? mine.length;
    return { dimension: id, label, mastered, total, score: mine.length === 0 || total === 0 ? null : mastered / total };
  });
}

export interface ProgressSummary {
  correct: number;
  incorrect: number;
  accuracy: number | null;
  practiceMs: number;
  /** Days with practice, newest first. Streaks are optional and never penalised. */
  practiceDays: string[];
  currentStreakDays: number;
}

export function progressSummary(attempts: readonly Attempt[], sessionDurationsMs: readonly number[] = [], now = new Date()): ProgressSummary {
  const counted = attempts.filter((a) => !a.revealed);
  const correct = counted.filter((a) => a.correct).length;
  const incorrect = counted.length - correct;
  const practiceDays = [...new Set(attempts.map((a) => dayOf(a.at)))].sort().reverse();
  let streak = 0;
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // A streak may continue from yesterday if the student hasn't practised yet today.
  if (practiceDays[0] !== dayOf(cursor.toISOString())) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (const day of practiceDays) {
    if (day !== dayOf(cursor.toISOString())) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return {
    correct,
    incorrect,
    accuracy: counted.length ? correct / counted.length : null,
    practiceMs: sessionDurationsMs.reduce((a, b) => a + b, 0),
    practiceDays,
    currentStreakDays: streak,
  };
}

/**
 * Current proficiency (skillStats) counts all objective attempts. Curriculum
 * gates use only lesson, assessment and placement evidence, so free practice
 * alone can never unlock a gate (product rule 3).
 */
export function gateStats(
  skillKey: string,
  attempts: readonly Attempt[],
  config: MasteryConfig = DEFAULT_MASTERY_CONFIG,
  now: Date = new Date(),
): SkillStats {
  return skillStats(skillKey, attempts.filter(countsTowardGate), config, now);
}

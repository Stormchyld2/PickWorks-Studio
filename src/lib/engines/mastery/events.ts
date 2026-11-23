import type { SkillDimension } from '../practice/exercises';
import { DEFAULT_MASTERY_CONFIG, type Attempt, type MasteryConfig } from './attempts';
import { gateStats } from './mastery';

/**
 * A permanent record that a skill was independently mastered (Decisions 17,
 * 30, 32). Kept forever, even if current proficiency later drops, so history
 * and certificates never lose an earned achievement. Current proficiency is
 * tracked separately by skillStats.
 */
export interface MasteryEvent {
  /** Stable and one per skill, so replays never create duplicates. */
  id: string;
  studentId: string;
  skillKey: string;
  dimension: SkillDimension;
  /** ISO time of the attempt that completed the mastery evidence. */
  at: string;
  /** How mastery was shown. Administrator corrections are labelled separately. */
  source: 'demonstrated' | 'admin-correction';
}

export function masteryEventId(skillKey: string): string {
  return `mastered:${skillKey}`;
}

/**
 * New mastery events earned by these attempts, given those already recorded.
 * Only gate-eligible evidence counts. Safe to call repeatedly.
 */
export function detectNewMastery(
  studentId: string,
  attempts: readonly Attempt[],
  existing: readonly MasteryEvent[],
  config: MasteryConfig = DEFAULT_MASTERY_CONFIG,
  now: Date = new Date(),
): MasteryEvent[] {
  const have = new Set(existing.map((e) => e.id));
  const keys = [...new Set(attempts.map((a) => a.skillKey))];
  const out: MasteryEvent[] = [];
  for (const skillKey of keys) {
    const id = masteryEventId(skillKey);
    if (have.has(id)) continue;
    const stats = gateStats(skillKey, attempts, config, now);
    if (stats.status !== 'mastered') continue;
    out.push({ id, studentId, skillKey, dimension: stats.dimension, at: stats.lastPracticed ?? now.toISOString(), source: 'demonstrated' });
  }
  return out;
}

/** Ever-mastered skills, from the permanent record. */
export function masteredSkillKeys(events: readonly MasteryEvent[]): Set<string> {
  return new Set(events.map((e) => e.skillKey));
}

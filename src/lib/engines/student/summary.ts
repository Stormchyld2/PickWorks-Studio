/**
 * Dashboard figures, calculated only from the signed-in student's saved
 * attempts and mastery events. Nothing is estimated or invented: with no
 * attempts, every figure is empty or zero.
 */
import type { Attempt } from '../mastery/attempts';
import type { MasteryEvent } from '../mastery/events';
import { allSkillStats, weakestSkills } from '../mastery/mastery';

const EXERCISE_LABELS: Record<string, string> = {
  'find-note': 'Find the Note',
  'name-note': 'Name the Note',
  'identify-position': 'String and Fret',
  'find-all': 'Find Every Occurrence',
  anchor: 'Anchor Notes',
  octave: 'Octave Shapes',
};

/** Plain-English name of an exercise type, for practice history. */
export function exerciseLabel(type: string): string {
  return EXERCISE_LABELS[type] ?? type.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

const STRING_NAMES = ['', 'high E', 'B', 'G', 'D', 'A', 'low E'];

/** Plain-English name of a skill key such as "pos:5:3" or "note:C". */
export function skillLabel(key: string): string {
  const pos = /^pos:(\d+):(\d+)$/.exec(key);
  if (pos) {
    const [string, fret] = [Number(pos[1]), Number(pos[2])];
    return `${STRING_NAMES[string] ?? `String ${string}`} string, ${fret === 0 ? 'open' : `fret ${fret}`}`;
  }
  const note = /^note:(.+)$/.exec(key);
  if (note) return `The note ${note[1]} everywhere`;
  return key;
}

export interface SessionSummary {
  sessionId: string;
  correct: number;
  incorrect: number;
  /** From the first to the last answer in the session. */
  durationMs: number;
  /** ISO time of the last answer. */
  endedAt: string;
  accuracy: number;
  /** The exercise practised most in the session, as shown to the student. */
  skill: string;
  dimension: string;
}

export interface DashboardSummary {
  answered: number;
  correct: number;
  /** 0–1, or null before any answers. Revealed answers ("Show Answer") don't count. */
  accuracy: number | null;
  /** Fretboard note skills mastered (permanent events). */
  notesMastered: number;
  skillsMastered: number;
  /** Most recent first, at most five. */
  recentSessions: SessionSummary[];
  /** Fretboard answers given so far (revealed answers excluded). */
  fretboardAnswered: number;
  /** Fretboard skills currently being learned (practised, not yet mastered). */
  fretboardInProgress: number;
  /** Practised fretboard skills due for review now. */
  reviewDue: number;
  /** The weakest practised fretboard skill, to suggest next; null before any practice. */
  nextSkill: string | null;
}

export function dashboardSummary(attempts: readonly Attempt[], events: readonly MasteryEvent[], now = new Date()): DashboardSummary {
  const counted = attempts.filter((a) => !a.revealed);
  const correct = counted.filter((a) => a.correct).length;
  const bySession = new Map<string, Attempt[]>();
  for (const a of counted) bySession.set(a.sessionId, [...(bySession.get(a.sessionId) ?? []), a]);
  const sessions: SessionSummary[] = [...bySession.entries()].map(([sessionId, list]) => {
    const times = list.map((a) => Date.parse(a.at)).filter(Number.isFinite);
    const c = list.filter((a) => a.correct).length;
    const end = Math.max(...times);
    const counts = new Map<string, number>();
    for (const a of list) counts.set(a.exerciseType, (counts.get(a.exerciseType) ?? 0) + 1);
    const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
    return {
      sessionId,
      correct: c,
      incorrect: list.length - c,
      durationMs: times.length ? end - Math.min(...times) : 0,
      endedAt: times.length ? new Date(end).toISOString() : '',
      accuracy: c / list.length,
      skill: exerciseLabel(top),
      dimension: list.find((a) => a.exerciseType === top)!.dimension,
    };
  });
  sessions.sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  const fretboard = counted.filter((a) => a.dimension === 'fretboard');
  const mastered = new Set(events.map((e) => e.skillKey));
  const stats = allSkillStats(fretboard, undefined, now);
  const weakest = weakestSkills(fretboard.filter((a) => !mastered.has(a.skillKey)), 1, undefined, now)[0];
  return {
    answered: counted.length,
    correct,
    accuracy: counted.length ? correct / counted.length : null,
    notesMastered: events.filter((e) => e.dimension === 'fretboard').length,
    skillsMastered: events.length,
    recentSessions: sessions.slice(0, 5),
    fretboardAnswered: fretboard.length,
    fretboardInProgress: stats.filter((st) => !mastered.has(st.skillKey) && st.status !== 'mastered').length,
    reviewDue: stats.filter((st) => st.dueForReview).length,
    nextSkill: weakest ? skillLabel(weakest.skillKey) : null,
  };
}

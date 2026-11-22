/**
 * Dashboard figures, calculated only from the signed-in student's saved
 * attempts and mastery events. Nothing is estimated or invented: with no
 * attempts, every figure is empty or zero.
 */
import type { Attempt } from '../mastery/attempts';
import type { MasteryEvent } from '../mastery/events';

export interface SessionSummary {
  sessionId: string;
  correct: number;
  incorrect: number;
  /** From the first to the last answer in the session. */
  durationMs: number;
  /** ISO time of the last answer. */
  endedAt: string;
  accuracy: number;
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
}

export function dashboardSummary(attempts: readonly Attempt[], events: readonly MasteryEvent[]): DashboardSummary {
  const counted = attempts.filter((a) => !a.revealed);
  const correct = counted.filter((a) => a.correct).length;
  const bySession = new Map<string, Attempt[]>();
  for (const a of counted) bySession.set(a.sessionId, [...(bySession.get(a.sessionId) ?? []), a]);
  const sessions: SessionSummary[] = [...bySession.entries()].map(([sessionId, list]) => {
    const times = list.map((a) => Date.parse(a.at)).filter(Number.isFinite);
    const c = list.filter((a) => a.correct).length;
    const end = Math.max(...times);
    return {
      sessionId,
      correct: c,
      incorrect: list.length - c,
      durationMs: times.length ? end - Math.min(...times) : 0,
      endedAt: times.length ? new Date(end).toISOString() : '',
      accuracy: c / list.length,
    };
  });
  sessions.sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  return {
    answered: counted.length,
    correct,
    accuracy: counted.length ? correct / counted.length : null,
    notesMastered: events.filter((e) => e.dimension === 'fretboard').length,
    skillsMastered: events.length,
    recentSessions: sessions.slice(0, 5),
  };
}

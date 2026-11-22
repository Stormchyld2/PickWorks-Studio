import { describe, expect, it } from 'vitest';
import { dashboardSummary } from '../../src/lib/engines/student/summary';
import type { Attempt } from '../../src/lib/engines/mastery/attempts';

const a = (sessionId: string, at: string, correct: boolean, revealed = false): Attempt => ({
  exerciseType: 'find-note', skillKey: 'pos:5:3', dimension: 'fretboard', correct, responseMs: 1500, at, sessionId, revealed,
});

describe('dashboard summary', () => {
  it('is empty for a new student: no invented numbers', () => {
    const s = dashboardSummary([], []);
    expect(s).toEqual({ answered: 0, correct: 0, accuracy: null, notesMastered: 0, skillsMastered: 0, recentSessions: [] });
  });

  it('counts only real answers, newest session first, ignoring revealed answers', () => {
    const s = dashboardSummary(
      [a('s1', '2026-11-20T10:00:00Z', true), a('s1', '2026-11-20T10:05:00Z', false), a('s2', '2026-11-21T09:00:00Z', true), a('s2', '2026-11-21T09:01:00Z', true, true)],
      [{ id: 'm1', studentId: 'x', skillKey: 'pos:5:3', dimension: 'fretboard', at: '2026-11-21T09:00:00Z' } as never],
    );
    expect(s.answered).toBe(3);
    expect(s.accuracy).toBeCloseTo(2 / 3);
    expect(s.notesMastered).toBe(1);
    expect(s.recentSessions.map((r) => r.sessionId)).toEqual(['s2', 's1']);
    expect(s.recentSessions[1]).toMatchObject({ correct: 1, incorrect: 1, durationMs: 300000 });
  });
});

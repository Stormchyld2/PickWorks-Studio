import { describe, expect, it } from 'vitest';
import { dashboardSummary, exerciseLabel, skillLabel } from '../../src/lib/engines/student/summary';
import type { Attempt } from '../../src/lib/engines/mastery/attempts';

const a = (sessionId: string, at: string, correct: boolean, revealed = false): Attempt => ({
  exerciseType: 'find-note', skillKey: 'pos:5:3', dimension: 'fretboard', correct, responseMs: 1500, at, sessionId, revealed,
});

describe('dashboard summary', () => {
  it('is empty for a new student: no invented numbers', () => {
    const s = dashboardSummary([], []);
    expect(s).toEqual({ answered: 0, correct: 0, accuracy: null, notesMastered: 0, skillsMastered: 0, recentSessions: [], fretboardAnswered: 0, fretboardInProgress: 0, reviewDue: 0, nextSkill: null });
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
    expect(s.recentSessions[1]).toMatchObject({ correct: 1, incorrect: 1, durationMs: 300000, skill: 'Find the Note', dimension: 'fretboard' });
  });

  it('suggests the weakest unmastered fretboard skill and counts reviews due', () => {
    const at = (i: number) => `2026-11-21T09:0${i}:00Z`;
    const mk = (skillKey: string, correct: boolean, i: number): Attempt => ({ ...a('s1', at(i), correct), skillKey });
    const attempts = [0, 1, 2, 3, 4].map((i) => mk('pos:6:5', false, i)).concat([mk('pos:5:3', true, 5), mk('pos:5:3', false, 6)]);
    const s = dashboardSummary(attempts, [], new Date('2026-11-21T10:00:00Z'));
    expect(s.fretboardAnswered).toBe(7);
    expect(s.fretboardInProgress).toBe(2);
    expect(s.reviewDue).toBe(1); // pos:6:5 is weak (0% over 5 attempts)
    expect(s.nextSkill).toBe('low E string, fret 5');
  });

  it('names skills and exercises in plain English', () => {
    expect(skillLabel('pos:1:0')).toBe('high E string, open');
    expect(skillLabel('note:C#')).toBe('The note C# everywhere');
    expect(exerciseLabel('anchor')).toBe('Anchor Notes');
    expect(exerciseLabel('chord-change')).toBe('Chord change');
  });
});

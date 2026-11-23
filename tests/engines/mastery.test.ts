import { describe, expect, it } from 'vitest';
import { DEFAULT_MASTERY_CONFIG, progressSummary, skillProfile, skillStats, weakestSkills, type Attempt } from '$lib/engines/mastery';

const now = new Date('2026-11-21T12:00:00Z');
function attempts(key: string, spec: { day: string; correct: boolean; ms?: number; revealed?: boolean }[]): Attempt[] {
  return spec.map((s, i) => ({
    exerciseType: 'find-note',
    skillKey: key,
    dimension: 'fretboard',
    correct: s.correct,
    responseMs: s.ms ?? 1500,
    at: `${s.day}T10:00:${String(i).padStart(2, '0')}.000Z`,
    sessionId: 's',
    revealed: s.revealed,
  }));
}
const rep = (n: number, x: { day: string; correct: boolean; ms?: number; revealed?: boolean }) => Array.from({ length: n }, () => x);

describe('note mastery (locked v1 rule)', () => {
  it('masters with 10/10 fast correct answers over two days', () => {
    const a = attempts('pos:5:3', [...rep(5, { day: '2026-11-19', correct: true }), ...rep(5, { day: '2026-11-20', correct: true })]);
    expect(skillStats('pos:5:3', a, DEFAULT_MASTERY_CONFIG, now).status).toBe('mastered');
  });

  it('allows one miss in ten (90%)', () => {
    const a = attempts('k', [...rep(5, { day: '2026-11-19', correct: true }), { day: '2026-11-20', correct: false }, ...rep(4, { day: '2026-11-20', correct: true })]);
    expect(skillStats('k', a, DEFAULT_MASTERY_CONFIG, now).status).toBe('mastered');
  });

  it('does not master on a single day', () => {
    const a = attempts('k', rep(10, { day: '2026-11-20', correct: true }));
    expect(skillStats('k', a, DEFAULT_MASTERY_CONFIG, now).status).toBe('learning');
  });

  it('does not master with fewer than 10 attempts', () => {
    const a = attempts('k', [...rep(4, { day: '2026-11-19', correct: true }), ...rep(5, { day: '2026-11-20', correct: true })]);
    expect(skillStats('k', a, DEFAULT_MASTERY_CONFIG, now).status).not.toBe('mastered');
  });

  it('slow answers (3 s or more) do not qualify', () => {
    const a = attempts('k', [...rep(5, { day: '2026-11-19', correct: true }), ...rep(2, { day: '2026-11-20', correct: true, ms: 3500 }), ...rep(3, { day: '2026-11-20', correct: true })]);
    expect(skillStats('k', a, DEFAULT_MASTERY_CONFIG, now).status).not.toBe('mastered');
  });

  it('revealed answers never count as recall', () => {
    const a = attempts('k', [...rep(5, { day: '2026-11-19', correct: true }), ...rep(2, { day: '2026-11-20', correct: true, revealed: true }), ...rep(3, { day: '2026-11-20', correct: true })]);
    const s = skillStats('k', a, DEFAULT_MASTERY_CONFIG, now);
    expect(s.status).not.toBe('mastered');
    expect(s.correct).toBe(8);
  });

  it('uses a rolling window: old mistakes age out', () => {
    const a = attempts('k', [...rep(5, { day: '2026-11-18', correct: false }), ...rep(5, { day: '2026-11-19', correct: true }), ...rep(5, { day: '2026-11-20', correct: true })]);
    expect(skillStats('k', a, DEFAULT_MASTERY_CONFIG, now).status).toBe('mastered');
  });

  it('thresholds are configurable', () => {
    const a = attempts('k', rep(10, { day: '2026-11-20', correct: true }));
    expect(skillStats('k', a, { ...DEFAULT_MASTERY_CONFIG, masteredDistinctDays: 1 }, now).status).toBe('mastered');
  });
});

describe('weak areas, profile and summary', () => {
  const a = [
    ...attempts('pos:5:7', rep(6, { day: '2026-11-20', correct: false })),
    ...attempts('pos:6:3', [...rep(5, { day: '2026-11-19', correct: true }), ...rep(5, { day: '2026-11-20', correct: true })]),
    ...attempts('pos:4:2', [{ day: '2026-11-20', correct: false }, { day: '2026-11-20', correct: true }]),
  ];

  it('ranks weak skills first and flags them for review', () => {
    const w = weakestSkills(a, 5, DEFAULT_MASTERY_CONFIG, now);
    expect(w.map((s) => s.skillKey)).toEqual(['pos:5:7', 'pos:4:2']);
    expect(w[0].status).toBe('weak');
    expect(w[0].dueForReview).toBe(true);
  });

  it('reports a score per skill dimension, not one overall number', () => {
    const p = skillProfile(a, { fretboard: 72 }, DEFAULT_MASTERY_CONFIG, now);
    const fb = p.find((d) => d.dimension === 'fretboard')!;
    expect(fb).toMatchObject({ mastered: 1, total: 72 });
    expect(fb.score).toBeCloseTo(1 / 72);
    expect(p.find((d) => d.dimension === 'rhythm')!.score).toBeNull();
    expect(p).toHaveLength(5);
  });

  it('summarises totals and an optional streak without penalties', () => {
    const s = progressSummary(a, [60000, 30000], now);
    expect(s.correct + s.incorrect).toBe(18);
    expect(s.practiceMs).toBe(90000);
    expect(s.currentStreakDays).toBe(2); // 19th and 20th; not practised yet on the 21st
  });
});

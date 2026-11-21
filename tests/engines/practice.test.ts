import { describe, expect, it } from 'vitest';
import {
  answerAvailable,
  createPracticeSession,
  currentExercise,
  generateExercise,
  nextExercise,
  noteChoices,
  revealAnswer,
  seededRng,
  submitAnswer,
  summarizeSession,
  type PracticeConfig,
} from '$lib/engines/practice';
import { STANDARD_TUNING, noteName, toPitchClass } from '$lib/engines/music-theory';
import { resolve } from '$lib/engines/fretboard';
import type { Observation } from '$lib/engines/performance';
import type { Attempt } from '$lib/engines/mastery';

const T = STANDARD_TUNING;
const range = { minFret: 0, maxFret: 12 };
const tap = (string: number, fret: number, atMs = 1500): Observation => ({ kind: 'position-selected', source: 'fretboard-ui', confidence: 1, atMs, position: { string, fret } });

describe('exercise generation', () => {
  it('find-note accepts exactly the positions of that note on the string', () => {
    const ex = generateExercise('find-note', { tuning: T, range, rng: seededRng(1), target: { string: 5, fret: 3 } });
    expect(ex.prompt).toBe('Find the note C on the A string.');
    expect(ex.expected).toMatchObject({ kind: 'select-position', accept: [{ string: 5, fret: 3 }] });
    expect(ex.display.highlights).toEqual([]); // the answer is never pre-shown
    expect(ex.display.focusString).toBe(5);
  });

  it('includes both positions when a note appears twice on a string', () => {
    const ex = generateExercise('find-note', { tuning: T, range, rng: seededRng(1), target: { string: 6, fret: 0 } });
    expect(ex.answer.map((p) => p.fret)).toEqual([0, 12]);
  });

  it('name-note highlights the position and expects its pitch class', () => {
    const ex = generateExercise('name-note', { tuning: T, range, rng: seededRng(2), target: { string: 1, fret: 5 } });
    expect(ex.display.highlights).toEqual([{ string: 1, fret: 5 }]);
    expect(ex.expected).toEqual({ kind: 'name-note', pitchClass: 9 });
  });

  it('find-all expects every occurrence in range', () => {
    const ex = generateExercise('find-all', { tuning: T, range, rng: seededRng(3), target: { string: 5, fret: 3 } });
    expect(ex.answer).toHaveLength(6);
    expect(ex.skillKey).toBe('note:C');
  });

  it('octave exercises use shapes two strings apart', () => {
    const ex = generateExercise('octave', { tuning: T, range, rng: seededRng(4), target: { string: 6, fret: 3 } });
    expect(ex.answer.every((p) => p.string === 4)).toBe(true);
    expect(ex.answer.map((p) => p.fret)).toEqual([5]);
  });

  it('respects naturals-only and string limits', () => {
    const rng = seededRng(9);
    for (let i = 0; i < 50; i++) {
      const ex = generateExercise('find-note', { tuning: T, range, rng, strings: [6], naturalsOnly: true });
      const name = noteName(resolve(T, ex.answer[0]).pitchClass);
      expect(name).toMatch(/^[A-G]$/);
      expect(ex.answer[0].string).toBe(6);
    }
  });

  it('offers distinct note choices including the answer', () => {
    const c = noteChoices(toPitchClass(0), seededRng(5));
    expect(new Set(c).size).toBe(4);
    expect(c).toContain('C');
  });
});

describe('practice sessions', () => {
  const config = (over: Partial<PracticeConfig> = {}): PracticeConfig => ({
    types: ['find-note'],
    count: 3,
    mode: 'untimed',
    source: 'single',
    generate: { tuning: T, range, rng: seededRng(11), strings: [5] },
    ...over,
  });

  it('evaluates answers, keeps the exercise on a wrong answer, and summarises first tries', () => {
    let s = createPracticeSession(config());
    const ex = currentExercise(s)!;
    const right = ex.answer[0];
    const wrong = { string: 5, fret: (right.fret + 1) % 12 };
    let r = submitAnswer(s, [tap(wrong.string, wrong.fret)]);
    expect(r.result.evaluation.correct).toBe(false);
    expect(r.result.feedback).toBe('Not quite. Try again.');
    s = r.session;
    r = submitAnswer(s, [tap(right.string, right.fret)]);
    expect(r.result.feedback.startsWith('Correct!')).toBe(true);
    s = nextExercise(r.session);
    expect(s.index).toBe(1);
    expect(summarizeSession(s)).toMatchObject({ answered: 1, firstTryCorrect: 0, accuracy: 0 });
  });

  it('marks timed-out answers incorrect', () => {
    const s = createPracticeSession(config({ mode: 'timed', timeLimitMs: 5000 }));
    const ex = currentExercise(s)!;
    const r = submitAnswer(s, [tap(ex.answer[0].string, ex.answer[0].fret, 6000)]);
    expect(r.result.evaluation.correct).toBe(false);
    expect(r.result.feedback.startsWith("Time's up")).toBe(true);
  });

  it('flags revealed answers so they never count as recall', () => {
    let s = createPracticeSession(config());
    s = revealAnswer(s);
    const ex = currentExercise(s)!;
    const r = submitAnswer(s, [tap(ex.answer[0].string, ex.answer[0].fret)]);
    expect(r.result.attempt.revealed).toBe(true);
  });

  it('Mini Tests hide hints, refuse Show Answer and never put the answer in feedback', () => {
    let s = createPracticeSession(config({ assessment: true }));
    expect(answerAvailable(s)).toBe(false);
    expect(() => revealAnswer(s)).toThrow();
    expect(s.exercises.every((e) => e.hint === undefined)).toBe(true);
    const ex = currentExercise(s)!;
    const wrong = submitAnswer(s, [tap(5, (ex.answer[0].fret + 1) % 12)]);
    expect(wrong.result.feedback).toBe('Not correct.');
    s = wrong.session;
    const right = submitAnswer(s, [tap(ex.answer[0].string, ex.answer[0].fret)]);
    expect(right.result.feedback).toBe('Correct!');
  });

  it('weak-area sessions target the weakest positions first', () => {
    const at = '2026-11-20T10:00:00.000Z';
    const history: Attempt[] = Array.from({ length: 6 }, () => ({
      exerciseType: 'find-note' as const,
      skillKey: 'pos:5:7',
      dimension: 'fretboard' as const,
      correct: false,
      responseMs: 4000,
      at,
      sessionId: 's0',
    }));
    const s = createPracticeSession(config({ source: 'weak-areas', count: 2 }), history);
    expect(s.exercises[0].skillKey).toBe('pos:5:7');
  });

  it('find-all needs every position and no extras', () => {
    const s = createPracticeSession(config({ types: ['find-all'], count: 1, generate: { tuning: T, range, rng: seededRng(3) } }));
    const ex = currentExercise(s)!;
    const partial = submitAnswer(s, ex.answer.slice(1).map((p) => tap(p.string, p.fret)));
    expect(partial.result.evaluation.correct).toBe(false);
    expect(partial.result.evaluation.findings[0].code).toBe('missed-positions');
    const full = submitAnswer(s, ex.answer.map((p) => tap(p.string, p.fret)));
    expect(full.result.evaluation.correct).toBe(true);
  });
});

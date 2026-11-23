import { describe, expect, it } from 'vitest';
import { ruleEvaluator } from '$lib/engines/performance';

describe('rule evaluator', () => {
  const expected = { kind: 'select-position', tuningId: 'standard', accept: [{ string: 5, fret: 3 }] } as const;

  it('confirms a correct fretboard selection', () => {
    const e = ruleEvaluator.evaluate(expected, [
      { kind: 'position-selected', source: 'fretboard-ui', confidence: 1, atMs: 1800, position: { string: 5, fret: 3 } },
    ]);
    expect(e).toMatchObject({ correct: true, certainty: 'confirmed', responseMs: 1800 });
  });

  it('reports a wrong position as a confirmed finding', () => {
    const e = ruleEvaluator.evaluate(expected, [
      { kind: 'position-selected', source: 'fretboard-ui', confidence: 1, atMs: 900, position: { string: 5, fret: 5 } },
    ]);
    expect(e.correct).toBe(false);
    expect(e.findings[0].code).toBe('wrong-position');
  });

  it('refuses to judge low-confidence detector input', () => {
    const e = ruleEvaluator.evaluate({ kind: 'play-pitch', midi: 48, toleranceCents: 20 }, [
      { kind: 'pitch-detected', source: 'microphone', confidence: 0.4, atMs: 500, midi: 48, cents: 0 },
    ]);
    expect(e).toMatchObject({ correct: null, certainty: 'insufficient-evidence' });
  });

  it('judges detected pitch against tolerance', () => {
    const sharp = ruleEvaluator.evaluate({ kind: 'play-pitch', midi: 48, toleranceCents: 20 }, [
      { kind: 'pitch-detected', source: 'microphone', confidence: 0.95, atMs: 500, midi: 48, cents: 35 },
    ]);
    expect(sharp.correct).toBe(false);
    expect(sharp.findings[0].code).toBe('pitch-sharp');
  });
});

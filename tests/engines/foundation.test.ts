import { describe, expect, it } from 'vitest';
import { createTransport, loopedBeat, setLoop, setTempo, tickAt, transportBeats } from '$lib/engines/audio';
import {
  createPracticeSession,
  currentExercise,
  getExerciseDefinition,
  registerExercise,
  registeredExerciseTypes,
  seededRng,
  submitAnswer,
} from '$lib/engines/practice';
import { STANDARD_TUNING } from '$lib/engines/music-theory';
import { validateCourseContent, validateLesson } from '$lib/engines/lessons';
import sample from '../fixtures/sample-lesson.json';

describe('shared transport', () => {
  it('counts bars and beats', () => {
    const t = createTransport(120, 3, 0);
    const beats = transportBeats(t, 0, 3);
    expect(beats.map((b) => [b.bar, b.beatInBar])).toEqual([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]);
    expect(beats.filter((b) => b.downbeat).map((b) => b.time)).toEqual([0, 1.5]);
  });

  it('changes tempo without jumping position', () => {
    let t = createTransport(60, 4, 0);
    t = setTempo(t, 120, 2); // at 2 s we are on beat 2
    expect(tickAt(t, 2)).toBeCloseTo(2);
    expect(transportBeats(t, 2, 3.01).map((b) => b.time)).toEqual([2, 2.5, 3]);
  });

  it('wraps inside a loop region', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((k) => loopedBeat(k, { startBeat: 2, lengthBeats: 3 }))).toEqual([0, 1, 2, 3, 4, 2, 3, 4]);
    const t = setLoop(createTransport(120, 4, 0), { startBeat: 4, lengthBeats: 4 });
    const beats = transportBeats(t, 0, 6);
    expect(beats.map((b) => b.bar)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(beats[8].downbeat).toBe(true);
  });
});

describe('exercise registry', () => {
  it('registers the six fretboard exercises', () => {
    expect(registeredExerciseTypes()).toEqual(expect.arrayContaining(['find-note', 'name-note', 'identify-position', 'find-all', 'anchor', 'octave']));
    expect(getExerciseDefinition('find-note').label).toBe('Find the note');
    expect(() => getExerciseDefinition('nope')).toThrow();
  });

  it('runs a new exercise type with its own evaluator through the normal session', () => {
    registerExercise({
      type: 'test-strum-count',
      label: 'Count the strums',
      dimension: 'rhythm',
      generate: () => ({
        id: 'strum-1',
        type: 'test-strum-count',
        prompt: 'How many beats?',
        expected: { kind: 'custom', exerciseType: 'test-strum-count', data: 4 },
        display: { highlights: [], focusString: null, range: { minFret: 0, maxFret: 12 } },
        skillKey: 'rhythm:count',
        dimension: 'rhythm',
        answer: [],
        answerText: 'Four beats.',
      }),
      evaluate: (_expected, obs) => ({ correct: obs.length === 4, certainty: 'confirmed', findings: [] }),
    });
    expect(() => registerExercise({ ...getExerciseDefinition('test-strum-count') })).toThrow();
    const s = createPracticeSession({
      types: ['test-strum-count'],
      count: 1,
      mode: 'untimed',
      source: 'single',
      generate: { tuning: STANDARD_TUNING, range: { minFret: 0, maxFret: 12 }, rng: seededRng(1) },
    });
    expect(currentExercise(s)?.dimension).toBe('rhythm');
    const onset = { kind: 'onset' as const, source: 'microphone' as const, confidence: 1, atMs: 100 };
    const r = submitAnswer(s, [onset, onset, onset, onset]);
    expect(r.result.evaluation.correct).toBe(true);
    expect(r.result.attempt.dimension).toBe('rhythm');
  });
});

describe('lesson tool steps', () => {
  const withTool = (tool: string) =>
    validateLesson({
      ...sample,
      prerequisites: [],
      steps: [{ kind: 'tool', id: 'tune-up', title: 'Tune up first', tool, settings: { mode: 'guided' } }, ...sample.steps],
    });

  it('accepts a tool step with settings and defaults', () => {
    const r = withTool('tuner');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.steps[0]).toMatchObject({ kind: 'tool', tool: 'tuner', required: false, settings: { mode: 'guided' } });
  });

  it('flags unknown tools and exercise types in course checks', () => {
    const r = withTool('chord-library');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const course = { schemaVersion: 1 as const, id: 'fretboard-foundations', title: 'FF', description: 'd', modules: [{ id: 'anchor-notes', title: 'A', lessons: [r.value.id] }] };
    const errors = validateCourseContent(course, [r.value], { exerciseTypes: ['name-note'] });
    expect(errors).toContain('Lesson a-string-note-locations step tune-up uses unknown tool chord-library');
    expect(errors).toContain('Lesson a-string-note-locations step find-notes uses unknown exercise type find-note');
  });
});

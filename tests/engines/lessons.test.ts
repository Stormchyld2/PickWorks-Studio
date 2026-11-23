import { describe, expect, it } from 'vitest';
import sample from '../fixtures/sample-lesson.json';
import {
  advance,
  courseProgress,
  currentStep,
  nextLesson,
  outcome,
  recordRecall,
  retryLesson,
  startLesson,
  validateCourse,
  validateCourseContent,
  validateLesson,
  type Course,
  type Lesson,
} from '$lib/engines/lessons';

const parsed = validateLesson(sample);
if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
const lesson: Lesson = parsed.value;

describe('lesson validation', () => {
  it('accepts a valid lesson and fills defaults', () => {
    expect(lesson.review.afterDays).toEqual([1, 3, 7]);
    expect(lesson.mode).toBe('instructor');
  });

  it('reports readable errors for malformed content', () => {
    const bad = validateLesson({ ...sample, id: 'Bad ID', estimatedMinutes: 0, steps: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.some((e) => e.startsWith('lesson.id'))).toBe(true);
      expect(bad.errors.some((e) => e.startsWith('lesson.steps'))).toBe(true);
    }
  });

  it('checks course structure against lesson files', () => {
    const course = validateCourse({
      schemaVersion: 1,
      id: 'fretboard-foundations',
      title: 'Fretboard Foundations',
      description: 'Learn the fretboard.',
      modules: [{ id: 'anchor-notes', title: 'Anchor Notes', lessons: ['a-string-note-locations', 'missing-lesson'] }],
    });
    expect(course.ok).toBe(true);
    if (course.ok) {
      const errors = validateCourseContent(course.value, [lesson]);
      expect(errors).toContain('Lesson missing-lesson is listed in module anchor-notes but has no file');
      expect(errors).toContain('Lesson a-string-note-locations requires low-e-anchors, which does not come before it');
    }
  });
});

describe('lesson runner', () => {
  it('walks Discover, Recall, Play, Review and completes at the accuracy bar', () => {
    let run = startLesson(lesson);
    expect(currentStep(lesson, run)?.kind).toBe('discover');
    run = advance(lesson, run);
    for (const ok of [true, true, true, true, false]) run = recordRecall(run, 'find-notes', ok);
    run = advance(lesson, advance(lesson, advance(lesson, run)));
    expect(outcome(lesson, run)).toBe('completed');
  });

  it('asks for more practice below the bar, and retry restarts recall only', () => {
    let run = startLesson(lesson);
    run = advance(lesson, run);
    for (const ok of [true, false, false]) run = recordRecall(run, 'find-notes', ok);
    run = advance(lesson, advance(lesson, advance(lesson, run)));
    expect(outcome(lesson, run)).toBe('needs-practice');
    run = retryLesson(lesson, run);
    expect(currentStep(lesson, run)?.id).toBe('find-notes');
    expect(run.recall).toEqual({});
  });

  it('survives a save and reload (plain JSON)', () => {
    const run = advance(lesson, startLesson(lesson));
    const restored = JSON.parse(JSON.stringify(run));
    expect(currentStep(lesson, restored)?.id).toBe('find-notes');
  });

  it('picks the next lesson whose prerequisites are done', () => {
    const course: Course = {
      schemaVersion: 1,
      id: 'fretboard-foundations',
      title: 'FF',
      description: 'd',
      modules: [{ id: 'anchor-notes', title: 'A', lessons: ['low-e-anchors', 'a-string-note-locations'] }],
    };
    const lessons = new Map([['a-string-note-locations', lesson], ['low-e-anchors', { ...lesson, id: 'low-e-anchors', prerequisites: [] }]]);
    expect(nextLesson(course, new Set(), lessons)).toBe('low-e-anchors');
    expect(nextLesson(course, new Set(['low-e-anchors']), lessons)).toBe('a-string-note-locations');
    expect(courseProgress(course, new Set(['low-e-anchors']))).toEqual({ completed: 1, total: 2 });
  });
});

import type { Course, Lesson, LessonStep } from './schema';

/**
 * Progress through one lesson. Plain data so it can be saved and resumed
 * after the app restarts.
 */
export interface LessonRun {
  lessonId: string;
  stepIndex: number;
  /** First-try results per recall step id. */
  recall: Record<string, { answered: number; correct: number }>;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export function startLesson(lesson: Lesson, now = new Date()): LessonRun {
  const t = now.toISOString();
  return { lessonId: lesson.id, stepIndex: 0, recall: {}, startedAt: t, updatedAt: t, completedAt: null };
}

export function currentStep(lesson: Lesson, run: LessonRun): LessonStep | null {
  return lesson.steps[run.stepIndex] ?? null;
}

export function recordRecall(run: LessonRun, stepId: string, correct: boolean, now = new Date()): LessonRun {
  const prev = run.recall[stepId] ?? { answered: 0, correct: 0 };
  return {
    ...run,
    recall: { ...run.recall, [stepId]: { answered: prev.answered + 1, correct: prev.correct + (correct ? 1 : 0) } },
    updatedAt: now.toISOString(),
  };
}

export function lessonAccuracy(run: LessonRun): number | null {
  const totals = Object.values(run.recall).reduce((a, r) => ({ answered: a.answered + r.answered, correct: a.correct + r.correct }), { answered: 0, correct: 0 });
  return totals.answered ? totals.correct / totals.answered : null;
}

/** Steps advance freely; completion is decided when the last step is passed. */
export function advance(lesson: Lesson, run: LessonRun, now = new Date()): LessonRun {
  if (run.completedAt) return run;
  const stepIndex = Math.min(run.stepIndex + 1, lesson.steps.length);
  const t = now.toISOString();
  if (stepIndex < lesson.steps.length) return { ...run, stepIndex, updatedAt: t };
  const acc = lessonAccuracy(run);
  const passed = acc === null || acc >= lesson.completion.minAccuracy;
  return { ...run, stepIndex, updatedAt: t, completedAt: passed ? t : null };
}

export type LessonOutcome = 'in-progress' | 'completed' | 'needs-practice';

export function outcome(lesson: Lesson, run: LessonRun): LessonOutcome {
  if (run.completedAt) return 'completed';
  return run.stepIndex >= lesson.steps.length ? 'needs-practice' : 'in-progress';
}

/** Restart only the recall work, keeping the student's place in the course. */
export function retryLesson(lesson: Lesson, run: LessonRun, now = new Date()): LessonRun {
  const first = lesson.steps.findIndex((s) => s.kind === 'recall');
  return { ...run, stepIndex: Math.max(0, first), recall: {}, updatedAt: now.toISOString(), completedAt: null };
}

/** Next lesson in course order whose prerequisites are complete. */
export function nextLesson(course: Course, completed: ReadonlySet<string>, lessons: ReadonlyMap<string, Lesson>): string | null {
  for (const m of course.modules) {
    for (const id of m.lessons) {
      if (completed.has(id)) continue;
      const l = lessons.get(id);
      if (l && l.prerequisites.every((p) => completed.has(p))) return id;
    }
  }
  return null;
}

/** Course progress as completed / total lessons. */
export function courseProgress(course: Course, completed: ReadonlySet<string>): { completed: number; total: number } {
  const all = course.modules.flatMap((m) => m.lessons);
  return { completed: all.filter((id) => completed.has(id)).length, total: all.length };
}

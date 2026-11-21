import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids use lowercase letters, numbers and hyphens');
const position = z.object({ string: z.number().int().min(1).max(6), fret: z.number().int().min(0).max(24) });
const range = z.object({ minFret: z.number().int().min(0).max(24), maxFret: z.number().int().min(0).max(24) }).refine((r) => r.minFret <= r.maxFret, 'minFret must not exceed maxFret');

export const exerciseTypeSchema = z.enum(['find-note', 'name-note', 'identify-position', 'find-all', 'anchor', 'octave']);

/** Learning cycle: Discover -> Recall -> Play -> Review. */
export const stepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('discover'),
    id,
    title: z.string().min(1),
    body: z.string().min(1),
    fretboard: z.object({ highlights: z.array(position).default([]), focusString: z.number().int().min(1).max(6).nullable().default(null), range }).optional(),
  }),
  z.object({
    kind: z.literal('recall'),
    id,
    title: z.string().min(1),
    exercise: z.object({
      types: z.array(exerciseTypeSchema).min(1),
      count: z.number().int().min(1).max(50),
      range,
      strings: z.array(z.number().int().min(1).max(6)).optional(),
      naturalsOnly: z.boolean().optional(),
      timed: z.boolean().default(false),
      timeLimitMs: z.number().int().positive().optional(),
    }),
  }),
  z.object({ kind: z.literal('play'), id, title: z.string().min(1), body: z.string().min(1) }),
  z.object({ kind: z.literal('review'), id, title: z.string().min(1), body: z.string().min(1) }),
]);

export const lessonSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  courseId: id,
  moduleId: id,
  title: z.string().min(1),
  objectives: z.array(z.string().min(1)).min(1),
  /** What the student can play or understand afterwards (the 80/20 payoff). */
  payoff: z.string().min(1),
  prerequisites: z.array(id).default([]),
  estimatedMinutes: z.number().int().min(1).max(30),
  steps: z.array(stepSchema).min(1),
  completion: z.object({
    /** First-try accuracy needed across recall steps, 0..1. */
    minAccuracy: z.number().min(0).max(1),
  }),
  review: z.object({ afterDays: z.array(z.number().int().positive()).default([1, 3, 7]) }).default({ afterDays: [1, 3, 7] }),
  mode: z.enum(['instructor', 'explore']).default('instructor'),
});

export const courseSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  title: z.string().min(1),
  description: z.string().min(1),
  modules: z
    .array(z.object({ id, title: z.string().min(1), lessons: z.array(id).min(1) }))
    .min(1),
});

export type LessonStep = z.infer<typeof stepSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Course = z.infer<typeof courseSchema>;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function validate<T>(schema: z.ZodType<T>, data: unknown, label: string): ValidationResult<T> {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${label}${i.path.length ? '.' + i.path.join('.') : ''}: ${i.message}`) };
}

export const validateLesson = (data: unknown) => validate(lessonSchema, data, 'lesson');
export const validateCourse = (data: unknown) => validate(courseSchema, data, 'course');

/** Cross-file checks: every lesson a course lists exists, matches, and has known prerequisites. */
export function validateCourseContent(course: Course, lessons: readonly Lesson[]): string[] {
  const errors: string[] = [];
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const listed = course.modules.flatMap((m) => m.lessons.map((lessonId) => ({ module: m.id, lessonId })));
  const seen = new Set<string>();
  for (const { module, lessonId } of listed) {
    if (seen.has(lessonId)) errors.push(`Lesson ${lessonId} is listed twice`);
    seen.add(lessonId);
    const l = byId.get(lessonId);
    if (!l) {
      errors.push(`Lesson ${lessonId} is listed in module ${module} but has no file`);
      continue;
    }
    if (l.courseId !== course.id) errors.push(`Lesson ${lessonId} belongs to course ${l.courseId}, not ${course.id}`);
    if (l.moduleId !== module) errors.push(`Lesson ${lessonId} says module ${l.moduleId} but is listed in ${module}`);
    for (const p of l.prerequisites) if (!seen.has(p)) errors.push(`Lesson ${lessonId} requires ${p}, which does not come before it`);
  }
  return errors;
}

import { describe, expect, it } from 'vitest';
import type { Attempt } from '../../src/lib/engines/mastery/attempts';
import { gateStats, skillStats } from '../../src/lib/engines/mastery/mastery';
import { checkpointRecord, decodeRecord, defaultPreferences, PREFERENCES, resumeAction } from '../../src/lib/engines/student/records';
import { memoryDataClient, SaveError, StudentData } from '../../src/lib/services/student-data';

const STUDENT = '0123456789abcdef0123456789abcdef';

/** Ten fast correct answers over two days: enough evidence for mastery. */
function masteryRun(context: Attempt['context'], evidence: Attempt['evidence'] = 'objective'): Attempt[] {
  return Array.from({ length: 10 }, (_, i) => ({
    exerciseType: 'find-note',
    skillKey: 'pos:5:3',
    dimension: 'fretboard' as const,
    correct: true,
    responseMs: 1500,
    at: `2026-11-${i < 5 ? '20' : '21'}T10:0${i % 10}:00.000Z`,
    sessionId: 's1',
    lessonId: context === 'lesson' ? 'l1' : undefined,
    context,
    evidence,
  }));
}

function setup() {
  let token: string | null = 'tok-a';
  const client = memoryDataClient(() => token);
  const data = new StudentData('tok-a', STUDENT, client);
  return { client, data, signOut: () => (token = null) };
}

describe('evidence model', () => {
  it('free practice builds proficiency but never unlocks a curriculum gate', () => {
    const run = masteryRun('practice');
    expect(skillStats('pos:5:3', run).status).toBe('mastered');
    expect(gateStats('pos:5:3', run).status).not.toBe('mastered');
    expect(gateStats('pos:5:3', masteryRun('lesson')).status).toBe('mastered');
  });

  it('self-assessed and guided results never count as mastery', () => {
    expect(skillStats('pos:5:3', masteryRun('lesson', 'self')).status).toBe('new');
    expect(gateStats('pos:5:3', masteryRun('assessment', 'guided')).status).toBe('new');
  });
});

describe('StudentData', () => {
  it('records attempts with the student id and earns mastery once', async () => {
    const { data, client } = setup();
    const earned = await data.recordAttempts(masteryRun('lesson'));
    expect(earned).toHaveLength(1);
    expect((client.logs.get('attempts') as Attempt[])[0].studentId).toBe(STUDENT);
    // Replaying the lesson never duplicates the mastery event.
    expect(await data.recordAttempts(masteryRun('lesson'))).toHaveLength(0);
    expect(await data.masteryEvents()).toHaveLength(1);
  });

  it('keeps mastery history when current proficiency later drops', async () => {
    const { data } = setup();
    await data.recordAttempts(masteryRun('lesson'));
    const misses = masteryRun('practice').map((a) => ({ ...a, correct: false, at: a.at.replace('2026-11', '2026-12') }));
    await data.recordAttempts(misses);
    expect(skillStats('pos:5:3', await data.attempts()).status).not.toBe('mastered');
    expect((await data.masteryEvents()).map((e) => e.skillKey)).toEqual(['pos:5:3']);
  });

  it('assessment results only save through commitAssessment', async () => {
    const { data } = setup();
    await expect(data.recordAttempts(masteryRun('assessment'))).rejects.toThrow();
    expect(await data.commitAssessment(masteryRun('assessment'))).toHaveLength(1);
  });

  it('never reports a failed save as saved, and retries it', async () => {
    const { data, client } = setup();
    client.failNext = 1;
    await expect(data.savePreferences({ ...defaultPreferences(), display: { ...defaultPreferences().display, leftHanded: true } })).rejects.toBeInstanceOf(SaveError);
    expect(data.pending).toHaveLength(1);
    expect(await data.retryPending()).toBe(0);
    expect((await data.preferences()).display.leftHanded).toBe(true);
  });

  it('refuses everything after sign-out instead of queueing it', async () => {
    const { data, signOut } = setup();
    signOut();
    await expect(data.saveCheckpoint({ kind: 'lesson', refId: 'l1', state: {} })).rejects.toMatchObject({ code: 'no-session' });
    expect(data.pending).toHaveLength(0);
  });

  it('checkpoints resume lessons but restart assessments', async () => {
    const { data } = setup();
    await data.saveCheckpoint({ kind: 'lesson', refId: 'Lesson 01: A string', state: { step: 3 } });
    const c = await data.loadCheckpoint('lesson', 'Lesson 01: A string');
    expect(c?.state).toEqual({ step: 3 });
    expect(resumeAction(c!)).toBe('resume');
    expect(resumeAction({ kind: 'assessment', refId: 'm1', savedAt: '', state: {} })).toBe('restart');
    expect(checkpointRecord('lesson', 'Lesson 01: A string')).toBe('checkpoints/lesson-lesson-01-a-string');
  });
});

describe('records', () => {
  it('fills defaults and refuses data from a newer app', () => {
    expect(decodeRecord(PREFERENCES, { schemaVersion: 1, data: {} })?.tuner.a4).toBe(440);
    expect(() => decodeRecord(PREFERENCES, { schemaVersion: 99, data: {} })).toThrow();
    expect(() => decodeRecord(PREFERENCES, { schemaVersion: 1, data: { tuner: { a4: 999 } } })).toThrow();
  });
});

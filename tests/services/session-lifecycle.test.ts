import { describe, expect, it, vi } from 'vitest';
import { ADMIN_IDLE_MS, IdleTracker, STUDENT_IDLE_MS } from '../../src/lib/engines/session/activity';
import { bindInputActivity, SessionLifecycle } from '../../src/lib/services/session-lifecycle';
import { memoryDataClient, StudentData } from '../../src/lib/services/student-data';

const MIN = 60_000;
const STUDENT = '0123456789abcdef0123456789abcdef';

describe('IdleTracker', () => {
  it('warns in the last minute and expires at the limit', () => {
    const t = new IdleTracker(STUDENT_IDLE_MS, 0);
    expect(t.state(18 * MIN).phase).toBe('active');
    expect(t.state(19.5 * MIN).phase).toBe('warning');
    expect(t.state(20 * MIN).phase).toBe('expired');
    t.touch(19.5 * MIN);
    expect(t.state(20 * MIN).phase).toBe('active');
  });

  it('counts a recording or timed exercise as activity until it ends', () => {
    const t = new IdleTracker(ADMIN_IDLE_MS, 0);
    const release = t.hold('recording', 0);
    expect(t.state(60 * MIN).phase).toBe('active');
    release(60 * MIN);
    expect(t.state(63 * MIN).phase).toBe('active');
    expect(t.state(65 * MIN).phase).toBe('expired');
  });

  it('a clock moving backwards never shortens the session', () => {
    const t = new IdleTracker(STUDENT_IDLE_MS, 10 * MIN);
    t.touch(0);
    expect(t.state(25 * MIN).phase).toBe('active');
  });
});

function setup(kind: 'student' | 'admin' = 'student') {
  let clock = 0;
  let token: string | null = 'tok';
  const client = memoryDataClient(() => token);
  const data = kind === 'student' ? new StudentData('tok', STUDENT, client) : undefined;
  const order: string[] = [];
  const life = new SessionLifecycle({
    endNativeSession: async () => {
      order.push('end-session');
      token = null;
    },
    stopAudio: () => void order.push('stop-audio'),
    now: () => clock,
  });
  life.begin({ token: 'tok', kind, data });
  return { life, data, client, order, advance: (ms: number) => (clock += ms) };
}

describe('SessionLifecycle', () => {
  it('signs a student out after 20 idle minutes, saving their place first', async () => {
    const { life, data, order, advance } = setup();
    life.onSignOut({ name: 'your place', run: async () => (order.push('checkpoint'), data!.saveCheckpoint({ kind: 'lesson', refId: 'l1', state: { step: 2 } })) });
    const signedOut = vi.fn();
    life.onSignedOut(signedOut);
    advance(18 * MIN);
    expect((await life.tick()).phase).toBe('active');
    advance(MIN);
    expect((await life.tick()).phase).toBe('warning');
    advance(MIN);
    await life.tick();
    expect(order).toEqual(['checkpoint', 'stop-audio', 'end-session']);
    expect(signedOut).toHaveBeenCalledWith({ reason: 'idle', signedOut: true, unsaved: [] });
    expect(life.session).toBeNull();
  });

  it('signs the admin out after 5 idle minutes', async () => {
    const { life, advance } = setup('admin');
    advance(5 * MIN);
    await life.tick();
    expect(life.session).toBeNull();
  });

  it('marks an unfinished assessment interrupted and awards nothing', async () => {
    const { life, data, client } = setup();
    life.onSignOut({ name: 'your assessment', run: () => data!.markAssessmentInterrupted('m2-check') });
    await life.signOut('idle');
    const saved = client.records.get('checkpoints/assessment-m2-check') as { data: { state: unknown } };
    expect(saved.data.state).toEqual({ interrupted: true });
    expect(client.logs.get('attempts')).toBeUndefined();
    expect(client.logs.get('mastery-events')).toBeUndefined();
  });

  it('asks before a manual sign-out loses unsaved work, but the idle limit always finishes', async () => {
    const { life, client } = setup();
    life.onSignOut({ name: 'your place', run: () => Promise.reject(new Error('disk full')) });
    const manual = await life.signOut('manual');
    expect(manual).toEqual({ reason: 'manual', signedOut: false, unsaved: ['your place'] });
    expect(life.session).not.toBeNull();
    const idle = await life.signOut('idle');
    expect(idle.signedOut).toBe(true);
    expect(idle.unsaved).toEqual(['your place']);
  });

  it('retries failed saves before ending the session', async () => {
    const { life, data, client } = setup();
    client.failNext = 1;
    await expect(data!.saveCheckpoint({ kind: 'lesson', refId: 'l1', state: {} })).rejects.toThrow();
    const r = await life.signOut('manual');
    expect(r).toEqual({ reason: 'manual', signedOut: true, unsaved: [] });
    expect(client.records.has('checkpoints/lesson-l1')).toBe(true);
  });

  it('runs once when the idle limit fires during a manual sign-out', async () => {
    const { life, order, advance } = setup();
    advance(20 * MIN);
    await Promise.all([life.signOut('manual'), life.tick(), life.signOut('shutdown')]);
    expect(order.filter((s) => s === 'end-session')).toHaveLength(1);
  });

  it('counts keyboard and pointer input as activity', () => {
    const target = new EventTarget();
    const life = { activity: vi.fn() };
    let now = 0;
    const stop = bindInputActivity(target, life, () => now);
    target.dispatchEvent(new Event('keydown'));
    target.dispatchEvent(new Event('pointermove'));
    target.dispatchEvent(new Event('pointermove'));
    now = 6000;
    target.dispatchEvent(new Event('pointermove'));
    expect(life.activity).toHaveBeenCalledTimes(3);
    stop();
    target.dispatchEvent(new Event('keydown'));
    expect(life.activity).toHaveBeenCalledTimes(3);
  });

  it('going to the background saves places but never signs out or stops audio', async () => {
    const { life, data, client, order } = setup();
    life.onSignOut({ name: 'your place', run: () => void order.push('sign-out step'), checkpoint: () => void order.push('saved place') });
    client.failNext = 1;
    await data!.savePreferences({ ...(await data!.preferences()) }).catch(() => {});
    expect(data!.pending).toHaveLength(1);
    const report = await life.checkpoint();
    expect(order).toEqual(['saved place']);
    expect(report.unsaved).toEqual([]);
    expect(data!.pending).toHaveLength(0);
    expect(life.session).not.toBeNull();
  });

  it('reports a background save that still fails, instead of claiming success', async () => {
    const { life } = setup();
    life.onSignOut({ name: 'your place', run: () => {}, checkpoint: () => Promise.reject(new Error('disk full')) });
    expect((await life.checkpoint()).unsaved).toEqual(['your place']);
    expect(life.session).not.toBeNull();
  });
});


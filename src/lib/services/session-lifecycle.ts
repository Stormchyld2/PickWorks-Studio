/**
 * One signed-in session, from sign-in to sign-out (Planning Update 04, section 4).
 *
 * Every way a session ends (the Sign Out button, the idle limit, closing the
 * app, switching profile) runs the same pipeline, in this order:
 *   1. Screens save their place (lessons checkpoint, assessments are marked
 *      interrupted and award nothing).
 *   2. Audio and recording stop.
 *   3. Failed saves are retried.
 *   4. The native session ends, so any late save is refused.
 *   5. In-memory state is cleared and listeners return to the profile selector.
 *
 * A save that still fails is reported, never hidden. On a manual sign-out the
 * caller can ask the student before continuing; the idle limit, shutdown and
 * a profile switch always finish signing out.
 */
import { IdleTracker, idleLimitMs, type IdleState } from '$lib/engines/session/activity';
import type { StudentData } from './student-data';

export type SignOutReason = 'manual' | 'idle' | 'shutdown' | 'switch';

/** Work a screen must finish before the session ends. Steps run in the order they were registered. */
export interface SignOutStep {
  name: string;
  run(reason: SignOutReason): Promise<void> | void;
  /**
   * Saves the screen's place without ending anything (the app went to the
   * background). Must not stop audio or interrupt an exercise. Optional.
   */
  checkpoint?(): Promise<void> | void;
}

export interface CheckpointReport {
  /** Things that could not be saved, in the student's words. Never reported as saved. */
  unsaved: string[];
}

export interface SignOutReport {
  reason: SignOutReason;
  /** False only when a manual sign-out stopped to ask about unsaved work. */
  signedOut: boolean;
  /** Things that could not be saved, in the student's words ("your place"). */
  unsaved: string[];
}

export interface ActiveSession {
  token: string;
  kind: 'student' | 'admin';
  /** Present for students; the admin has no learning data. */
  data?: StudentData;
}

export interface LifecycleDeps {
  endNativeSession(token: string): Promise<void>;
  stopAudio(): Promise<void> | void;
  now(): number;
}

export class SessionLifecycle {
  private current: ActiveSession | null = null;
  private tracker: IdleTracker | null = null;
  private steps = new Map<number, SignOutStep>();
  private nextStep = 1;
  private ending: Promise<SignOutReport> | null = null;
  private listeners = new Set<(r: SignOutReport) => void>();

  constructor(private deps: LifecycleDeps) {}

  get session(): ActiveSession | null {
    return this.current;
  }

  begin(session: ActiveSession, idleMs = idleLimitMs(session.kind)): void {
    if (this.current) throw new Error('A session is already active; sign out first.');
    this.current = session;
    this.tracker = new IdleTracker(idleMs, this.deps.now());
    this.steps.clear();
  }

  /** Input, a detected note or a submitted answer. */
  activity(): void {
    this.tracker?.touch(this.deps.now());
  }

  /** Keeps the session awake while something runs (recording, timed exercise). */
  hold(reason: string): () => void {
    const release = this.tracker?.hold(reason, this.deps.now());
    return () => release?.(this.deps.now());
  }

  /** Registers work for sign-out. Returns a function to unregister it (call it when the screen closes). */
  onSignOut(step: SignOutStep): () => void {
    const id = this.nextStep++;
    this.steps.set(id, step);
    return () => this.steps.delete(id);
  }

  /** Notified after every completed sign-out (the shell returns to the profile selector). */
  onSignedOut(fn: (r: SignOutReport) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Saves everyone's place when the app goes to the background (Android app
   * switch, Windows minimise). It never signs out, stops audio or interrupts
   * an exercise: sign-out stays with the idle limit and the sign-out button.
   */
  async checkpoint(): Promise<CheckpointReport> {
    const session = this.current;
    if (!session || this.ending) return { unsaved: [] };
    const unsaved: string[] = [];
    for (const step of [...this.steps.values()]) {
      if (!step.checkpoint) continue;
      try {
        await step.checkpoint();
      } catch (e) {
        unsaved.push(describe(e, step.name));
      }
    }
    if (session.data && this.current === session) {
      await session.data.retryPending();
      for (const op of session.data.pending) if (!unsaved.includes(op.what)) unsaved.push(op.what);
    }
    return { unsaved };
  }

  /** Call on a timer. Signs out when the idle limit passes. */
  async tick(): Promise<IdleState> {
    if (!this.tracker || this.ending) return { phase: 'active', remainingMs: Infinity };
    const s = this.tracker.state(this.deps.now());
    if (s.phase === 'expired') await this.signOut('idle');
    return s;
  }

  /**
   * Ends the session. Concurrent calls (an idle timeout during a manual
   * sign-out) share one run.
   */
  signOut(reason: SignOutReason, { force = reason !== 'manual' } = {}): Promise<SignOutReport> {
    if (!this.current) return Promise.resolve({ reason, signedOut: true, unsaved: [] });
    this.ending ??= this.run(reason, force).finally(() => (this.ending = null));
    return this.ending;
  }

  private async run(reason: SignOutReason, force: boolean): Promise<SignOutReport> {
    const session = this.current!;
    const unsaved: string[] = [];

    for (const step of [...this.steps.values()]) {
      try {
        await step.run(reason);
      } catch (e) {
        unsaved.push(describe(e, step.name));
      }
    }
    try {
      await this.deps.stopAudio();
    } catch {
      // Audio that fails to stop is torn down with the page; never block sign-out on it.
    }
    if (session.data) {
      await session.data.retryPending();
      for (const op of session.data.pending) if (!unsaved.includes(op.what)) unsaved.push(op.what);
    }

    if (unsaved.length && !force) return { reason, signedOut: false, unsaved };

    try {
      await this.deps.endNativeSession(session.token);
    } catch {
      // Already ended (signed in elsewhere, app restarted): nothing left to end.
    }
    this.current = null;
    this.tracker = null;
    this.steps.clear();
    const report = { reason, signedOut: true, unsaved };
    for (const fn of this.listeners) fn(report);
    return report;
  }
}

/**
 * Counts keyboard, mouse, touch and wheel input as activity. Mouse movement is
 * sampled at most every few seconds. Returns a function that stops listening.
 */
export function bindInputActivity(target: EventTarget, lifecycle: Pick<SessionLifecycle, 'activity'>, now: () => number = Date.now): () => void {
  let lastMove = -Infinity;
  const onInput = () => lifecycle.activity();
  const onMove = () => {
    const t = now();
    if (t - lastMove >= 5000) {
      lastMove = t;
      lifecycle.activity();
    }
  };
  const inputs = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;
  for (const e of inputs) target.addEventListener(e, onInput, { passive: true });
  target.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    for (const e of inputs) target.removeEventListener(e, onInput);
    target.removeEventListener('pointermove', onMove);
  };
}

function describe(e: unknown, fallback: string): string {
  return e && typeof e === 'object' && 'what' in e && typeof e.what === 'string' ? e.what : fallback;
}

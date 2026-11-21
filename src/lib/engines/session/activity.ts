/**
 * Inactivity tracking (Planning Update 04, section 4).
 *
 * Pure and clock-driven so it can be tested without timers. Input events
 * count as activity, and so does anything that is "busy": playing into the
 * tuner, recording, a running timed exercise. An open window on its own is
 * not activity.
 */

export const STUDENT_IDLE_MS = 20 * 60 * 1000;
export const ADMIN_IDLE_MS = 5 * 60 * 1000;
/** How long before sign-out the "Still there?" warning appears. */
export const WARNING_MS = 60 * 1000;

export type IdleState = { phase: 'active'; remainingMs: number } | { phase: 'warning'; remainingMs: number } | { phase: 'expired' };

export class IdleTracker {
  private lastActivity: number;
  private busy = new Map<number, string>();
  private nextBusyId = 1;

  constructor(
    readonly limitMs: number,
    now: number,
    readonly warningMs = Math.min(WARNING_MS, limitMs / 2),
  ) {
    this.lastActivity = now;
  }

  /** Records user activity (input, a detected note, a completed answer). */
  touch(now: number): void {
    // A clock that went backwards must never shorten the session.
    this.lastActivity = Math.max(this.lastActivity, now);
  }

  /**
   * Marks something as keeping the session active until released (for
   * example a recording). Releasing counts as activity, so the full idle
   * period starts again from then.
   */
  hold(reason: string, now: number): (at: number) => void {
    const id = this.nextBusyId++;
    this.busy.set(id, reason);
    this.touch(now);
    return (at: number) => {
      if (this.busy.delete(id)) this.touch(at);
    };
  }

  get busyReasons(): string[] {
    return [...this.busy.values()];
  }

  state(now: number): IdleState {
    if (this.busy.size) return { phase: 'active', remainingMs: this.limitMs };
    const remainingMs = this.limitMs - Math.max(0, now - this.lastActivity);
    if (remainingMs <= 0) return { phase: 'expired' };
    return remainingMs <= this.warningMs ? { phase: 'warning', remainingMs } : { phase: 'active', remainingMs };
  }
}

/** Idle limit for a signed-in principal. The native core reports the same values. */
export function idleLimitMs(kind: 'student' | 'admin'): number {
  return kind === 'admin' ? ADMIN_IDLE_MS : STUDENT_IDLE_MS;
}

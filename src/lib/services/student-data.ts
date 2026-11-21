/**
 * The signed-in student's data, bound to one session.
 *
 * Every call carries the session token, so after sign-out or a profile switch
 * the native core refuses anything still in flight. Failed saves are never
 * reported as saved: they stay in `pending` and are retried, and the caller
 * is told (Planning Update 04, section 3.3).
 */
import type { Attempt } from '$lib/engines/mastery/attempts';
import { detectNewMastery, type MasteryEvent } from '$lib/engines/mastery/events';
import {
  checkpointRecord,
  CHECKPOINT_VERSION,
  checkpointSchema,
  decodeRecord,
  defaultPreferences,
  PREFERENCES,
  PROFILE,
  type Checkpoint,
  type Preferences,
  type Profile,
} from '$lib/engines/student/records';
import type { Envelope } from './core-client';

/** The part of the native client this module needs (lets tests use a fake). */
export interface DataClient {
  readRecord<T>(token: string, record: string): Promise<Envelope<T> | null>;
  writeRecord<T>(token: string, record: string, envelope: Envelope<T>): Promise<void>;
  appendLog(token: string, log: string, entry: unknown): Promise<void>;
  readLog<T>(token: string, log: string): Promise<T[]>;
}

export const LOGS = { attempts: 'attempts', mastery: 'mastery-events', history: 'session-history' } as const;

export class SaveError extends Error {
  constructor(
    public what: string,
    public cause: unknown,
  ) {
    super(`Couldn't save ${what}. It's kept and will be retried.`);
    this.name = 'SaveError';
  }
}

type PendingOp = { what: string; run: () => Promise<void> };

export class StudentData {
  /** Saves that failed and are waiting to be retried, oldest first. */
  readonly pending: PendingOp[] = [];

  constructor(
    readonly token: string,
    readonly studentId: string,
    private client: DataClient,
  ) {}

  private async save(what: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (e) {
      // A session that has ended can never save again; don't queue for it.
      if ((e as { code?: string }).code === 'no-session') throw e;
      this.pending.push({ what, run });
      throw new SaveError(what, e);
    }
  }

  /** Retries failed saves in order. Returns how many are still pending. */
  async retryPending(): Promise<number> {
    while (this.pending.length) {
      try {
        await this.pending[0].run();
        this.pending.shift();
      } catch {
        break;
      }
    }
    return this.pending.length;
  }

  // ----- Preferences and profile -----------------------------------------

  async preferences(): Promise<Preferences> {
    return decodeRecord(PREFERENCES, await this.client.readRecord(this.token, PREFERENCES.name)) ?? defaultPreferences();
  }

  async savePreferences(p: Preferences): Promise<void> {
    const data = PREFERENCES.schema.parse(p);
    await this.save('your settings', () => this.client.writeRecord(this.token, PREFERENCES.name, { schemaVersion: PREFERENCES.version, data }));
  }

  async profile(): Promise<Profile> {
    return decodeRecord(PROFILE, await this.client.readRecord(this.token, PROFILE.name)) ?? PROFILE.schema.parse({});
  }

  async saveProfile(p: Profile): Promise<void> {
    const data = PROFILE.schema.parse(p);
    await this.save('your profile', () => this.client.writeRecord(this.token, PROFILE.name, { schemaVersion: PROFILE.version, data }));
  }

  // ----- Attempts and mastery --------------------------------------------

  async attempts(): Promise<Attempt[]> {
    return this.client.readLog<Attempt>(this.token, LOGS.attempts);
  }

  async masteryEvents(): Promise<MasteryEvent[]> {
    return this.client.readLog<MasteryEvent>(this.token, LOGS.mastery);
  }

  /**
   * Saves finished practice or lesson attempts, then records any newly earned
   * mastery. Assessment attempts must go through `commitAssessment`.
   */
  async recordAttempts(attempts: readonly Attempt[]): Promise<MasteryEvent[]> {
    if (attempts.some((a) => a.context === 'assessment')) throw new Error('Use commitAssessment for assessment results');
    return this.persistAttempts(attempts);
  }

  /**
   * Saves a completed assessment. Results are only saved once the assessment
   * is finished; an interrupted one is discarded (see `resumeAction`).
   */
  async commitAssessment(attempts: readonly Attempt[]): Promise<MasteryEvent[]> {
    return this.persistAttempts(attempts);
  }

  private async persistAttempts(attempts: readonly Attempt[]): Promise<MasteryEvent[]> {
    const stamped = attempts.map((a) => ({ ...a, studentId: this.studentId }));
    for (const a of stamped) await this.save('a practice result', () => this.client.appendLog(this.token, LOGS.attempts, a));
    const [all, existing] = await Promise.all([this.attempts(), this.masteryEvents()]);
    const earned = detectNewMastery(this.studentId, all, existing);
    for (const e of earned) await this.save('a mastery milestone', () => this.client.appendLog(this.token, LOGS.mastery, e));
    return earned;
  }

  // ----- Checkpoints ------------------------------------------------------

  async saveCheckpoint(c: Omit<Checkpoint, 'savedAt'>, now = new Date()): Promise<void> {
    const data = checkpointSchema.parse({ ...c, savedAt: now.toISOString() });
    await this.save('your place', () => this.client.writeRecord(this.token, checkpointRecord(c.kind, c.refId), { schemaVersion: CHECKPOINT_VERSION, data }));
  }

  async loadCheckpoint(kind: Checkpoint['kind'], refId: string): Promise<Checkpoint | null> {
    const env = await this.client.readRecord<unknown>(this.token, checkpointRecord(kind, refId));
    if (!env) return null;
    if (env.schemaVersion > CHECKPOINT_VERSION) return null;
    const parsed = checkpointSchema.safeParse(env.data);
    return parsed.success ? parsed.data : null;
  }

  /** Marks a checkpoint finished (an empty state means nothing to resume). */
  async clearCheckpoint(kind: Checkpoint['kind'], refId: string, now = new Date()): Promise<void> {
    await this.saveCheckpoint({ kind, refId, state: null }, now);
  }
}

/** In-memory client for tests and the browser preview. Mirrors the native rules for one student. */
export function memoryDataClient(validToken: () => string | null): DataClient & { records: Map<string, unknown>; logs: Map<string, unknown[]>; failNext: number } {
  const records = new Map<string, unknown>();
  const logs = new Map<string, unknown[]>();
  const state = { records, logs, failNext: 0 };
  const check = (token: string) => {
    if (token !== validToken()) throw Object.assign(new Error('not signed in'), { code: 'no-session' });
    if (state.failNext > 0) {
      state.failNext--;
      throw Object.assign(new Error('disk full'), { code: 'io' });
    }
  };
  return Object.assign(state, {
    async readRecord<T>(token: string, record: string) {
      if (token !== validToken()) throw Object.assign(new Error('not signed in'), { code: 'no-session' });
      return (records.get(record) as Envelope<T>) ?? null;
    },
    async writeRecord<T>(token: string, record: string, envelope: Envelope<T>) {
      check(token);
      records.set(record, structuredClone(envelope));
    },
    async appendLog(token: string, log: string, entry: unknown) {
      check(token);
      logs.set(log, [...(logs.get(log) ?? []), structuredClone(entry)]);
    },
    async readLog<T>(token: string, log: string) {
      if (token !== validToken()) throw Object.assign(new Error('not signed in'), { code: 'no-session' });
      return (logs.get(log) ?? []) as T[];
    },
  });
}

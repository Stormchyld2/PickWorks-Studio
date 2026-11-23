/**
 * Student record schemas (versioned, validated). Each record is saved as
 * `{ schemaVersion, data }` in the signed-in student's folder; the native core
 * decides the folder, this module decides the shape.
 */
import { z } from 'zod';
import { A4_CHOICES, DEFAULT_A4 } from '../audio/tuner/tuner';
import { DEFAULT_TUNING_ID } from '../audio/tuner/presets';
import { MAX_BPM, MIN_BPM } from '../audio/metronome';

export const TEXT_SIZES = ['normal', 'large', 'larger'] as const;
export const PRACTICE_MINUTES = [5, 10, 15, 20, 30, 60] as const;

export const preferencesSchema = z.object({
  display: z
    .object({
      leftHanded: z.boolean().default(false),
      textSize: z.enum(TEXT_SIZES).default('normal'),
      highContrast: z.boolean().default(false),
      reducedMotion: z.boolean().default(false),
      focusMode: z.boolean().default(false),
    })
    .default({ leftHanded: false, textSize: 'normal', highContrast: false, reducedMotion: false, focusMode: false }),
  audio: z
    .object({
      inputDeviceId: z.string().nullable().default(null),
      inputChannel: z.number().int().min(0).max(31).default(0),
      outputDeviceId: z.string().nullable().default(null),
      masterVolume: z.number().min(0).max(1).default(0.8),
    })
    .default({ inputDeviceId: null, inputChannel: 0, outputDeviceId: null, masterVolume: 0.8 }),
  tuner: z
    .object({
      a4: z.number().refine((n) => (A4_CHOICES as readonly number[]).includes(n)).default(DEFAULT_A4),
      presetId: z.string().default(DEFAULT_TUNING_ID),
      precise: z.boolean().default(false),
      chime: z.boolean().default(true),
      mode: z.enum(['guided', 'chromatic']).default('guided'),
    })
    .default({ a4: DEFAULT_A4, presetId: DEFAULT_TUNING_ID, precise: false, chime: true, mode: 'guided' }),
  practice: z
    .object({
      metronomeBpm: z.number().int().min(MIN_BPM).max(MAX_BPM).default(80),
      sessionMinutes: z.number().refine((n) => (PRACTICE_MINUTES as readonly number[]).includes(n)).default(10),
      reminders: z.boolean().default(true),
      askBeforeSignOut: z.boolean().default(true),
      highlightOnSignIn: z.boolean().default(true),
    })
    .default({ metronomeBpm: 80, sessionMinutes: 10, reminders: true, askBeforeSignOut: true, highlightOnSignIn: true }),
  rewards: z
    .object({
      showXp: z.boolean().default(true),
      showBadges: z.boolean().default(true),
      showStreak: z.boolean().default(false),
    })
    .default({ showXp: true, showBadges: true, showStreak: false }),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const PREFERENCES_VERSION = 1;
export const defaultPreferences = (): Preferences => preferencesSchema.parse({});

export const profileSchema = z.object({
  pathways: z.array(z.string()).default(['fretboard-foundations']),
  /** Record name of the stored profile picture, or null for the default avatar. */
  avatar: z.string().nullable().default(null),
  createdAt: z.string().optional(),
});
export type Profile = z.infer<typeof profileSchema>;
export const PROFILE_VERSION = 1;

export const CHECKPOINT_KINDS = ['lesson', 'practice', 'assessment'] as const;
export const checkpointSchema = z.object({
  kind: z.enum(CHECKPOINT_KINDS),
  /** Lesson id, practice session id or assessment id. */
  refId: z.string(),
  savedAt: z.string(),
  /** Engine state needed to resume (lesson run, practice session). */
  state: z.unknown(),
});
export type Checkpoint = z.infer<typeof checkpointSchema>;
export const CHECKPOINT_VERSION = 1;

/**
 * What happens to a checkpoint when the student returns (Decision 15).
 * Lessons and practice resume where they stopped. An unfinished assessment
 * always restarts: partial answers are discarded and never grant mastery.
 */
export function resumeAction(c: Checkpoint): 'resume' | 'restart' {
  return c.kind === 'assessment' ? 'restart' : 'resume';
}

/** Checkpoint record names: `checkpoints/<kind>-<slug>`. */
export function checkpointRecord(kind: Checkpoint['kind'], refId: string): string {
  const slug = refId.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
  return `checkpoints/${kind}-${slug}`;
}

export interface RecordSpec<T> {
  name: string;
  version: number;
  schema: z.ZodType<T>;
  /** migrations[i] upgrades data from version i+1 to i+2. */
  migrations: Array<(data: unknown) => unknown>;
}

export const PREFERENCES: RecordSpec<Preferences> = { name: 'preferences', version: PREFERENCES_VERSION, schema: preferencesSchema as z.ZodType<Preferences>, migrations: [] };
export const PROFILE: RecordSpec<Profile> = { name: 'profile', version: PROFILE_VERSION, schema: profileSchema as z.ZodType<Profile>, migrations: [] };

/** Upgrades and validates a stored envelope. Throws on newer or invalid data. */
export function decodeRecord<T>(spec: RecordSpec<T>, envelope: { schemaVersion: number; data: unknown } | null): T | null {
  if (!envelope) return null;
  if (envelope.schemaVersion > spec.version) throw new Error(`${spec.name} was saved by a newer version of PickWorks Studio`);
  let data = envelope.data;
  for (let v = envelope.schemaVersion; v < spec.version; v++) data = spec.migrations[v - 1](data);
  return spec.schema.parse(data);
}

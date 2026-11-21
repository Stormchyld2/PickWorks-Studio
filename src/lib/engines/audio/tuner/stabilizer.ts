import type { PitchEstimate } from '../pitch/mpm';

/**
 * Turns a stream of raw per-frame pitch estimates into a steady reading.
 *
 * - Median of recent frequencies keeps the needle from jittering.
 * - A sudden octave jump (a harmonic grabbing the detector) is ignored until
 *   it persists for several frames.
 * - "Stable" requires several consecutive agreeing readings, so a string is
 *   never declared in tune from a single measurement.
 */
export interface StabilizerOptions {
  /** Frames in the median window. */
  window?: number;
  /** Consecutive frames within `stableSpreadCents` needed to call the reading stable. */
  stableFrames?: number;
  stableSpreadCents?: number;
  /** Frames a new pitch (e.g. a different string or an octave) must persist before it is accepted. */
  switchFrames?: number;
  /** Frames of silence/unclear before the reading is dropped. */
  holdFrames?: number;
}

export type StableReading =
  | { status: 'silent' }
  | { status: 'unclear' }
  | { status: 'pitch'; frequency: number; clarity: number; stable: boolean };

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

export function createStabilizer(options: StabilizerOptions = {}) {
  const window = options.window ?? 5;
  const stableFrames = options.stableFrames ?? 6;
  const stableSpread = options.stableSpreadCents ?? 3;
  const switchFrames = options.switchFrames ?? 3;
  const holdFrames = options.holdFrames ?? 4;

  let history: number[] = [];
  let candidate: number[] = [];
  let missing = 0;
  let lastClarity = 0;
  let lastStatus: 'silent' | 'unclear' = 'silent';

  function median(values: number[]): number {
    const s = [...values].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function current(): StableReading {
    if (history.length === 0) return { status: lastStatus };
    const recent = history.slice(-stableFrames);
    const ref = median(recent);
    const stable = recent.length >= stableFrames && recent.every((f) => Math.abs(cents(f, ref)) <= stableSpread);
    return { status: 'pitch', frequency: median(history.slice(-window)), clarity: lastClarity, stable };
  }

  return {
    push(estimate: PitchEstimate): StableReading {
      if (estimate.kind !== 'pitch') {
        missing++;
        lastStatus = estimate.kind === 'silence' ? 'silent' : 'unclear';
        if (missing >= holdFrames) {
          history = [];
          candidate = [];
        }
        return history.length ? { ...current(), stable: false } as StableReading : { status: lastStatus };
      }
      missing = 0;
      lastClarity = estimate.clarity;
      const f = estimate.frequency;

      if (history.length === 0) {
        history.push(f);
        return current();
      }
      const ref = median(history.slice(-window));
      // More than ~a semitone away: treat as a possible new note or harmonic glitch.
      if (Math.abs(cents(f, ref)) > 80) {
        if (candidate.length && Math.abs(cents(f, median(candidate))) > 80) candidate = [];
        candidate.push(f);
        if (candidate.length >= switchFrames) {
          history = [...candidate];
          candidate = [];
        }
        return current();
      }
      candidate = [];
      history.push(f);
      if (history.length > Math.max(window, stableFrames) * 2) history = history.slice(-Math.max(window, stableFrames));
      return current();
    },
    reset() {
      history = [];
      candidate = [];
      missing = 0;
      lastStatus = 'silent';
    },
  };
}

export type Stabilizer = ReturnType<typeof createStabilizer>;

/**
 * McLeod Pitch Method (MPM) fundamental-frequency detector.
 *
 * Uses the normalised square difference function (NSDF) and picks the first
 * "key maximum" above a fraction of the highest one. That choice is what
 * stops the detector from locking onto a strong harmonic, which plain FFT
 * peak-picking does on guitar strings. Pure TypeScript, no DOM, so it runs
 * the same in the app, a worker and tests.
 *
 * Reference: P. McLeod and G. Wyvill, "A Smarter Way to Find Pitch", 2005.
 */

export interface PitchDetectorOptions {
  sampleRate: number;
  /** Lowest frequency searched, Hz. 55 Hz covers A1, below drop-D's D2 (73.4 Hz). */
  minFrequency?: number;
  /** Highest frequency searched, Hz. */
  maxFrequency?: number;
  /** RMS below this is treated as silence (full scale = 1.0). */
  silenceRms?: number;
  /** Fraction of the highest NSDF peak a key maximum must reach (MPM's k). */
  peakThreshold?: number;
}

export type PitchEstimate =
  | { kind: 'silence'; rms: number }
  | { kind: 'unclear'; rms: number; clarity: number }
  | { kind: 'pitch'; rms: number; frequency: number; clarity: number };

const DEFAULTS = {
  minFrequency: 55,
  maxFrequency: 1400,
  silenceRms: 0.01,
  peakThreshold: 0.9,
};

/** Clarity below this is reported as "unclear" rather than a pitch. */
export const MIN_CLARITY = 0.8;

export function rms(frame: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / Math.max(1, frame.length));
}

export function createPitchDetector(options: PitchDetectorOptions) {
  const opts = { ...DEFAULTS, ...options };
  if (!(opts.sampleRate > 0)) throw new RangeError('sampleRate must be positive');
  const minTau = Math.max(2, Math.floor(opts.sampleRate / opts.maxFrequency));
  const maxTau = Math.ceil(opts.sampleRate / opts.minFrequency);

  return function detect(frame: ArrayLike<number>): PitchEstimate {
    const n = frame.length;
    const level = rms(frame);
    if (level < opts.silenceRms) return { kind: 'silence', rms: level };

    const tauLimit = Math.min(maxTau, Math.floor(n / 2));
    if (tauLimit <= minTau) throw new RangeError(`Frame of ${n} samples is too short for ${opts.minFrequency} Hz`);

    // Remove DC offset so a biased input doesn't skew the NSDF.
    let mean = 0;
    for (let i = 0; i < n; i++) mean += frame[i];
    mean /= n;
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = frame[i] - mean;

    // NSDF: n'(tau) = 2 r(tau) / m(tau)
    const nsdf = new Float64Array(tauLimit + 2);
    for (let tau = 0; tau <= tauLimit + 1; tau++) {
      let acf = 0;
      let m = 0;
      for (let j = 0; j < n - tau; j++) {
        acf += x[j] * x[j + tau];
        m += x[j] * x[j] + x[j + tau] * x[j + tau];
      }
      nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
    }

    // Key maxima: the highest point of each positive lobe after the first
    // negative-going zero crossing.
    const peaks: number[] = [];
    let tau = 1;
    while (tau <= tauLimit && nsdf[tau] > 0) tau++; // skip the lobe around tau = 0
    while (tau <= tauLimit) {
      while (tau <= tauLimit && nsdf[tau] <= 0) tau++;
      let best = -1;
      while (tau <= tauLimit && nsdf[tau] > 0) {
        if (tau >= minTau && (best < 0 || nsdf[tau] > nsdf[best])) best = tau;
        tau++;
      }
      if (best > 0) peaks.push(best);
    }
    if (peaks.length === 0) return { kind: 'unclear', rms: level, clarity: 0 };

    let highest = 0;
    for (const p of peaks) highest = Math.max(highest, nsdf[p]);
    const chosen = peaks.find((p) => nsdf[p] >= opts.peakThreshold * highest) ?? peaks[0];

    // Parabolic interpolation around the chosen peak for sub-sample accuracy.
    const a = nsdf[chosen - 1];
    const b = nsdf[chosen];
    const c = nsdf[chosen + 1];
    const denom = a - 2 * b + c;
    const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    const period = chosen + shift;
    const clarity = Math.min(1, b - 0.25 * (a - c) * shift);

    if (clarity < MIN_CLARITY) return { kind: 'unclear', rms: level, clarity };
    return { kind: 'pitch', rms: level, frequency: opts.sampleRate / period, clarity };
  };
}

export type PitchDetector = ReturnType<typeof createPitchDetector>;

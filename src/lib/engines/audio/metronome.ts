/**
 * Metronome timing, independent of any audio API. The audio service asks
 * for the beats falling inside a short look-ahead window and schedules
 * them, which keeps timing steady even when the UI is busy.
 */
export const MIN_BPM = 30;
export const MAX_BPM = 250;

export interface MetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  /** Accent the first beat of each bar. */
  accentFirst: boolean;
}

export interface Beat {
  /** Seconds, on the same clock as `startTime`. */
  time: number;
  index: number;
  beatInBar: number;
  accent: boolean;
}

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 60;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function secondsPerBeat(bpm: number): number {
  return 60 / clampBpm(bpm);
}

/** Beats with time in [from, to). Beat 0 is at startTime. */
export function beatsBetween(settings: MetronomeSettings, startTime: number, from: number, to: number): Beat[] {
  const spb = secondsPerBeat(settings.bpm);
  const beatsPerBar = Math.max(1, Math.floor(settings.beatsPerBar));
  const first = Math.max(0, Math.ceil((from - startTime) / spb - 1e-9));
  const out: Beat[] = [];
  for (let index = first; ; index++) {
    const time = startTime + index * spb;
    if (time >= to) break;
    const beatInBar = index % beatsPerBar;
    out.push({ time, index, beatInBar, accent: settings.accentFirst && beatInBar === 0 });
  }
  return out;
}

/** Tap tempo: BPM from the average gap between recent taps (ms timestamps). */
export function tapTempo(tapsMs: readonly number[]): number | null {
  const recent = tapsMs.slice(-6);
  if (recent.length < 2) return null;
  const gaps = recent.slice(1).map((t, i) => t - recent[i]).filter((g) => g > 0 && g < 2500);
  if (gaps.length === 0) return null;
  return clampBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
}

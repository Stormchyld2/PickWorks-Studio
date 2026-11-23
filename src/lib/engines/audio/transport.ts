/**
 * Shared musical clock: tempo, bars and beats, start/stop and loop region.
 * The metronome is one consumer; backing tracks, the loop trainer, TAB
 * playback and the chord transition trainer will use the same clock.
 * Pure timing math here; the audio service drives it from the audio clock.
 */
import { clampBpm, secondsPerBeat } from './metronome';

export interface LoopRegion {
  /** First beat of the loop (0-based, absolute beat count). */
  startBeat: number;
  lengthBeats: number;
}

export interface TransportState {
  bpm: number;
  beatsPerBar: number;
  /** Audio-clock time (s) at which `anchorBeat` sounds. */
  anchorTime: number;
  /** Beat position (may be fractional) at anchorTime. */
  anchorBeat: number;
  loop: LoopRegion | null;
}

export interface TransportBeat {
  /** Audio-clock time, seconds. */
  time: number;
  /** Ever-increasing beat count since start (useful for scheduling). */
  tick: number;
  /** Musical position after looping. */
  beat: number;
  bar: number;
  beatInBar: number;
  downbeat: boolean;
}

export function createTransport(bpm: number, beatsPerBar = 4, startTime = 0): TransportState {
  return { bpm: clampBpm(bpm), beatsPerBar: Math.max(1, Math.floor(beatsPerBar)), anchorTime: startTime, anchorBeat: 0, loop: null };
}

/** Linear (unlooped) beat position at a time. */
export function tickAt(t: TransportState, time: number): number {
  return t.anchorBeat + (time - t.anchorTime) / secondsPerBeat(t.bpm);
}

export function timeOfTick(t: TransportState, tick: number): number {
  return t.anchorTime + (tick - t.anchorBeat) * secondsPerBeat(t.bpm);
}

/** Maps a linear tick to its musical beat, wrapping inside the loop region once reached. */
export function loopedBeat(tick: number, loop: LoopRegion | null): number {
  if (!loop || loop.lengthBeats <= 0 || tick < loop.startBeat) return tick;
  return loop.startBeat + ((tick - loop.startBeat) % loop.lengthBeats);
}

/** Changes tempo at `time` without a jump in position. */
export function setTempo(t: TransportState, bpm: number, time: number): TransportState {
  return { ...t, bpm: clampBpm(bpm), anchorTime: time, anchorBeat: tickAt(t, time) };
}

export function setLoop(t: TransportState, loop: LoopRegion | null): TransportState {
  return { ...t, loop };
}

/** Whole-beat events with time in [from, to). */
export function transportBeats(t: TransportState, from: number, to: number): TransportBeat[] {
  const out: TransportBeat[] = [];
  const first = Math.max(0, Math.ceil(tickAt(t, from) - 1e-9));
  for (let tick = first; ; tick++) {
    const time = timeOfTick(t, tick);
    if (time >= to) break;
    const beat = loopedBeat(tick, t.loop);
    const beatInBar = beat % t.beatsPerBar;
    out.push({ time, tick, beat, bar: Math.floor(beat / t.beatsPerBar), beatInBar, downbeat: beatInBar === 0 });
  }
  return out;
}

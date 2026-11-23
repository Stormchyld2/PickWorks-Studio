import {
  createTransport,
  setLoop,
  setTempo,
  transportBeats,
  type LoopRegion,
  type TransportBeat,
  type TransportState,
} from '$lib/engines/audio/transport';
import { audioEngine } from './audio-engine';

export type BeatListener = (beat: TransportBeat, ctx: AudioContext) => void;

const LOOKAHEAD_S = 0.12;
const INTERVAL_MS = 25;

/**
 * Drives the shared clock from the audio context with look-ahead scheduling.
 * Listeners receive each beat slightly ahead of time with its exact audio
 * time, so they can schedule sound sample-accurately.
 */
class TransportService {
  private state: TransportState = createTransport(80);
  private timer: ReturnType<typeof setInterval> | null = null;
  private scheduledUntil = 0;
  private listeners = new Set<BeatListener>();

  get running(): boolean {
    return this.timer !== null;
  }

  get bpm(): number {
    return this.state.bpm;
  }

  get beatsPerBar(): number {
    return this.state.beatsPerBar;
  }

  subscribe(listener: BeatListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(bpm = this.state.bpm, beatsPerBar = this.state.beatsPerBar) {
    const ctx = audioEngine.context();
    this.stop();
    const startAt = ctx.currentTime + 0.1;
    this.state = { ...createTransport(bpm, beatsPerBar, startAt), loop: this.state.loop };
    this.scheduledUntil = startAt;
    this.timer = setInterval(() => this.tick(), INTERVAL_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setBpm(bpm: number) {
    const now = this.running ? this.scheduledUntil : audioEngine.context().currentTime;
    this.state = setTempo(this.state, bpm, now);
  }

  setLoop(loop: LoopRegion | null) {
    this.state = setLoop(this.state, loop);
  }

  private tick() {
    const ctx = audioEngine.context();
    const until = ctx.currentTime + LOOKAHEAD_S;
    for (const beat of transportBeats(this.state, this.scheduledUntil, until)) for (const l of this.listeners) l(beat, ctx);
    this.scheduledUntil = until;
  }
}

export const transport = new TransportService();

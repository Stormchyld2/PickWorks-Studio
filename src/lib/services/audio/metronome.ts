import type { TransportBeat } from '$lib/engines/audio/transport';
import { audioEngine } from './audio-engine';
import { transport } from './transport';

/**
 * Metronome clicks as a consumer of the shared transport, so it stays in
 * time with backing tracks, loops and lesson playback that use the same clock.
 */
export class Metronome {
  volume = 0.6;
  muted = false;
  accentFirst = true;
  /** Clicks per beat: 1 quarter notes, 2 eighths, 3 triplets, 4 sixteenths. */
  subdivision: 1 | 2 | 3 | 4 = 1;
  onBeat?: (beatInBar: number) => void;
  private unsubscribe: (() => void) | null = null;

  get running(): boolean {
    return this.unsubscribe !== null;
  }

  /** Starts clicking. Starts the transport too if nothing else has. */
  start(bpm?: number, beatsPerBar?: number) {
    if (!transport.running) transport.start(bpm, beatsPerBar);
    else if (bpm) transport.setBpm(bpm);
    this.unsubscribe ??= transport.subscribe((beat, ctx) => this.click(beat, ctx));
  }

  stop({ stopTransport = true } = {}) {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (stopTransport) transport.stop();
  }

  setBpm(bpm: number) {
    transport.setBpm(bpm);
  }

  private tone(ctx: AudioContext, time: number, frequency: number, level: number) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.value = frequency;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(env).connect(audioEngine.output());
    osc.start(time);
    osc.stop(time + 0.06);
  }

  private click(beat: TransportBeat, ctx: AudioContext) {
    const accent = this.accentFirst && beat.downbeat;
    const level = this.muted ? 0 : this.volume * (accent ? 1 : 0.7);
    this.tone(ctx, beat.time, accent ? 1760 : 1175, level);
    const spb = 60 / transport.bpm;
    for (let k = 1; k < this.subdivision; k++) this.tone(ctx, beat.time + (k * spb) / this.subdivision, 880, level * 0.45);
    if (this.onBeat) setTimeout(() => this.onBeat?.(beat.beatInBar), Math.max(0, (beat.time - ctx.currentTime) * 1000));
  }
}

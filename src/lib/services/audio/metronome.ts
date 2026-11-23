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

  private click(beat: TransportBeat, ctx: AudioContext) {
    const accent = this.accentFirst && beat.downbeat;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.value = accent ? 1760 : 1175;
    const level = this.muted ? 0 : this.volume * (accent ? 1 : 0.7);
    env.gain.setValueAtTime(0.0001, beat.time);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), beat.time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, beat.time + 0.05);
    osc.connect(env).connect(audioEngine.output());
    osc.start(beat.time);
    osc.stop(beat.time + 0.06);
    if (this.onBeat) setTimeout(() => this.onBeat?.(beat.beatInBar), Math.max(0, (beat.time - ctx.currentTime) * 1000));
  }
}

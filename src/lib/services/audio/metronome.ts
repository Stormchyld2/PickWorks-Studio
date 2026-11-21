import { beatsBetween, type MetronomeSettings } from '$lib/engines/audio/metronome';

/** Web Audio metronome using look-ahead scheduling for steady timing. */
export class Metronome {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private scheduledUntil = 0;
  settings: MetronomeSettings = { bpm: 80, beatsPerBar: 4, accentFirst: true };
  volume = 0.6;
  muted = false;
  onBeat?: (beatInBar: number) => void;

  get running(): boolean {
    return this.timer !== null;
  }

  start() {
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    this.startTime = this.ctx.currentTime + 0.1;
    this.scheduledUntil = this.startTime;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.gain?.disconnect();
    this.gain = null;
  }

  /** Changing tempo restarts the beat grid from the next beat. */
  setBpm(bpm: number) {
    this.settings = { ...this.settings, bpm };
    if (this.ctx && this.running) {
      this.startTime = this.scheduledUntil;
    }
  }

  private schedule() {
    if (!this.ctx || !this.gain) return;
    const until = this.ctx.currentTime + 0.12;
    for (const beat of beatsBetween(this.settings, this.startTime, this.scheduledUntil, until)) this.click(beat.time, beat.accent, beat.beatInBar);
    this.scheduledUntil = until;
  }

  private click(time: number, accent: boolean, beatInBar: number) {
    if (!this.ctx || !this.gain) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.value = accent ? 1760 : 1175;
    const level = this.muted ? 0 : this.volume * (accent ? 1 : 0.7);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(env).connect(this.gain);
    osc.start(time);
    osc.stop(time + 0.06);
    if (this.onBeat) {
      const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
      setTimeout(() => this.onBeat?.(beatInBar), delay);
    }
  }
}

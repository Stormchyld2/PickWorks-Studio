/**
 * Reference tones and confirmation sounds, synthesised with Web Audio
 * (works offline, no audio files). A plucked-string-like tone: bright
 * attack, decaying through a low-pass filter.
 */

import { audioEngine } from './audio-engine';

const ctx = () => audioEngine.context();

export function playReferenceTone(frequency: number, { seconds = 2.5, volume = 0.5 } = {}): void {
  const ac = ctx();
  const now = ac.currentTime;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(volume * 0.6, now + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(8000, frequency * 12), now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(200, frequency * 2), now + seconds);
  filter.connect(out).connect(audioEngine.output());

  for (const [type, gain] of [
    ['sawtooth', 0.35],
    ['triangle', 0.65],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const g = ac.createGain();
    g.gain.value = gain;
    osc.connect(g).connect(filter);
    osc.start(now);
    osc.stop(now + seconds + 0.05);
  }
}

/** Short two-note chime played when a string reaches pitch (optional). */
export function playInTuneChime(volume = 0.25): void {
  const ac = ctx();
  const now = ac.currentTime;
  [880, 1318.5].forEach((f, i) => {
    const t = now + i * 0.09;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(g).connect(audioEngine.output());
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

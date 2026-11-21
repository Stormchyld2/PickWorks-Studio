import { describe, expect, it } from 'vitest';
import { createPitchDetector } from '$lib/engines/audio';

/** Guitar-like tone: fundamental plus decaying harmonics. */
function tone(
  freq: number,
  sampleRate: number,
  n: number,
  harmonics: number[] = [1, 0.6, 0.4, 0.25, 0.15, 0.1],
  amplitude = 0.3,
  noise = 0,
): Float32Array {
  const out = new Float32Array(n);
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const norm = harmonics.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((h, k) => (v += h * Math.sin((2 * Math.PI * freq * (k + 1) * i) / sampleRate + k)));
    out[i] = (amplitude * v) / norm + noise * rand();
  }
  return out;
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);
const OPEN_STRINGS = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];

describe('MPM pitch detector', () => {
  for (const sampleRate of [44100, 48000]) {
    const detect = createPitchDetector({ sampleRate });

    it(`detects every open string within 1 cent at ${sampleRate} Hz`, () => {
      for (const f of OPEN_STRINGS) {
        const r = detect(tone(f, sampleRate, 2048));
        expect(r.kind).toBe('pitch');
        if (r.kind === 'pitch') {
          expect(Math.abs(cents(r.frequency, f))).toBeLessThan(1);
          expect(r.clarity).toBeGreaterThan(0.9);
        }
      }
    });
  }

  const detect = createPitchDetector({ sampleRate: 48000 });

  it('detects drop-D low D (73.4 Hz)', () => {
    const r = detect(tone(73.42, 48000, 2048));
    expect(r.kind === 'pitch' && Math.abs(cents(r.frequency, 73.42)) < 1).toBe(true);
  });

  it('measures a slightly flat string accurately', () => {
    const flat = 110 * 2 ** (-12 / 1200); // 12 cents flat
    const r = detect(tone(flat, 48000, 2048));
    expect(r.kind === 'pitch' && Math.abs(cents(r.frequency, 110) + 12) < 1).toBe(true);
  });

  it('finds the fundamental when the 2nd harmonic is louder (no octave error)', () => {
    const r = detect(tone(110, 48000, 2048, [0.4, 1, 0.5, 0.3]));
    expect(r.kind === 'pitch' && Math.abs(cents(r.frequency, 110)) < 2).toBe(true);
  });

  it('still works with moderate background noise', () => {
    const r = detect(tone(196, 48000, 2048, undefined, 0.3, 0.03));
    expect(r.kind === 'pitch' && Math.abs(cents(r.frequency, 196)) < 3).toBe(true);
  });

  it('reports silence for quiet input', () => {
    expect(detect(new Float32Array(2048)).kind).toBe('silence');
    expect(detect(tone(110, 48000, 2048, undefined, 0.002)).kind).toBe('silence');
  });

  it('reports pure noise as unclear rather than inventing a pitch', () => {
    let seed = 7;
    const noise = Float32Array.from({ length: 2048 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.5);
    expect(detect(noise).kind).toBe('unclear');
  });
});

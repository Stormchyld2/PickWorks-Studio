import { describe, expect, it } from 'vitest';
import {
  TUNING_PRESETS,
  centsOff,
  chromaticReading,
  createStabilizer,
  getPreset,
  guidedAdvice,
  nearestString,
} from '$lib/engines/audio';
import { pitchName } from '$lib/engines/music-theory';

const lowToHigh = (id: string) =>
  [...getPreset(id).strings].sort((a, b) => b.number - a.number).map((s) => pitchName(s.openMidi, s.label.includes('b') ? 'flat' : 'sharp'));

describe('tuning presets', () => {
  it('defines the picker presets with standard first', () => {
    expect(TUNING_PRESETS.filter((p) => p.inPicker).map((p) => p.id)).toEqual(['standard', 'drop-d', 'half-step-down', 'open-g']);
  });

  it('uses the correct open-string pitches', () => {
    expect(lowToHigh('standard')).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(lowToHigh('drop-d')).toEqual(['D2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(lowToHigh('half-step-down')).toEqual(['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4']);
    expect(lowToHigh('open-g')).toEqual(['D2', 'G2', 'D3', 'G3', 'B3', 'D4']);
    expect(lowToHigh('whole-step-down')).toEqual(['D2', 'G2', 'C3', 'F3', 'A3', 'D4']);
  });

  it('numbers strings 1 to 6', () => {
    for (const p of TUNING_PRESETS) expect(p.strings.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('tuner readings', () => {
  it('computes cents against a target and A4 reference', () => {
    expect(centsOff(110, 45)).toBeCloseTo(0, 6);
    expect(centsOff(110 * 2 ** (5 / 1200), 45)).toBeCloseTo(5, 6);
    expect(centsOff(441 / 4, 45, 441)).toBeCloseTo(0, 6);
  });

  it('names the nearest chromatic note', () => {
    const r = chromaticReading(112);
    expect(r).toMatchObject({ name: 'A', octave: 2 });
    expect(r.cents).toBeCloseTo(31.2, 0);
  });

  it('detects which string is being tuned', () => {
    const std = getPreset('standard');
    expect(nearestString(std, 108).number).toBe(5);
    expect(nearestString(std, 80).number).toBe(6);
    expect(nearestString(std, 250).number).toBe(2);
    expect(nearestString(getPreset('drop-d'), 74).number).toBe(6);
  });

  it('gives guided instructions with an over-tightening warning', () => {
    expect(guidedAdvice(3, 5).direction).toBe('in-tune');
    expect(guidedAdvice(-20, 5)).toMatchObject({ direction: 'raise', message: 'Too low. Tighten slightly.' });
    expect(guidedAdvice(20, 5)).toMatchObject({ direction: 'lower', message: 'Too high. Loosen slightly.' });
    expect(guidedAdvice(150, 5).message).toContain('right string');
    expect(guidedAdvice(-3, 2).direction).toBe('raise');
  });
});

describe('stabilizer', () => {
  const p = (frequency: number) => ({ kind: 'pitch' as const, frequency, clarity: 0.97, rms: 0.2 });

  it('is not stable after one reading', () => {
    const s = createStabilizer();
    const r = s.push(p(110));
    expect(r.status === 'pitch' && r.stable).toBe(false);
  });

  it('becomes stable after consistent readings', () => {
    const s = createStabilizer();
    let r = s.push(p(110));
    for (let i = 0; i < 6; i++) r = s.push(p(110 + (i % 2 ? 0.05 : -0.05)));
    expect(r.status === 'pitch' && r.stable).toBe(true);
  });

  it('ignores a one-frame octave jump', () => {
    const s = createStabilizer();
    for (let i = 0; i < 6; i++) s.push(p(110));
    const r = s.push(p(220));
    expect(r.status === 'pitch' && Math.abs(r.frequency - 110) < 0.5).toBe(true);
  });

  it('switches to a new string once it persists', () => {
    const s = createStabilizer();
    for (let i = 0; i < 6; i++) s.push(p(110));
    let r = s.push(p(146.8));
    r = s.push(p(146.8));
    r = s.push(p(146.8));
    expect(r.status === 'pitch' && Math.abs(r.frequency - 146.8) < 0.5).toBe(true);
  });

  it('drops the reading after sustained silence', () => {
    const s = createStabilizer();
    for (let i = 0; i < 6; i++) s.push(p(110));
    let r = s.push({ kind: 'silence', rms: 0 });
    expect(r.status).toBe('pitch');
    for (let i = 0; i < 4; i++) r = s.push({ kind: 'silence', rms: 0 });
    expect(r.status).toBe('silent');
  });
});

import { advanceTuneAll, createCustomTuning, currentString, skipString, startTuneAll } from '$lib/engines/audio';

describe('custom tunings', () => {
  it('builds a valid custom tuning', () => {
    const t = createCustomTuning({ name: 'My Open C', lowToHigh: ['C2', 'G2', 'C3', 'G3', 'C4', 'E4'] }, 'custom-1');
    expect(t.strings.find((s) => s.number === 6)?.openMidi).toBe(36);
    expect(t.strings.find((s) => s.number === 1)?.openMidi).toBe(64);
    expect(t.notes).toBe('C G C G C E');
  });

  it('rejects bad input', () => {
    expect(() => createCustomTuning({ name: '', lowToHigh: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] })).toThrow();
    expect(() => createCustomTuning({ name: 'x', lowToHigh: ['E2', 'A2'] })).toThrow();
    expect(() => createCustomTuning({ name: 'x', lowToHigh: ['E2', 'A2', 'D3', 'G3', 'B3', 'Q4'] })).toThrow();
    expect(() => createCustomTuning({ name: 'x', lowToHigh: ['E0', 'A2', 'D3', 'G3', 'B3', 'E4'] })).toThrow();
  });
});

describe('tune all six strings', () => {
  const std = getPreset('standard');
  const frame = (frequency: number | null, stable = true) => ({ frequency, stable, elapsedMs: 100, a4: 440, toleranceCents: 5 });

  it('starts on the 6th string and goes to the 1st', () => {
    const s = startTuneAll(std);
    expect(s.order).toEqual([6, 5, 4, 3, 2, 1]);
    expect(currentString(s)).toBe(6);
  });

  it('marks a string done only after holding in tune', () => {
    let s = startTuneAll(std);
    for (let i = 0; i < 9; i++) s = advanceTuneAll(s, std, frame(82.41));
    expect(s.done).toEqual([]);
    s = advanceTuneAll(s, std, frame(82.41));
    expect(s.done).toEqual([6]);
    expect(currentString(s)).toBe(5);
  });

  it('resets the hold when the pitch drifts or is unstable', () => {
    let s = startTuneAll(std);
    for (let i = 0; i < 8; i++) s = advanceTuneAll(s, std, frame(82.41));
    s = advanceTuneAll(s, std, frame(84));
    expect(s.heldMs).toBe(0);
    s = advanceTuneAll(s, std, frame(82.41, false));
    expect(s.heldMs).toBe(0);
  });

  it('finishes after all six, and allows skipping', () => {
    let s = startTuneAll(std);
    for (let i = 0; i < 6; i++) s = skipString(s);
    expect(s.finished).toBe(true);
    expect(currentString(s)).toBeNull();
  });
});

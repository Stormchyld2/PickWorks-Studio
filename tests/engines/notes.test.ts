import { describe, expect, it } from 'vitest';
import {
  enharmonicSpellings,
  formatSpelling,
  frequencyToMidi,
  midiToFrequency,
  noteName,
  octaveOf,
  parsePitchClass,
  pitchName,
  spell,
  toPitchClass,
} from '$lib/engines/music-theory';

describe('pitch classes and spelling', () => {
  it('wraps any integer into 0..11', () => {
    expect(toPitchClass(12)).toBe(0);
    expect(toPitchClass(-1)).toBe(11);
    expect(toPitchClass(64)).toBe(4);
  });

  it('spells naturals without accidentals regardless of preference', () => {
    expect(noteName(0, 'flat')).toBe('C');
    expect(noteName(4, 'sharp')).toBe('E');
  });

  it('spells black-key notes as sharps or flats', () => {
    const sharps = [1, 3, 6, 8, 10].map((pc) => noteName(toPitchClass(pc), 'sharp'));
    const flats = [1, 3, 6, 8, 10].map((pc) => noteName(toPitchClass(pc), 'flat'));
    expect(sharps).toEqual(['C#', 'D#', 'F#', 'G#', 'A#']);
    expect(flats).toEqual(['Db', 'Eb', 'Gb', 'Ab', 'Bb']);
  });

  it('parses note names including unicode and doubles', () => {
    expect(parsePitchClass('C#')).toBe(1);
    expect(parsePitchClass('Db')).toBe(1);
    expect(parsePitchClass('bb')).toBe(10);
    expect(parsePitchClass('E#')).toBe(5);
    expect(parsePitchClass('Cb')).toBe(11);
    expect(parsePitchClass('F♯')).toBe(6);
    expect(parsePitchClass('G##')).toBe(9);
    expect(() => parsePitchClass('H')).toThrow();
  });

  it('round-trips every pitch class through spelling', () => {
    for (let pc = 0; pc < 12; pc++) {
      for (const pref of ['sharp', 'flat'] as const) {
        expect(parsePitchClass(formatSpelling(spell(toPitchClass(pc), pref)))).toBe(pc);
      }
    }
  });

  it('lists enharmonic spellings', () => {
    expect(enharmonicSpellings(1).map((s) => formatSpelling(s))).toEqual(['C#', 'Db']);
    expect(enharmonicSpellings(5).map((s) => formatSpelling(s)).sort()).toEqual(['E#', 'F']);
  });

  it('formats unicode accidentals', () => {
    expect(formatSpelling(spell(10, 'flat'), true)).toBe('B♭');
  });
});

describe('octaves and frequency', () => {
  it('uses scientific pitch notation', () => {
    expect(octaveOf(60)).toBe(4);
    expect(pitchName(40)).toBe('E2');
    expect(pitchName(45)).toBe('A2');
    expect(pitchName(64)).toBe('E4');
  });

  it('converts between frequency and MIDI', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440);
    expect(midiToFrequency(45)).toBeCloseTo(110);
    expect(midiToFrequency(40)).toBeCloseTo(82.41, 2);
    const r = frequencyToMidi(445);
    expect(r.midi).toBe(69);
    expect(r.cents).toBeCloseTo(19.56, 1);
    expect(() => frequencyToMidi(0)).toThrow();
  });
});

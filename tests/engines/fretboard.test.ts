import { describe, expect, it } from 'vitest';
import {
  allPositions,
  markerAt,
  midiAt,
  octavesOf,
  positionsOfMidi,
  positionsOfPitchClass,
  positionsOnString,
  resolve,
} from '$lib/engines/fretboard';
import { STANDARD_TUNING, noteName, parsePitchClass, pitchName, ordinal } from '$lib/engines/music-theory';

const T = STANDARD_TUNING;
const FULL = { minFret: 0, maxFret: 24 };
const TWELVE = { minFret: 0, maxFret: 12 };

describe('standard tuning', () => {
  it('has E A D G B E from 6th to 1st string', () => {
    const lowToHigh = [6, 5, 4, 3, 2, 1].map((n) => pitchName(midiAt(T, { string: n, fret: 0 })));
    expect(lowToHigh).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  });
});

describe('note calculation', () => {
  it('finds C at the 3rd fret of the A string', () => {
    const p = resolve(T, { string: 5, fret: 3 });
    expect(noteName(p.pitchClass)).toBe('C');
    expect(p.octave).toBe(3);
    expect(positionsOnString(T, 5, parsePitchClass('C'), TWELVE).map((x) => x.fret)).toEqual([3]);
  });

  it('matches an independent chromatic walk on every string and fret 0-24', () => {
    const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const openIndex: Record<number, number> = { 1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4 };
    for (let s = 1; s <= 6; s++) {
      for (let f = 0; f <= 24; f++) {
        expect(noteName(resolve(T, { string: s, fret: f }).pitchClass)).toBe(chromatic[(openIndex[s] + f) % 12]);
      }
    }
  });

  it('repeats every note one octave up at the 12th fret', () => {
    for (let s = 1; s <= 6; s++) {
      const open = resolve(T, { string: s, fret: 0 });
      const twelfth = resolve(T, { string: s, fret: 12 });
      expect(twelfth.pitchClass).toBe(open.pitchClass);
      expect(twelfth.octave).toBe(open.octave + 1);
    }
  });

  it('treats the B string as 4 semitones above G, all others 5', () => {
    expect(midiAt(T, { string: 3, fret: 4 })).toBe(midiAt(T, { string: 2, fret: 0 }));
    expect(midiAt(T, { string: 6, fret: 5 })).toBe(midiAt(T, { string: 5, fret: 0 }));
  });

  it('rejects frets outside 0-24 and unknown strings', () => {
    expect(() => midiAt(T, { string: 1, fret: 25 })).toThrow();
    expect(() => midiAt(T, { string: 1, fret: -1 })).toThrow();
    expect(() => midiAt(T, { string: 7, fret: 0 })).toThrow();
  });
});

describe('queries', () => {
  it('counts 6 x 13 positions on a 12-fret board', () => {
    expect(allPositions(T, TWELVE)).toHaveLength(78);
  });

  it('finds every C in the first 12 frets', () => {
    const cs = positionsOfPitchClass(T, 0, TWELVE).map((p) => `${p.string}:${p.fret}`).sort();
    expect(cs).toEqual(['1:8', '2:1', '3:5', '4:10', '5:3', '6:8'].sort());
  });

  it('finds unisons of a pitch', () => {
    // A2 (MIDI 45): open A string and 5th fret of low E
    expect(positionsOfMidi(T, 45, TWELVE).map((p) => `${p.string}:${p.fret}`).sort()).toEqual(['5:0', '6:5']);
  });

  it('finds octaves of a position', () => {
    const fromA3 = octavesOf(T, { string: 5, fret: 3 }, TWELVE);
    expect(fromA3.every((p) => p.pitchClass === 0)).toBe(true);
    expect(fromA3).toHaveLength(5);
    expect(positionsOfPitchClass(T, 4, FULL).length).toBeGreaterThan(10);
  });

  it('marks fret inlays including the double 12th', () => {
    expect(markerAt(12)).toBe('double');
    expect(markerAt(24)).toBe('double');
    expect([3, 5, 7, 9].map(markerAt)).toEqual(['single', 'single', 'single', 'single']);
    expect(markerAt(4)).toBe('none');
  });

  it('formats ordinals for instructions', () => {
    expect([1, 2, 3, 4, 5, 11, 12, 13, 21].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '5th', '11th', '12th', '13th', '21st']);
  });
});

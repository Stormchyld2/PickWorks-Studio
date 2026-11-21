import { describe, expect, it } from 'vitest';
import { STANDARD_TUNING, getChordQuality, getScale, parseSpelling, parsePitchClass, spellChord, spellScale, chordSymbol } from '../../src/lib/engines/music-theory';
import { STARTER_CHORDS, analyzeShape, chordDiagram, chordShapeSchema, findChord, validateShape } from '../../src/lib/engines/chords';
import { scalePositions } from '../../src/lib/engines/fretboard';

describe('scales', () => {
  it('spells scales with one letter per note', () => {
    expect(spellScale(parseSpelling('F'), getScale('major'))).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
    expect(spellScale(parseSpelling('D#'), getScale('harmonic-minor'))).toEqual(['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C##']);
    expect(spellScale(parseSpelling('A'), getScale('minor-pentatonic'))).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect(spellScale(parseSpelling('A'), getScale('blues'))).toEqual(['A', 'C', 'D', 'Eb', 'E', 'G']);
    expect(spellScale(parseSpelling('Eb'), getScale('chromatic'))[1]).toBe('E');
  });

  it('places scale notes on the neck with interval labels', () => {
    const pos = scalePositions(STANDARD_TUNING, parsePitchClass('A'), getScale('minor-pentatonic'), { minFret: 5, maxFret: 8 });
    const low = pos.filter((p) => p.string === 6).map((p) => [p.fret, p.label]);
    expect(low).toEqual([[5, 'R'], [8, 'b3']]);
    expect(pos.filter((p) => p.isRoot)).toHaveLength(3);
  });
});

describe('chord theory', () => {
  it('spells chords correctly', () => {
    expect(spellChord(parseSpelling('Eb'), getChordQuality('major'))).toEqual(['Eb', 'G', 'Bb']);
    expect(spellChord(parseSpelling('Ab'), getChordQuality('minor'))).toEqual(['Ab', 'Cb', 'Eb']);
    expect(spellChord(parseSpelling('B'), getChordQuality('diminished7'))).toEqual(['B', 'D', 'F', 'Ab']);
    expect(chordSymbol(parseSpelling('F#'), getChordQuality('minor7'))).toBe('F#m7');
  });
});

describe('chord shapes', () => {
  it('every bundled shape is valid for its chord and tuning', () => {
    for (const shape of STARTER_CHORDS) expect(validateShape(shape, STANDARD_TUNING), shape.id).toEqual([]);
  });

  it('calculates the notes from the tuning instead of storing them', () => {
    const c = analyzeShape(findChord('c-major-open')!, STANDARD_TUNING);
    expect(c.symbol).toBe('C');
    expect(c.notes.map((n) => n.name)).toEqual([null, 'C', 'E', 'G', 'C', 'E']);
    expect(c.bass).toBe('R');
    const f = analyzeShape(findChord('f-major-barre-e')!, STANDARD_TUNING);
    expect(f.notes.map((n) => n.interval)).toEqual(['R', '5', 'R', '3', '5', 'R']);
  });

  it('rejects shapes that are not the chord they claim, or are unplayable', () => {
    const wrong = chordShapeSchema.parse({ ...findChord('c-major-open')!, id: 'bad', quality: 'minor' });
    expect(validateShape(wrong, STANDARD_TUNING).join(' ')).toMatch(/not in Cm|b3 is missing/);
    const noFinger = chordShapeSchema.parse({ ...findChord('a-major-open')!, id: 'bad2', fingers: [null, null, 1, 2, null, null] });
    expect(validateShape(noFinger, STANDARD_TUNING)).toContain('string 2 is fretted with no finger');
    const noBarre = chordShapeSchema.parse({ ...findChord('f-major-barre-e')!, id: 'bad3', barres: [] });
    expect(validateShape(noBarre, STANDARD_TUNING).some((p) => p.includes('without a barre'))).toBe(true);
    const stretch = chordShapeSchema.parse({ id: 'bad4', root: 'E', quality: 'power', frets: [0, 2, 9, null, null, null], fingers: [null, 1, 4, null, null, null] });
    expect(validateShape(stretch, STANDARD_TUNING)).toContain('the stretch is wider than 5 frets');
  });
});

describe('chord diagrams', () => {
  it('lays out an open chord with the nut, open and muted strings', () => {
    const d = chordDiagram(findChord('c-major-open')!, STANDARD_TUNING);
    expect(d.title).toBe('C');
    expect(d.showNut).toBe(true);
    expect(d.columns).toEqual([6, 5, 4, 3, 2, 1]);
    expect(d.top).toEqual(['muted', null, null, 'open', null, 'open']);
    expect(d.dots).toContainEqual({ column: 1, row: 3, label: '3', isRoot: true });
  });

  it('starts a barre chord higher up the neck and draws the barre once', () => {
    const d = chordDiagram(findChord('b-minor-barre-a')!, STANDARD_TUNING);
    expect(d.baseFret).toBe(1);
    const high = chordDiagram(chordShapeSchema.parse({ ...findChord('b-minor-barre-a')!, id: 'bm7', frets: [null, 7, 9, 9, 8, 7], barres: [{ fret: 7, fromString: 5, toString: 1, finger: 1 }], root: 'E' }), STANDARD_TUNING);
    expect(high.baseFret).toBe(7);
    expect(high.showNut).toBe(false);
    expect(high.barres).toEqual([{ fromColumn: 1, toColumn: 5, row: 1, label: '1' }]);
    expect(high.dots.map((x) => x.row).sort()).toEqual([2, 3, 3]);
  });

  it('mirrors for left-handed players without changing any note', () => {
    const r = chordDiagram(findChord('g-major-open')!, STANDARD_TUNING);
    const l = chordDiagram(findChord('g-major-open')!, STANDARD_TUNING, { leftHanded: true });
    expect(l.columns).toEqual([...r.columns].reverse());
    expect(l.top).toEqual([...r.top].reverse());
    const at = (d: typeof r) => d.dots.map((x) => `${d.columns[x.column]}:${x.row}:${x.label}`).sort();
    expect(at(l)).toEqual(at(r));
  });

  it('never reveals the answer in an assessment', () => {
    const d = chordDiagram(findChord('a-minor-open')!, STANDARD_TUNING, { conceal: true, labels: 'notes' });
    expect(d.title).toBeNull();
    expect(d.dots.every((x) => !x.isRoot && /^[1-4T]?$/.test(x.label ?? ''))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { beatsBetween, clampBpm, secondsPerBeat, tapTempo } from '$lib/engines/audio';
import { DEFAULT_WORKSHEET, describeWorksheet, labelledPositions, layoutPage, renderWorksheetSvg } from '$lib/engines/print';

describe('metronome timing', () => {
  it('clamps tempo and computes beat length', () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(400)).toBe(250);
    expect(secondsPerBeat(120)).toBe(0.5);
  });

  it('lists beats in a window with the bar accent', () => {
    const beats = beatsBetween({ bpm: 120, beatsPerBar: 4, accentFirst: true }, 10, 10, 12.01);
    expect(beats.map((b) => b.time)).toEqual([10, 10.5, 11, 11.5, 12]);
    expect(beats.map((b) => b.accent)).toEqual([true, false, false, false, true]);
    const later = beatsBetween({ bpm: 120, beatsPerBar: 4, accentFirst: true }, 10, 10.6, 11.2);
    expect(later.map((b) => b.index)).toEqual([2]);
  });

  it('computes tap tempo', () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(tapTempo([0])).toBeNull();
  });
});

describe('print worksheets', () => {
  it('uses landscape Letter by default', () => {
    const l = layoutPage(DEFAULT_WORKSHEET);
    expect([l.width, l.height]).toEqual([792, 612]);
    expect(l.boards).toHaveLength(1);
  });

  it('lays out 1, 2, 4 or 6 boards inside the margins', () => {
    for (const n of [1, 2, 4, 6] as const) {
      for (const paper of ['letter', 'a4', 'legal'] as const) {
        const l = layoutPage({ ...DEFAULT_WORKSHEET, boardsPerPage: n, paper });
        expect(l.boards).toHaveLength(n);
        for (const b of l.boards) {
          expect(b.x).toBeGreaterThanOrEqual(l.margin);
          expect(b.y + b.height).toBeLessThanOrEqual(l.height - l.margin + 0.01);
          expect(b.x + b.width).toBeLessThanOrEqual(l.width - l.margin + 0.01);
        }
      }
    }
  });

  it('labels positions by style from the shared note engine', () => {
    expect(labelledPositions({ ...DEFAULT_WORKSHEET, style: 'blank' })).toHaveLength(0);
    expect(labelledPositions({ ...DEFAULT_WORKSHEET, style: 'all-notes', frets: 12 })).toHaveLength(78);
    expect(labelledPositions({ ...DEFAULT_WORKSHEET, style: 'anchor', frets: 5 }).every((p) => p.fret <= 5)).toBe(true);
    const svg = renderWorksheetSvg({ ...DEFAULT_WORKSHEET, style: 'all-notes', frets: 5 });
    expect(svg).toContain('>C</text>');
    expect(svg).toContain('Fretboard Practice');
    expect(svg).toContain('Exercise / Notes:');
    expect(svg).not.toMatch(/#(?!000|fff)[0-9a-f]{3,6}/i); // black and white only
  });

  it('describes the configuration like the mockup card', () => {
    expect(describeWorksheet(DEFAULT_WORKSHEET)).toBe('12-fret guitar • Blank fretboard • US Letter • 1 per page');
  });
});

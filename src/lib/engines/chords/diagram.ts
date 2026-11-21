/**
 * Lays out a chord diagram from a shape. One layout feeds the on-screen
 * renderer and Print Studio, so both always agree.
 *
 * Left-handed mode mirrors the picture only (locked decision 4): the notes,
 * fingers and theory never change. In an assessment, `conceal` hides the
 * chord name and note labels so the diagram never gives the answer away
 * (locked decision 1).
 */
import type { Tuning } from '../music-theory/tuning';
import { analyzeShape, stringOrder, type ChordShape } from './shape';

export type DiagramLabels = 'fingers' | 'notes' | 'intervals' | 'none';

export interface DiagramOptions {
  leftHanded?: boolean;
  /** Fret rows drawn (default 4, or more if the shape needs it). */
  fretsShown?: number;
  labels?: DiagramLabels;
  /** Assessment mode: no chord name and no note or interval labels. */
  conceal?: boolean;
}

export interface DiagramDot {
  column: number;
  /** 1 = first fret row shown. */
  row: number;
  label: string | null;
  isRoot: boolean;
}

export interface DiagramBarre {
  fromColumn: number;
  toColumn: number;
  row: number;
  label: string | null;
}

export interface ChordDiagram {
  title: string | null;
  /** Fret number of the first row. 1 means the nut is drawn. */
  baseFret: number;
  showNut: boolean;
  rows: number;
  /** Guitar string numbers from left to right. */
  columns: number[];
  /** Above the nut: "open", "muted" or nothing, per column. */
  top: ('open' | 'muted' | null)[];
  dots: DiagramDot[];
  barres: DiagramBarre[];
}

export function chordDiagram(shape: ChordShape, tuning: Tuning, options: DiagramOptions = {}): ChordDiagram {
  const { leftHanded = false, conceal = false } = options;
  const labels: DiagramLabels = conceal && (options.labels === 'notes' || options.labels === 'intervals') ? 'fingers' : (options.labels ?? 'fingers');
  const a = analyzeShape(shape, tuning);
  const minRows = options.fretsShown ?? 4;
  const span = a.minFret !== null && a.maxFret !== null ? a.maxFret - a.minFret + 1 : 1;
  const baseFret = a.maxFret === null || a.maxFret <= Math.max(minRows, 4) ? 1 : a.minFret!;
  const rows = Math.max(minRows, baseFret === 1 ? (a.maxFret ?? 1) : span);

  // Right-handed diagrams show the lowest string on the left; left-handed mirrors that.
  const low = stringOrder(tuning);
  const columns = leftHanded ? [...low].reverse() : low;
  const col = (string: number) => columns.indexOf(string);

  const barreKeys = new Set<string>();
  const barres: DiagramBarre[] = shape.barres.map((b) => {
    const cols = [col(b.fromString), col(b.toString)].sort((x, y) => x - y);
    for (const n of a.notes) {
      const between = n.string <= Math.max(b.fromString, b.toString) && n.string >= Math.min(b.fromString, b.toString);
      if (between && n.fret === b.fret) barreKeys.add(`${n.string}:${n.fret}`);
    }
    return { fromColumn: cols[0], toColumn: cols[1], row: b.fret - baseFret + 1, label: labels === 'fingers' ? String(b.finger) : null };
  });

  const labelFor = (n: (typeof a.notes)[number]) => (labels === 'fingers' ? (n.finger === null ? null : String(n.finger)) : labels === 'notes' ? n.name : labels === 'intervals' ? n.interval : null);

  const dots: DiagramDot[] = a.notes
    .filter((n) => n.fret !== null && n.fret > 0 && !barreKeys.has(`${n.string}:${n.fret}`))
    .map((n) => ({ column: col(n.string), row: n.fret! - baseFret + 1, label: labelFor(n), isRoot: !conceal && n.interval === 'R' }));

  const top = columns.map((string) => {
    const n = a.notes.find((x) => x.string === string)!;
    return n.fret === null ? 'muted' : n.fret === 0 ? 'open' : null;
  });

  return { title: conceal ? null : a.symbol, baseFret, showNut: baseFret === 1, rows, columns, top, dots, barres };
}

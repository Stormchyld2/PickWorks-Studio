/**
 * Chord shapes as data (Native Chord Diagram Generator, Planning Update 02).
 *
 * A shape records only where the fingers go. Note names and intervals are
 * calculated from the tuning and the positions with the note and fretboard
 * engines, and every shape is checked against its chord before use.
 */
import { z } from 'zod';
import { midiAt } from '../fretboard/fretboard';
import { chordSymbol, chordToneLabel, getChordQuality } from '../music-theory/chords';
import { formatSpelling, parseSpelling, spellingToPitchClass, toPitchClass, type PitchClass } from '../music-theory/notes';
import { spellAbove } from '../music-theory/spelling';
import type { Tuning } from '../music-theory/tuning';

/** Finger numbers: 1 index, 2 middle, 3 ring, 4 little, T thumb. */
export type Finger = 1 | 2 | 3 | 4 | 'T';

export const chordShapeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Root as written, e.g. "C", "F#", "Bb". */
  root: z.string(),
  /** A chord quality id, e.g. "major", "minor7". */
  quality: z.string(),
  tuningId: z.string().default('standard'),
  /** One entry per string from the lowest-pitched (string 6) to the highest (string 1): a fret number, or null for a muted string. */
  frets: z.array(z.number().int().min(0).max(24).nullable()).min(4).max(12),
  /** Finger for each string in the same order; null for open or muted strings. */
  fingers: z.array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal('T')]).nullable()),
  /** A finger laid across several strings at one fret. Strings are guitar numbers (6 = low E). */
  barres: z
    .array(z.object({ fret: z.number().int().min(1), fromString: z.number().int(), toString: z.number().int(), finger: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) }))
    .default([]),
  /** Optional note on the voicing, e.g. "E-shape barre". */
  voicing: z.string().optional(),
});

export type ChordShape = z.infer<typeof chordShapeSchema>;

export interface ShapeNote {
  /** Guitar string number (1 = high E). */
  string: number;
  fret: number | null;
  midi: number | null;
  pitchClass: PitchClass | null;
  /** Spelled within the chord, e.g. "Bb" in Gm. */
  name: string | null;
  /** Interval label within the chord, e.g. "R", "b3". */
  interval: string | null;
  finger: Finger | null;
}

export interface ShapeAnalysis {
  symbol: string;
  notes: ShapeNote[];
  /** Lowest sounding note's interval: "R" means root position. */
  bass: string | null;
  /** Lowest and highest fretted (non-open) frets. */
  minFret: number | null;
  maxFret: number | null;
}

/** String numbers in the shape's order: lowest-pitched string first. */
export function stringOrder(tuning: Tuning): number[] {
  return [...tuning.strings].sort((a, b) => a.openMidi - b.openMidi).map((s) => s.number);
}

/** Works out every note of a shape from the tuning. Nothing is typed in by hand. */
export function analyzeShape(shape: ChordShape, tuning: Tuning): ShapeAnalysis {
  const root = parseSpelling(shape.root);
  const rootPc = spellingToPitchClass(root);
  const quality = getChordQuality(shape.quality);
  const order = stringOrder(tuning);
  const notes = order.map((string, i): ShapeNote => {
    const fret = shape.frets[i] ?? null;
    if (fret === null) return { string, fret, midi: null, pitchClass: null, name: null, interval: null, finger: null };
    const midi = midiAt(tuning, { string, fret });
    const pc = toPitchClass(midi);
    const interval = chordToneLabel(rootPc, quality, pc);
    const idx = quality.intervals.findIndex((semi) => toPitchClass(rootPc + semi) === pc);
    const spelled = idx >= 0 ? spellAbove(root, quality.intervals[idx], quality.degrees[idx]) : null;
    return { string, fret, midi, pitchClass: pc, name: spelled ? formatSpelling(spelled) : null, interval, finger: shape.fingers[i] ?? null };
  });
  const sounding = notes.filter((n) => n.midi !== null).sort((a, b) => a.midi! - b.midi!);
  const fretted = notes.map((n) => n.fret).filter((f): f is number => f !== null && f > 0);
  return {
    symbol: chordSymbol(root, quality),
    notes,
    bass: sounding[0]?.interval ?? null,
    minFret: fretted.length ? Math.min(...fretted) : null,
    maxFret: fretted.length ? Math.max(...fretted) : null,
  };
}

/**
 * Checks a shape is playable and really is the chord it claims to be.
 * Returns a list of problems; an empty list means the shape is valid.
 */
export function validateShape(shape: ChordShape, tuning: Tuning): string[] {
  const problems: string[] = [];
  if (shape.tuningId !== tuning.id) problems.push(`written for tuning "${shape.tuningId}", not "${tuning.id}"`);
  if (shape.frets.length !== tuning.strings.length) return [...problems, `has ${shape.frets.length} strings, tuning has ${tuning.strings.length}`];
  if (shape.fingers.length !== shape.frets.length) return [...problems, 'fingers and frets have different lengths'];
  let a: ShapeAnalysis;
  try {
    a = analyzeShape(shape, tuning);
  } catch (e) {
    return [...problems, (e as Error).message];
  }
  const quality = getChordQuality(shape.quality);
  const soundingCount = a.notes.filter((n) => n.midi !== null).length;
  if (soundingCount < Math.min(3, quality.intervals.length)) problems.push('too few strings sound');
  for (const n of a.notes) {
    if (n.midi !== null && n.interval === null) problems.push(`string ${n.string} plays a note that is not in ${a.symbol}`);
    if (n.fret === 0 && n.finger !== null) problems.push(`string ${n.string} is open but has a finger`);
    if (n.fret !== null && n.fret > 0 && n.finger === null) problems.push(`string ${n.string} is fretted with no finger`);
  }
  const present = new Set(a.notes.map((n) => n.interval).filter(Boolean));
  if (!present.has('R')) problems.push('the root is missing');
  // The 3rd (or its replacement in sus/power chords) defines the chord.
  const defining = quality.labels.find((l) => /^(b?3|2|4)$/.test(l));
  if (defining && !present.has(defining)) problems.push(`the ${defining} is missing`);
  if (a.minFret !== null && a.maxFret !== null && a.maxFret - a.minFret > 4) problems.push('the stretch is wider than 5 frets');

  for (const b of shape.barres) {
    const covered = a.notes.filter((n) => n.string <= Math.max(b.fromString, b.toString) && n.string >= Math.min(b.fromString, b.toString));
    if (covered.length < 2) problems.push(`barre at fret ${b.fret} covers fewer than 2 strings`);
    for (const n of covered) {
      if (n.fret !== null && n.fret < b.fret) problems.push(`string ${n.string} is under the barre at fret ${b.fret} but plays fret ${n.fret}`);
    }
    const onBarre = covered.filter((n) => n.fret === b.fret);
    if (onBarre.some((n) => n.finger !== b.finger)) problems.push(`barre at fret ${b.fret} should use finger ${b.finger} on every barred note`);
  }
  // One finger can't be on two different frets (barres are the exception).
  const used = new Map<Finger, number>();
  for (const n of a.notes) {
    if (n.finger === null || n.fret === null) continue;
    const prev = used.get(n.finger);
    if (prev !== undefined && prev !== n.fret) problems.push(`finger ${n.finger} is on two frets`);
    if (prev !== undefined && prev === n.fret && n.finger !== 'T' && !shape.barres.some((b) => b.finger === n.finger && b.fret === n.fret)) {
      problems.push(`finger ${n.finger} covers two strings at fret ${n.fret} without a barre`);
    }
    used.set(n.finger, n.fret);
  }
  return problems;
}

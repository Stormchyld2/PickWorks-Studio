/**
 * Checks the approved chord manifest (docs/chords/chord-manifest.csv).
 *
 * Every row's notes, intervals, bass note and root string are recalculated
 * from its frets, independently of the stored text, and every fingering is
 * checked for playability. Shapes whose chord quality the app already knows
 * are also run through the app's own validateShape(). This validates data
 * only: the chord catalog pipeline (X0.3) is not part of this change.
 */
import { describe, expect, it } from 'vitest';
import csvText from '../../docs/chords/chord-manifest.csv?raw';
import { validateShape, type ChordShape } from '$lib/engines/chords/shape';
import { STARTER_CHORDS } from '$lib/engines/chords/library';
import { STANDARD_TUNING } from '$lib/engines/music-theory';

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const records: string[][] = [];
  let field = '';
  let rec: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { rec.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      rec.push(field); field = '';
      if (rec.some((f) => f !== '')) records.push(rec);
      rec = [];
    } else field += c;
  }
  if (field !== '' || rec.length) { rec.push(field); records.push(rec); }
  const [head, ...body] = records;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const rows = parseCsv(csvText);
const OPEN = [40, 45, 50, 55, 59, 64]; // strings 6..1, standard tuning
const LETTERS = 'CDEFGAB';
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Interval label: [semitones above the root, letter steps above the root]. */
const INTERVAL: Record<string, [number, number]> = {
  R: [0, 0], '2': [2, 1], '9': [2, 1], '#9': [3, 1], b3: [3, 2], '3': [4, 2], '4': [5, 3],
  b5: [6, 4], '5': [7, 4], '#5': [8, 4], '6': [9, 5], '13': [9, 5], bb7: [9, 6], b7: [10, 6], '7': [11, 6],
};
/** Chord suffix after the root, and the formula it must have. */
const FORMULA: Record<string, string> = {
  '': 'R 3 5', m: 'R b3 5', '5': 'R 5', '7': 'R 3 5 b7', maj7: 'R 3 5 7', m7: 'R b3 5 b7',
  sus2: 'R 2 5', sus4: 'R 4 5', add9: 'R 3 5 9', '6': 'R 3 5 6', m6: 'R b3 5 6', '9': 'R 3 5 b7 9',
  maj9: 'R 3 5 7 9', m9: 'R b3 5 b7 9', '13': 'R 3 5 b7 9 13', '7#9': 'R 3 5 b7 #9', dim7: 'R b3 b5 bb7',
  m7b5: 'R b3 b5 b7', aug: 'R 3 #5',
};
/** App quality ids, for the cross-check with validateShape(). */
const APP_QUALITY: Record<string, string> = {
  '': 'major', m: 'minor', '5': 'power', '7': 'dominant7', maj7: 'major7', m7: 'minor7', sus2: 'sus2', sus4: 'sus4',
  add9: 'add9', '6': 'major6', m6: 'minor6', '9': 'dominant9', dim7: 'diminished7', m7b5: 'half-diminished', aug: 'augmented',
};

const pc = (sp: string) => (NATURAL[sp[0]] + [...sp.slice(1)].reduce((n, ch) => n + (ch === '#' ? 1 : -1), 0) + 120) % 12;
function spell(root: string, label: string): string {
  const [semi, steps] = INTERVAL[label];
  const letter = LETTERS[(LETTERS.indexOf(root[0]) + steps) % 7];
  let diff = (pc(root) + semi - NATURAL[letter] + 120) % 12;
  if (diff > 6) diff -= 12;
  return letter + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
}
function parseName(name: string) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(name);
  if (!m) throw new Error(`can't read chord name ${name}`);
  return { root: m[1], suffix: m[2], slash: m[3] ?? null };
}
const frets = (s: string) => s.split(' ').map((t) => (t === 'x' ? null : Number(t)));
const fingers = (s: string) => s.split(' ').map((t) => (t === '–' ? null : t === 'T' ? 'T' : Number(t))) as (number | 'T' | null)[];
function barre(s: string) {
  if (!s) return null;
  const m = /^fret (\d+), strings (\d)–(\d), finger (\d)$/.exec(s);
  if (!m) throw new Error(`can't read barre "${s}"`);
  return { fret: +m[1], from: Math.max(+m[2], +m[3]), to: Math.min(+m[2], +m[3]), finger: +m[4] };
}

/** Recalculates the stored note text from the frets and checks the fingering. Returns problems. */
function check(r: Row): string[] {
  const p: string[] = [];
  const { root, suffix, slash } = parseName(r.name);
  const formula = FORMULA[suffix];
  if (!formula) return [`unknown chord suffix "${suffix}"`];
  // Am/G is taught as Am7 with G in the bass, so its formula includes the b7.
  const expected = r.id === 'am-over-g' ? 'R b3 5 b7' : formula;
  if (r.formula !== expected) p.push(`formula "${r.formula}" doesn't match ${r.name} (${expected})`);
  const labels = r.formula.split(' ');
  const f = frets(r.frets);
  const g = fingers(r.fingers);
  if (f.length !== 6 || g.length !== 6) return [...p, 'needs 6 strings of frets and fingers'];
  const sounding: { string: number; midi: number; name: string; label: string }[] = [];
  f.forEach((fret, i) => {
    if (fret === null) return;
    const midi = OPEN[i] + fret;
    const label = labels.find((l) => (pc(root) + INTERVAL[l][0]) % 12 === midi % 12);
    if (!label) p.push(`string ${6 - i} plays a note outside ${r.name}`);
    else sounding.push({ string: 6 - i, midi, name: spell(root, label), label });
  });
  const notes = sounding.map((n) => `${n.name}(${n.label})`).join(' ');
  if (notes !== r.notes) p.push(`notes should read "${notes}", not "${r.notes}"`);
  const bass = sounding.reduce((a, b) => (b.midi < a.midi ? b : a));
  if (`${bass.name} (${bass.label})` !== r.bass) p.push(`bass should be ${bass.name} (${bass.label}), not ${r.bass}`);
  const rootStrings = sounding.filter((n) => n.label === 'R').map((n) => n.string);
  if (!rootStrings.length) p.push('the root is missing');
  else if (r.root !== `${root} on string ${Math.max(...rootStrings)}`) p.push(`root column should be "${root} on string ${Math.max(...rootStrings)}"`);
  const present = new Set(sounding.map((n) => n.label));
  const defining = labels.find((l) => ['3', 'b3', '2', '4'].includes(l));
  if (defining && !present.has(defining)) p.push(`the defining ${defining} is missing`);
  if (sounding.length < Math.min(3, labels.length)) p.push('too few strings sound');
  // A non-root bass must be named (slash chord) or explained.
  if (slash && spell(root, labels.find((l) => (pc(root) + INTERVAL[l][0]) % 12 === pc(slash)) ?? 'R') !== slash) p.push(`${slash} isn't a chord tone of ${r.name}`);
  if (slash && bass.name !== slash) p.push(`bass is ${bass.name} but the name says /${slash}`);
  if (!slash && bass.label !== 'R' && !/inversion/i.test(r.group) && !/in the bass/i.test(r.review_note)) p.push(`bass is the ${bass.label} but nothing says so`);

  // Fingering.
  const b = barre(r.barre);
  const fretted = f.filter((x): x is number => x !== null && x > 0);
  if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 4) p.push('stretch wider than 5 frets');
  const at = new Map<number | 'T', Set<number>>();
  f.forEach((fret, i) => {
    const s = 6 - i;
    const finger = g[i];
    if (fret === null && finger !== null) p.push(`string ${s} is muted but has a finger`);
    if (fret === 0 && finger !== null) p.push(`string ${s} is open but has a finger`);
    if (fret !== null && fret > 0 && finger === null) p.push(`string ${s} is fretted with no finger`);
    if (fret !== null && fret > 0 && finger !== null) {
      if (!at.has(finger)) at.set(finger, new Set());
      at.get(finger)!.add(fret);
      const shared = f.some((ff, j) => j !== i && ff === fret && g[j] === finger);
      if (shared && finger !== 'T' && !(b && b.finger === finger && b.fret === fret && s <= b.from && s >= b.to)) {
        p.push(`finger ${finger} covers string ${s} at fret ${fret} without a barre`);
      }
    }
  });
  for (const [finger, set] of at) if (set.size > 1) p.push(`finger ${finger} is on two frets`);
  // Lower-numbered fingers never sit on a higher fret than higher-numbered ones.
  const order = [1, 2, 3, 4].filter((n) => at.has(n)).map((n) => Math.min(...at.get(n)!));
  if (order.some((v, i) => i > 0 && v < order[i - 1])) p.push('fingers cross over (a lower finger on a higher fret)');
  if (b) {
    if (b.from - b.to < 1) p.push('barre covers fewer than 2 strings');
    for (let s = b.to; s <= b.from; s++) {
      const fret = f[6 - s];
      if (fret !== null && fret < b.fret) p.push(`string ${s} is under the barre at fret ${b.fret} but plays fret ${fret}`);
      if (fret === b.fret && g[6 - s] !== b.finger) p.push(`barred string ${s} should use finger ${b.finger}`);
    }
    if (f[6 - b.from] !== b.fret || f[6 - b.to] !== b.fret) p.push('a barre must press its outer strings');
  }
  return p;
}

const primaries = rows.filter((r) => r.role === 'primary');
const alternatives = rows.filter((r) => r.role === 'alternative');

describe('approved chord manifest', () => {
  it('is the approved 85-shape manifest: 74 primaries and 11 alternatives', () => {
    expect(rows).toHaveLength(85);
    expect(primaries).toHaveLength(74);
    expect(alternatives).toHaveLength(11);
  });

  it('lists exactly the shapes whose qualities the production engine cannot check yet', () => {
    const unsupported = rows.filter((r) => r.id !== 'am-over-g' && !(parseName(r.name).suffix in APP_QUALITY)).map((r) => r.name);
    // These need maj9, m9, 13 and 7#9 added to the theory engine (X0.2) before the full library is released.
    expect(unsupported.sort()).toEqual(['Cm9', 'Cmaj9', 'E7#9', 'G13']);
  });

  it('has unique ids, one primary per entry and alternatives that point at a primary', () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(primaries.map((r) => Number(r.n))).toEqual(primaries.map((_, i) => i + 1));
    for (const a of alternatives) {
      expect(primaries.some((p) => p.id === a.alternative_of), a.id).toBe(true);
      expect(a.name, a.id).toBe(primaries.find((p) => p.id === a.alternative_of)!.name);
    }
    expect(rows.every((r) => r.review === 'approved 2026-11-23')).toBe(true);
  });

  it('keeps every shape of the original 75-shape manifest', () => {
    const original = [
      'c-major-open', 'a-major-open', 'g-major-open', 'e-major-open', 'd-major-open', 'a-minor-open', 'e-minor-open', 'd-minor-open',
      'a7-open', 'b7-open', 'c7-open', 'd7-open', 'e7-open', 'g7-open', 'em7-open', 'cadd9-open', 'asus2-open', 'asus4-open',
      'dsus2-open', 'dsus4-open', 'e5-power', 'a5-power', 'fmaj7-open', 'f-major-barre-e', 'e-shape-minor-barre', 'e-shape-7-barre',
      'e-shape-m7-barre', 'a-shape-major-barre', 'b-minor-barre-a', 'a-shape-7-barre', 'a-shape-m7-barre', 'a-shape-maj7-barre',
      'f-major-small', 'b-minor-small', 'power-root6', 'power-root5', 'cmaj7-open', 'amaj7-open', 'dmaj7-open', 'gmaj7-open',
      'am7-open', 'dm7-open', 'esus4-open', 'd-over-fsharp', 'g-over-b', 'c-over-g', 'am-over-g', 'dom9-root5', 'dom9-root6',
      'maj9-root5', 'm9-root5', 'dom13-root6', 'dom7sharp9-root5', 'dim7-root5', 'm7b5-root6', 'm7b5-root5', 'aug-root5',
      'major6-root5', 'minor6-root5', 'sus4-root6', 'sus4-root5', 'add9-root5', 'major-triad-root', 'major-triad-first',
      'major-triad-second', 'minor-triad-root', 'minor-triad-first', 'minor-triad-second', 'drop2-maj7', 'drop2-7', 'drop2-m7',
      'drop2-m7b5', 'caged-c-shape', 'caged-g-shape', 'caged-d-shape',
    ];
    expect(original).toHaveLength(75);
    for (const id of original) expect(rows.some((r) => r.id === id), id).toBe(true);
  });

  it.each(rows.map((r) => [r.id, r] as const))('%s: notes, intervals, bass and fingering are right', (_id, r) => {
    expect(check(r)).toEqual([]);
  });

  it('catches the mistakes it is meant to catch', () => {
    const base = rows.find((r) => r.id === 'cadd9-open')!;
    const bad = (change: Row) => check({ ...base, ...change });
    expect(bad({ frets: '0 3 2 0 3 3', fingers: '– 2 1 – 3 4' }).join()).toMatch(/bass should be E/); // low E not muted
    expect(bad({ name: 'Cmaj7' }).join()).toMatch(/formula/);
    expect(bad({ notes: 'C(R) E(3) G(5) D(9) A(6)' }).join()).toMatch(/notes should read/);
    expect(bad({ fingers: '– 2 1 – 3 3' }).join()).toMatch(/without a barre/);
    expect(bad({ fingers: '– 1 2 – 3 4' }).join()).toMatch(/cross over/);
    expect(bad({ frets: 'x 3 2 0 3 4' }).join()).toMatch(/outside Cadd9/);
    expect(check({ ...rows.find((r) => r.id === 'minor-triad-first')!, group: 'Other' }).join()).toMatch(/nothing says so/);
  });

  it('agrees with the app validator for every quality the app knows', () => {
    let checked = 0;
    for (const r of rows) {
      const { root, suffix } = parseName(r.name);
      const quality = r.id === 'am-over-g' ? 'minor7' : APP_QUALITY[suffix];
      if (!quality) continue;
      const b = barre(r.barre);
      const shape: ChordShape = {
        id: r.id, root, quality, tuningId: STANDARD_TUNING.id,
        frets: frets(r.frets),
        fingers: fingers(r.fingers) as ChordShape['fingers'],
        barres: b ? [{ fret: b.fret, fromString: b.from, toString: b.to, finger: b.finger as 1 | 2 | 3 | 4 }] : [],
      };
      expect(validateShape(shape, STANDARD_TUNING), r.id).toEqual([]);
      checked++;
    }
    expect(checked).toBe(81);
  });

  it('records the approved corrections exactly', () => {
    const get = (id: string) => rows.find((r) => r.id === id)!;
    const primaryFor = (name: string, id: string) => {
      const r = get(id);
      expect(r.role, id).toBe('primary');
      expect(r.name).toBe(name);
      return r;
    };
    expect(primaryFor('Em7', 'em7-open-full').frets).toBe('0 2 2 0 3 0');
    expect(primaryFor('Gmaj7', 'gmaj7-open')).toMatchObject({ frets: '3 2 0 0 0 2', fingers: '3 2 – – – 1' });
    expect(primaryFor('Bm', 'b-minor-barre-a').frets).toBe('x 2 4 4 3 2');
    expect(primaryFor('Cadd9', 'cadd9-open').frets).toBe('x 3 2 0 3 3');
    expect(primaryFor('C6', 'c6-open').frets).toBe('x 3 2 2 1 0');
    expect(primaryFor('G9', 'g9-root5')).toMatchObject({ frets: 'x 10 9 10 10 10', fingers: '– 2 1 3 3 3' });
    expect(primaryFor('A', 'caged-g-shape-four-string')).toMatchObject({ frets: 'x x 2 2 2 5', fingers: '– – 1 1 1 4' });
    expect(primaryFor('D/F#', 'd-over-fsharp').fingers).toBe('T – – 1 3 2');
    expect(get('d-over-fsharp-fingered')).toMatchObject({ role: 'alternative', fingers: '2 – – 1 4 3' });
    // Every Bm, Em7, G9, C6 and A shape the manifest had is still there.
    for (const id of ['em7-open', 'b-minor-small', 'dom9-root6', 'major6-root5', 'caged-g-shape']) expect(get(id).role).toBe('alternative');
  });

  it('matches the 27 shapes the app ships today, which keep their ids', () => {
    for (const s of STARTER_CHORDS) {
      const r = rows.find((x) => x.id === s.id);
      expect(r, s.id).toBeDefined();
      expect(frets(r!.frets), s.id).toEqual(s.frets);
      expect(fingers(r!.fingers), s.id).toEqual(s.fingers);
    }
    expect(STARTER_CHORDS).toHaveLength(27);
  });
});

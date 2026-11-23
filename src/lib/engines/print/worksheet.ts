/**
 * Print Studio worksheet layout. Produces black-and-white SVG pages from
 * the same tuning and fretboard model as the interactive fretboard, so
 * printed note positions can never disagree with the app. PDF export and
 * printing wrap this output (UI phase).
 */
import { markerAt, resolve, type FretPosition } from '../fretboard/fretboard';
import { noteName, type AccidentalPreference } from '../music-theory/notes';
import { STANDARD_TUNING, type Tuning } from '../music-theory/tuning';
import { DEFAULT_ANCHORS } from '../practice/exercises';

export type PaperSize = 'letter' | 'a4' | 'legal';
export type WorksheetStyle = 'blank' | 'all-notes' | 'anchor';
export type BoardsPerPage = 1 | 2 | 4 | 6;
export type FretCount = 5 | 12 | 24;

/** Paper sizes in PostScript points (1/72 inch), portrait. */
export const PAPER_SIZES: Readonly<Record<PaperSize, { label: string; width: number; height: number }>> = {
  letter: { label: 'US Letter (8.5" × 11")', width: 612, height: 792 },
  a4: { label: 'A4 (210 × 297 mm)', width: 595.28, height: 841.89 },
  legal: { label: 'US Legal (8.5" × 14")', width: 612, height: 1008 },
};

export const BOARDS_PER_PAGE: readonly BoardsPerPage[] = [1, 2, 4, 6];
export const FRET_COUNTS: readonly FretCount[] = [5, 12, 24];

export interface WorksheetConfig {
  paper: PaperSize;
  orientation: 'landscape' | 'portrait';
  boardsPerPage: BoardsPerPage;
  frets: FretCount;
  style: WorksheetStyle;
  title: string;
  /** Lined "Exercise / Notes" area under the boards. */
  notesArea: boolean;
  accidentals: AccidentalPreference;
  leftHanded: boolean;
  tuning?: Tuning;
  /** Positions shown in the anchor style. */
  anchors?: readonly FretPosition[];
}

export const DEFAULT_WORKSHEET: WorksheetConfig = {
  paper: 'letter',
  orientation: 'landscape',
  boardsPerPage: 1,
  frets: 12,
  style: 'blank',
  title: 'Fretboard Practice',
  notesArea: true,
  accidentals: 'sharp',
  leftHanded: false,
};

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageLayout {
  width: number;
  height: number;
  margin: number;
  header: Box;
  boards: Box[];
  notes: Box | null;
}

const GRID: Record<BoardsPerPage, [cols: number, rows: number]> = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3] };

export function layoutPage(config: WorksheetConfig): PageLayout {
  const paper = PAPER_SIZES[config.paper];
  const landscape = config.orientation === 'landscape';
  const width = landscape ? paper.height : paper.width;
  const height = landscape ? paper.width : paper.height;
  const margin = 36; // 0.5 inch
  const header: Box = { x: margin, y: margin, width: width - 2 * margin, height: 40 };
  const notesHeight = config.notesArea ? Math.min(150, height * 0.22) : 0;
  const top = header.y + header.height + 12;
  const bottom = height - margin - notesHeight - (config.notesArea ? 12 : 0);
  const [cols, rows] = GRID[config.boardsPerPage];
  const gap = 18;
  const cellW = (width - 2 * margin - gap * (cols - 1)) / cols;
  const cellH = (bottom - top - gap * (rows - 1)) / rows;
  const boards: Box[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) boards.push({ x: margin + c * (cellW + gap), y: top + r * (cellH + gap), width: cellW, height: cellH });
  const notes = config.notesArea ? { x: margin, y: height - margin - notesHeight, width: width - 2 * margin, height: notesHeight } : null;
  return { width, height, margin, header, boards, notes };
}

/** Which positions get a printed label for the chosen style. */
export function labelledPositions(config: WorksheetConfig): FretPosition[] {
  const tuning = config.tuning ?? STANDARD_TUNING;
  if (config.style === 'blank') return [];
  if (config.style === 'anchor') return (config.anchors ?? DEFAULT_ANCHORS).filter((p) => p.fret <= config.frets);
  const out: FretPosition[] = [];
  for (const s of tuning.strings) for (let fret = 0; fret <= config.frets; fret++) out.push({ string: s.number, fret });
  return out;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f2 = (n: number) => Math.round(n * 100) / 100;

function boardSvg(box: Box, config: WorksheetConfig): string {
  const tuning = config.tuning ?? STANDARD_TUNING;
  const strings = tuning.strings; // string 1 (high E) at the top
  const labelW = 18;
  const openW = Math.min(30, box.width * 0.05);
  const numH = 16;
  const usableH = Math.min(box.height - numH - 6, (box.width - labelW - openW) * 0.32);
  const gapY = usableH / (strings.length - 1);
  const fretW = (box.width - labelW - openW - 4) / config.frets;
  const nutX = box.x + labelW + openW;
  const top = box.y + numH + (box.height - numH - usableH) / 2;
  const mirror = (x: number) => (config.leftHanded ? box.x + box.width - (x - box.x) : x);
  const xOf = (fret: number) => (fret === 0 ? box.x + labelW + openW / 2 : nutX + (fret - 0.5) * fretW);
  const yOf = (n: number) => top + strings.findIndex((s) => s.number === n) * gapY;
  const right = nutX + config.frets * fretW;
  const parts: string[] = [];

  for (let fret = 0; fret <= config.frets; fret++)
    parts.push(`<text x="${f2(mirror(xOf(fret)))}" y="${f2(box.y + 11)}" font-size="10" text-anchor="middle">${fret}</text>`);
  for (const s of strings) {
    parts.push(`<text x="${f2(mirror(box.x + 7))}" y="${f2(yOf(s.number) + 4)}" font-size="11" font-weight="bold" text-anchor="middle">${esc(s.label)}</text>`);
    parts.push(`<line x1="${f2(mirror(nutX))}" y1="${f2(yOf(s.number))}" x2="${f2(mirror(right))}" y2="${f2(yOf(s.number))}" stroke="#000" stroke-width="${0.6 + (s.number - 1) * 0.15}"/>`);
  }
  const yTop = yOf(strings[0].number);
  const yBot = yOf(strings[strings.length - 1].number);
  parts.push(`<line x1="${f2(mirror(nutX))}" y1="${f2(yTop)}" x2="${f2(mirror(nutX))}" y2="${f2(yBot)}" stroke="#000" stroke-width="3"/>`);
  for (let fret = 1; fret <= config.frets; fret++) {
    const x = mirror(nutX + fret * fretW);
    parts.push(`<line x1="${f2(x)}" y1="${f2(yTop)}" x2="${f2(x)}" y2="${f2(yBot)}" stroke="#000" stroke-width="0.8"/>`);
    const m = markerAt(fret);
    const r = Math.min(3, gapY * 0.18);
    const cx = f2(mirror(xOf(fret)));
    if (m === 'single') parts.push(`<circle cx="${cx}" cy="${f2((yOf(3) + yOf(4)) / 2)}" r="${r}" fill="#000"/>`);
    if (m === 'double') {
      parts.push(`<circle cx="${cx}" cy="${f2((yOf(2) + yOf(3)) / 2)}" r="${r}" fill="#000"/>`);
      parts.push(`<circle cx="${cx}" cy="${f2((yOf(4) + yOf(5)) / 2)}" r="${r}" fill="#000"/>`);
    }
  }
  const radius = Math.min(gapY * 0.42, fretW * 0.38, 9);
  for (const p of labelledPositions(config)) {
    const cx = f2(mirror(xOf(p.fret)));
    const cy = f2(yOf(p.string));
    const name = noteName(resolve(tuning, p).pitchClass, config.accidentals);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${f2(radius)}" fill="#fff" stroke="#000" stroke-width="0.8"/>`);
    parts.push(`<text x="${cx}" y="${f2(Number(cy) + radius * 0.38)}" font-size="${f2(radius * 1.05)}" text-anchor="middle">${esc(name)}</text>`);
  }
  return parts.join('');
}

/** One printable page as a standalone SVG string, in points. */
export function renderWorksheetSvg(config: WorksheetConfig): string {
  const L = layoutPage(config);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f2(L.width)}pt" height="${f2(L.height)}pt" viewBox="0 0 ${f2(L.width)} ${f2(L.height)}" font-family="Helvetica, Arial, sans-serif" fill="#000">`,
    `<rect width="100%" height="100%" fill="#fff"/>`,
    `<text x="${L.header.x}" y="${L.header.y + 24}" font-size="22" font-weight="bold">${esc(config.title)}</text>`,
    `<text x="${f2(L.header.x + L.header.width - 190)}" y="${L.header.y + 24}" font-size="12">Date:</text>`,
    `<line x1="${f2(L.header.x + L.header.width - 155)}" y1="${L.header.y + 26}" x2="${f2(L.header.x + L.header.width)}" y2="${L.header.y + 26}" stroke="#000" stroke-width="0.8"/>`,
  ];
  for (const box of L.boards) parts.push(boardSvg(box, config));
  if (L.notes) {
    parts.push(`<text x="${L.notes.x}" y="${f2(L.notes.y + 14)}" font-size="12" font-weight="bold">Exercise / Notes:</text>`);
    for (let y = L.notes.y + 36; y <= L.notes.y + L.notes.height; y += 24)
      parts.push(`<line x1="${L.notes.x}" y1="${f2(y)}" x2="${f2(L.notes.x + L.notes.width)}" y2="${f2(y)}" stroke="#000" stroke-width="0.6"/>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

/** One-line description, as on the mockup's "Print configuration" card. */
export function describeWorksheet(c: WorksheetConfig): string {
  const style = { blank: 'Blank fretboard', 'all-notes': 'All notes labeled', anchor: 'Anchor notes only' }[c.style];
  const paper = { letter: 'US Letter', a4: 'A4', legal: 'US Legal' }[c.paper];
  return `${c.frets}-fret guitar • ${style} • ${paper} • ${c.boardsPerPage} per page`;
}

<!--
  Reusable SVG fretboard. It only draws what it is given and reports what the
  student selects; deciding what is correct belongs to the engines.
  Strings are drawn high E at the top, low E at the bottom, as in the approved diagrams.
-->
<script lang="ts">
  import { markerAt, resolve, type FretPosition, type FretRange } from '$lib/engines/fretboard';
  import { STANDARD_TUNING, noteName, ordinal, type AccidentalPreference, type Tuning } from '$lib/engines/music-theory';
  import type { FretHighlight } from './types';

  interface Props {
    tuning?: Tuning;
    range?: FretRange;
    highlights?: FretHighlight[];
    /** String number to emphasise (e.g. the A string in an A-string mission). */
    focusString?: number | null;
    interactive?: boolean;
    accidentals?: AccidentalPreference;
    label?: string;
    /** Mirror the drawing for left-handed players. Note identities and theory are unchanged. */
    leftHanded?: boolean;
    onselect?: (pos: FretPosition) => void;
  }

  let {
    tuning = STANDARD_TUNING,
    range = { minFret: 0, maxFret: 12 },
    highlights = [],
    focusString = null,
    interactive = true,
    accidentals = 'sharp',
    label = 'Guitar fretboard',
    leftHanded = false,
    onselect,
  }: Props = $props();

  const LABEL_W = 56;
  const OPEN_W = 52;
  const FRET_W = 74;
  const TOP = 40;
  const STRING_GAP = 42;
  const BOTTOM = 18;

  const hasOpen = $derived(range.minFret === 0);
  const firstFretted = $derived(Math.max(1, range.minFret));
  const fretCount = $derived(range.maxFret - firstFretted + 1);
  const nutX = $derived(LABEL_W + (hasOpen ? OPEN_W : 0));
  const width = $derived(nutX + fretCount * FRET_W + 8);
  const strings = $derived(tuning.strings);
  const height = $derived(TOP + (strings.length - 1) * STRING_GAP + BOTTOM + 8);
  const boardTop = TOP - 16;
  const boardBottom = $derived(TOP + (strings.length - 1) * STRING_GAP + 16);

  const frets = $derived(Array.from({ length: range.maxFret - range.minFret + 1 }, (_, i) => range.minFret + i));

  function xOf(fret: number): number {
    if (fret === 0) return LABEL_W + OPEN_W / 2;
    return nutX + (fret - firstFretted + 0.5) * FRET_W;
  }
  /** Mirrors an x coordinate (or a box starting at x with width w) in left-handed mode. */
  function mx(x: number): number {
    return leftHanded ? width - x : x;
  }
  function bx(x: number, w: number): number {
    return leftHanded ? width - x - w : x;
  }
  function yOf(stringNumber: number): number {
    const idx = strings.findIndex((s) => s.number === stringNumber);
    return TOP + idx * STRING_GAP;
  }

  // Roving keyboard focus.
  let cursor = $state<FretPosition>({ string: 1, fret: 0 });
  let hasFocus = $state(false);

  function move(dString: number, dFret: number) {
    const idx = strings.findIndex((s) => s.number === cursor.string);
    const nextIdx = Math.min(strings.length - 1, Math.max(0, idx + dString));
    const nextFret = Math.min(range.maxFret, Math.max(range.minFret, cursor.fret + dFret));
    cursor = { string: strings[nextIdx].number, fret: nextFret };
  }

  function select(pos: FretPosition) {
    if (!interactive) return;
    cursor = pos;
    onselect?.(pos);
  }

  function onkeydown(e: KeyboardEvent) {
    if (!interactive) return;
    const map: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, leftHanded ? 1 : -1],
      ArrowRight: [0, leftHanded ? -1 : 1],
    };
    if (e.key in map) {
      e.preventDefault();
      move(...map[e.key]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(cursor);
    } else if (e.key === 'Home') {
      e.preventDefault();
      cursor = { ...cursor, fret: range.minFret };
    } else if (e.key === 'End') {
      e.preventDefault();
      cursor = { ...cursor, fret: range.maxFret };
    }
  }

  function describe(pos: FretPosition): string {
    const where = pos.fret === 0 ? 'open' : `${ordinal(pos.fret)} fret`;
    return `${ordinal(pos.string)} string, ${where}`;
  }
  const cursorText = $derived(describe(cursor));
</script>

<div class="fretboard-wrap">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <svg
    viewBox="0 0 {width} {height}"
    role={interactive ? 'application' : 'img'}
    aria-label={label}
    aria-roledescription="fretboard"
    tabindex={interactive ? 0 : -1}
    {onkeydown}
    onfocus={() => (hasFocus = true)}
    onblur={() => (hasFocus = false)}
  >
    <!-- fret numbers -->
    {#each frets as f (f)}
      <text class="fret-num" x={mx(xOf(f))} y={14} text-anchor="middle">{f}</text>
    {/each}

    <!-- board -->
    <rect class="wood" x={bx(nutX, fretCount * FRET_W)} y={boardTop} width={fretCount * FRET_W} height={boardBottom - boardTop} rx="3" />

    <!-- inlays -->
    {#each frets as f (f)}
      {#if f > 0 && markerAt(f) === 'single'}
        <circle class="inlay" cx={mx(xOf(f))} cy={(yOf(strings[2].number) + yOf(strings[3].number)) / 2} r="7" />
      {:else if f > 0 && markerAt(f) === 'double'}
        <circle class="inlay" cx={mx(xOf(f))} cy={(yOf(strings[1].number) + yOf(strings[2].number)) / 2} r="7" />
        <circle class="inlay" cx={mx(xOf(f))} cy={(yOf(strings[3].number) + yOf(strings[4].number)) / 2} r="7" />
      {/if}
    {/each}

    <!-- fret wires -->
    {#each Array.from({ length: fretCount }, (_, i) => i + 1) as i (i)}
      <line class="wire" x1={mx(nutX + i * FRET_W)} x2={mx(nutX + i * FRET_W)} y1={boardTop} y2={boardBottom} />
    {/each}
    {#if hasOpen}
      <rect class="nut" x={bx(nutX - 6, 8)} y={boardTop - 2} width="8" height={boardBottom - boardTop + 4} rx="2" />
    {/if}

    <!-- strings + labels -->
    {#each strings as s (s.number)}
      {@const y = yOf(s.number)}
      {@const focused = focusString === s.number}
      <g class="string-label" class:focused>
        <rect x={bx(6, 34)} y={y - 14} width="34" height="28" rx="8" />
        <text x={mx(23)} y={y + 5} text-anchor="middle">{s.label}</text>
      </g>
      <line
        class="string"
        class:focused
        x1={mx(hasOpen ? LABEL_W : nutX)}
        x2={mx(nutX + fretCount * FRET_W)}
        y1={y}
        y2={y}
        stroke-width={0.9 + (s.number - 1) * 0.35}
      />
    {/each}

    <!-- hit targets -->
    {#if interactive}
      {#each strings as s (s.number)}
        {#each frets as f (f)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <rect
            class="hit"
            x={bx(f === 0 ? LABEL_W : xOf(f) - FRET_W / 2, f === 0 ? OPEN_W : FRET_W)}
            y={yOf(s.number) - STRING_GAP / 2}
            width={f === 0 ? OPEN_W : FRET_W}
            height={STRING_GAP}
            role="presentation"
            onclick={() => select({ string: s.number, fret: f })}
          />
        {/each}
      {/each}
    {/if}

    <!-- highlights -->
    {#each highlights as h (`${h.string}:${h.fret}`)}
      {@const text = h.label ?? noteName(resolve(tuning, h).pitchClass, accidentals)}
      <g class="dot {h.variant ?? 'note'}" pointer-events="none">
        <circle cx={mx(xOf(h.fret))} cy={yOf(h.string)} r="16" />
        <text x={mx(xOf(h.fret))} y={yOf(h.string) + 5} text-anchor="middle">{text}</text>
      </g>
    {/each}

    <!-- keyboard cursor -->
    {#if interactive && hasFocus}
      <circle class="cursor" cx={mx(xOf(cursor.fret))} cy={yOf(cursor.string)} r="19" pointer-events="none" />
    {/if}
  </svg>
  {#if interactive}
    <div class="sr-only" aria-live="polite">{hasFocus ? cursorText : ''}</div>
  {/if}
</div>

<style>
  .fretboard-wrap {
    width: 100%;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    user-select: none;
  }
  svg:focus {
    outline: none;
  }
  svg:focus-visible {
    outline: 2px solid var(--pw-focus);
    outline-offset: 4px;
    border-radius: 8px;
  }
  .fret-num {
    fill: var(--pw-text);
    font-size: 15px;
    font-weight: 500;
  }
  .wood {
    fill: var(--pw-fret-wood);
  }
  .inlay {
    fill: var(--pw-fret-inlay);
    opacity: 0.85;
  }
  .wire {
    stroke: var(--pw-fret-wire);
    stroke-width: 2.5;
  }
  .nut {
    fill: var(--pw-fret-nut);
  }
  .string {
    stroke: var(--pw-fret-string);
  }
  .string.focused {
    stroke: var(--pw-primary-hover);
    stroke-width: 3;
    filter: drop-shadow(0 0 4px var(--pw-primary));
  }
  .string-label rect {
    fill: var(--pw-surface-2);
    stroke: var(--pw-border-strong);
  }
  .string-label text {
    fill: var(--pw-text);
    font-size: 15px;
    font-weight: 600;
  }
  .string-label.focused rect {
    fill: var(--pw-primary);
    stroke: var(--pw-primary-hover);
  }
  .hit {
    fill: transparent;
    cursor: pointer;
  }
  .hit:hover {
    fill: rgba(67, 169, 255, 0.12);
  }
  .dot circle {
    fill: var(--pw-bg);
    stroke: var(--pw-primary-hover);
    stroke-width: 3;
  }
  .dot text {
    fill: var(--pw-text);
    font-size: 15px;
    font-weight: 700;
  }
  .dot.root circle,
  .dot.focus circle {
    fill: var(--pw-primary);
    stroke: #bfe0ff;
  }
  .dot.focus circle {
    filter: drop-shadow(0 0 6px var(--pw-primary-hover));
  }
  .dot.correct circle {
    fill: var(--pw-primary);
    stroke: var(--pw-amber);
  }
  .dot.incorrect circle {
    fill: var(--pw-error);
    stroke: #ffc9ca;
  }
  .dot.muted circle {
    stroke: var(--pw-text-faint);
  }
  .dot.muted text {
    fill: var(--pw-text-muted);
  }
  .cursor {
    fill: none;
    stroke: var(--pw-amber);
    stroke-width: 2.5;
    stroke-dasharray: 4 3;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>

<!--
  Native chord diagram renderer (Planning Update 02). Draws from the shared
  layout in engines/chords/diagram.ts, on screen or in black and white for
  Print Studio.
-->
<script lang="ts">
  import type { ChordDiagram } from '$lib/engines/chords';

  let { diagram, variant = 'screen', width = 180 }: { diagram: ChordDiagram; variant?: 'screen' | 'print'; width?: number } = $props();

  const pad = { left: 26, right: 14, top: 44, bottom: 14 };
  const strings = $derived(diagram.columns.length);
  const gap = $derived((width - pad.left - pad.right) / (strings - 1));
  const rowH = $derived(gap * 1.25);
  const height = $derived(pad.top + rowH * diagram.rows + pad.bottom);
  const x = (col: number) => pad.left + col * gap;
  const y = (row: number) => pad.top + rowH * (row - 0.5);
  const r = $derived(Math.min(gap, rowH) * 0.36);
  const label = $derived(
    `${diagram.title ?? 'Chord'} diagram${diagram.baseFret > 1 ? `, starting at fret ${diagram.baseFret}` : ''}`,
  );
</script>

<svg class="chord {variant}" viewBox="0 0 {width} {height + (diagram.title ? 0 : 0)}" {width} height={height} role="img" aria-label={label}>
  {#if diagram.title}
    <text class="title" x={width / 2} y="16" text-anchor="middle">{diagram.title}</text>
  {/if}
  {#each diagram.top as t, col}
    {#if t === 'open'}
      <circle class="open" cx={x(col)} cy={pad.top - 12} r={r * 0.6} />
    {:else if t === 'muted'}
      <g class="muted" transform="translate({x(col)} {pad.top - 12})">
        <line x1={-r * 0.55} y1={-r * 0.55} x2={r * 0.55} y2={r * 0.55} />
        <line x1={-r * 0.55} y1={r * 0.55} x2={r * 0.55} y2={-r * 0.55} />
      </g>
    {/if}
  {/each}
  {#if !diagram.showNut}
    <text class="base" x={pad.left - 8} y={y(1) + 4} text-anchor="end">{diagram.baseFret}fr</text>
  {/if}
  {#each { length: diagram.rows + 1 } as _, i}
    <line class="fret" class:nut={i === 0 && diagram.showNut} x1={x(0)} x2={x(strings - 1)} y1={pad.top + rowH * i} y2={pad.top + rowH * i} />
  {/each}
  {#each diagram.columns as _, col}
    <line class="string" x1={x(col)} x2={x(col)} y1={pad.top} y2={pad.top + rowH * diagram.rows} />
  {/each}
  {#each diagram.barres as b}
    <rect class="barre" x={x(b.fromColumn) - r} y={y(b.row) - r} width={x(b.toColumn) - x(b.fromColumn) + 2 * r} height={2 * r} rx={r} />
    {#if b.label}<text class="lbl" x={(x(b.fromColumn) + x(b.toColumn)) / 2} y={y(b.row) + r * 0.45}>{b.label}</text>{/if}
  {/each}
  {#each diagram.dots as d}
    <circle class="dot" class:root={d.isRoot} cx={x(d.column)} cy={y(d.row)} {r} />
    {#if d.label}<text class="lbl" x={x(d.column)} y={y(d.row) + r * 0.45}>{d.label}</text>{/if}
  {/each}
</svg>

<style>
  .chord { font-family: var(--pw-font); }
  .title { font-size: 17px; font-weight: 700; fill: var(--pw-text); }
  .base { font-size: 11px; fill: var(--pw-text-muted); }
  .fret { stroke: var(--pw-fret-wire); stroke-width: 1.5; }
  .fret.nut { stroke: var(--pw-fret-nut); stroke-width: 5; }
  .string { stroke: var(--pw-fret-string); stroke-width: 1.3; }
  .open { fill: none; stroke: var(--pw-text); stroke-width: 1.6; }
  .muted line { stroke: var(--pw-text-muted); stroke-width: 1.8; }
  .dot, .barre { fill: var(--pw-primary); }
  .dot.root { fill: var(--pw-amber); }
  .lbl { font-size: 11px; font-weight: 700; fill: #fff; text-anchor: middle; }
  .print .title, .print .base { fill: #000; }
  .print .fret, .print .string { stroke: #000; }
  .print .fret.nut { stroke: #000; }
  .print .open { stroke: #000; }
  .print .muted line { stroke: #000; }
  .print .dot, .print .barre { fill: #000; }
  .print .dot.root { fill: #fff; stroke: #000; stroke-width: 2; }
  .print .dot.root + .lbl { fill: #000; }
</style>

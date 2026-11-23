<script lang="ts">
  let { cents, inTune, tolerance }: { cents: number | null; inTune: boolean; tolerance: number } = $props();

  const CX = 200;
  const CY = 210;
  const R = 160;
  const SPAN = 62; // degrees either side of centre for ±50 cents

  const angleOf = (c: number) => (Math.max(-50, Math.min(50, c)) / 50) * SPAN;
  const point = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  };
  function arc(from: number, to: number, r: number) {
    const [x1, y1] = point(angleOf(from), r);
    const [x2, y2] = point(angleOf(to), r);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  }

  const bands = $derived([
    { from: -50, to: -30, cls: 'far' },
    { from: -30, to: -tolerance, cls: 'near' },
    { from: -tolerance, to: tolerance, cls: 'ok' },
    { from: tolerance, to: 30, cls: 'near' },
    { from: 30, to: 50, cls: 'far' },
  ]);
  const ticks = Array.from({ length: 21 }, (_, i) => -50 + i * 5);
  const needleAngle = $derived(cents === null ? 0 : angleOf(cents));
</script>

<svg viewBox="0 0 400 240" role="img" aria-label={cents === null ? 'Tuning gauge, no pitch' : `Tuning gauge, ${cents.toFixed(1)} cents`}>
  {#each bands as b}
    <path class="band {b.cls}" d={arc(b.from, b.to, R)} />
  {/each}
  {#each ticks as t}
    {@const [x1, y1] = point(angleOf(t), R - 14)}
    {@const [x2, y2] = point(angleOf(t), R - (t % 10 === 0 ? 30 : 22))}
    <line class="tick" class:major={t % 10 === 0} {x1} {y1} {x2} {y2} />
    {#if t % 10 === 0}
      {@const [lx, ly] = point(angleOf(t), R + 18)}
      <text class="tick-label" x={lx} y={ly + 5} text-anchor="middle">{t > 0 ? `+${t}` : t}</text>
    {/if}
  {/each}
  <g class="needle" class:idle={cents === null} class:ok={inTune} style="transform: rotate({needleAngle}deg); transform-origin: {CX}px {CY}px">
    <line x1={CX} y1={CY} x2={CX} y2={CY - R + 6} />
  </g>
  <circle class="hub" class:ok={inTune} cx={CX} cy={CY} r="11" />
</svg>

<style>
  svg {
    width: 100%;
    max-width: 520px;
    display: block;
    margin: 0 auto;
  }
  .band {
    fill: none;
    stroke-width: 14;
    stroke-linecap: butt;
  }
  .band.far {
    stroke: var(--pw-error);
  }
  .band.near {
    stroke: var(--pw-amber);
  }
  .band.ok {
    stroke: var(--pw-success);
  }
  .tick {
    stroke: var(--pw-text-muted);
    stroke-width: 1.5;
  }
  .tick.major {
    stroke: var(--pw-text);
    stroke-width: 2.5;
  }
  .tick-label {
    fill: var(--pw-text);
    font-size: 15px;
    font-weight: 600;
  }
  .needle {
    transition: transform 90ms linear;
  }
  .needle line {
    stroke: var(--pw-primary-hover);
    stroke-width: 4;
    stroke-linecap: round;
    filter: drop-shadow(0 0 6px var(--pw-primary));
  }
  .needle.ok line {
    stroke: var(--pw-success);
    filter: drop-shadow(0 0 6px var(--pw-success));
  }
  .needle.idle line {
    stroke: var(--pw-text-faint);
    filter: none;
  }
  .hub {
    fill: var(--pw-primary);
    stroke: #bfe0ff;
    stroke-width: 3;
  }
  .hub.ok {
    fill: var(--pw-success);
  }
</style>

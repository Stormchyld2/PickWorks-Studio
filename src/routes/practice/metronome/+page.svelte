<!-- Metronome (approved design 6). Reached from Practice. -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  import Play from '@lucide/svelte/icons/play';
  import Square from '@lucide/svelte/icons/square';
  import Hand from '@lucide/svelte/icons/hand';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import { Metronome } from '$lib/services/audio/metronome';
  import { MAX_BPM, MIN_BPM, clampBpm, tapTempo } from '$lib/engines/audio/metronome';
  import { preferences } from '$lib/stores/preferences.svelte';
  import { session } from '$lib/services/session';

  const SIGNATURES = [
    { label: '2 / 4', beats: 2 },
    { label: '3 / 4', beats: 3 },
    { label: '4 / 4', beats: 4 },
    { label: '5 / 4', beats: 5 },
    { label: '6 / 8', beats: 6 },
  ];
  const SUBDIVISIONS = [
    { value: 1, label: '♩', name: 'Quarter notes' },
    { value: 2, label: '♪♪', name: 'Eighth notes' },
    { value: 3, label: '3', name: 'Triplets' },
    { value: 4, label: '♬♬', name: 'Sixteenth notes' },
  ] as const;

  const metronome = new Metronome();
  let bpm = $state(preferences.value.practice.metronomeBpm);
  let beats = $state(4);
  let subdivision = $state<1 | 2 | 3 | 4>(1);
  let accent = $state(true);
  let volume = $state(0.7);
  let running = $state(false);
  let current = $state(-1);
  let taps: number[] = [];
  let release: (() => void) | null = null;

  metronome.onBeat = (b) => (current = b);

  const tempoName = $derived(bpm < 60 ? 'Largo' : bpm < 76 ? 'Adagio' : bpm < 108 ? 'Andante' : bpm < 120 ? 'Moderato' : bpm < 168 ? 'Allegro' : 'Presto');

  $effect(() => {
    metronome.volume = volume;
    metronome.accentFirst = accent;
    metronome.subdivision = subdivision;
  });
  $effect(() => {
    if (running) metronome.setBpm(bpm);
  });

  function setBpm(n: number) {
    bpm = clampBpm(n);
  }

  function start() {
    metronome.start(bpm, beats);
    running = true;
    // Practising along with the metronome keeps the session awake.
    release ??= session.hold('metronome');
  }
  function stop() {
    metronome.stop();
    running = false;
    current = -1;
    release?.();
    release = null;
  }
  function changeSignature(n: number) {
    beats = n;
    if (running) start();
  }
  function tap() {
    const now = performance.now();
    taps = [...taps.filter((t) => now - t < 3000), now];
    const t = tapTempo(taps);
    if (t) setBpm(t);
  }

  function onkey(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    if (el.closest('input, select, textarea, [role=dialog]')) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (running) stop();
      else start();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setBpm(bpm + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1));
    }
  }

  onDestroy(stop);
</script>

<svelte:window onkeydown={onkey} />

<nav class="crumbs" aria-label="Breadcrumb"><a href="/practice">Practice</a> › <b aria-current="page">Metronome</b></nav>
<header class="head">
  <svg class="ic" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11.4V9.1" /><path d="m12 17 6.59-6.59" /><path d="m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2" /><circle cx="20" cy="9" r="2" /></svg>
  <div>
    <h1>Metronome</h1>
    <p>Keep steady time on its own, or inside any lesson or practice session.</p>
  </div>
</header>

<div class="grid">
  <section class="card tempo" aria-label="Tempo">
    <h2>Tempo</h2>
    <div class="bpm-row">
      <button class="big-btn" onclick={() => setBpm(bpm - 1)} aria-label="Slower"><Minus size={28} /></button>
      <output class="bpm" aria-live="polite">{bpm}</output>
      <button class="big-btn" onclick={() => setBpm(bpm + 1)} aria-label="Faster"><Plus size={28} /></button>
    </div>
    <div class="unit">BPM</div>
    <input type="range" min={MIN_BPM} max={MAX_BPM} bind:value={bpm} aria-label="Tempo in beats per minute" />
    <div class="scale"><span>{MIN_BPM}</span><span>{tempoName}</span><span>{MAX_BPM}</span></div>
  </section>

  <section class="card opts" aria-label="Beat options">
    <div class="opt-row">
      <label class="col">
        <span class="lbl">Time signature</span>
        <select value={beats} onchange={(e) => changeSignature(Number(e.currentTarget.value))}>
          {#each SIGNATURES as s}<option value={s.beats}>{s.label}</option>{/each}
        </select>
      </label>
      <div class="col">
        <span class="lbl" id="sub-lbl">Subdivision</span>
        <div class="seg" role="radiogroup" aria-labelledby="sub-lbl">
          {#each SUBDIVISIONS as s}
            <button role="radio" aria-checked={subdivision === s.value} class:on={subdivision === s.value} onclick={() => (subdivision = s.value)} aria-label={s.name} title={s.name}>{s.label}</button>
          {/each}
        </div>
      </div>
    </div>
    <label class="check"><input type="checkbox" bind:checked={accent} /> Accent first beat</label>
    <div class="beats" aria-hidden="true">
      {#each { length: beats } as _, i}
        <span class="beat" class:now={i === current} class:first={i === 0 && accent}>{i + 1}</span>
      {/each}
    </div>
  </section>
</div>

<section class="card transport" aria-label="Controls">
  <button class="pw-btn tap" onclick={tap}><Hand size={20} /> Tap Tempo</button>
  <div class="play">
    {#if running}
      <button class="play-btn" onclick={stop} aria-label="Stop"><Square size={34} fill="currentColor" /></button>
    {:else}
      <button class="play-btn" onclick={start} aria-label="Start"><Play size={38} fill="currentColor" /></button>
    {/if}
  </div>
  <label class="vol"><Volume2 size={22} aria-hidden="true" /><input type="range" min="0" max="1" step="0.01" bind:value={volume} aria-label="Metronome volume" /></label>
</section>

<p class="hint">Space starts and stops · ← → change tempo by 1 · Shift + ← → by 5</p>

<style>
  .crumbs { color: var(--pw-text-muted); font-size: 0.92rem; margin-bottom: 10px; }
  .crumbs a { color: var(--pw-text-muted); text-decoration: none; }
  .crumbs a:hover { color: var(--pw-text); }
  .head { display: flex; gap: 18px; align-items: center; margin: 0 0 22px; }
  .ic { color: var(--pw-primary); }
  h1 { font-size: 2.4rem; }
  .head p { margin: 2px 0 0; color: var(--pw-text-muted); font-size: 1.1rem; }
  .grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .tempo { text-align: center; }
  .tempo h2 { font-size: 1.2rem; }
  .bpm-row { display: flex; align-items: center; justify-content: center; gap: 40px; margin-top: 8px; }
  .bpm { font-size: 6rem; font-weight: 800; line-height: 1.1; min-width: 3ch; font-variant-numeric: tabular-nums; }
  .big-btn { width: 72px; height: 72px; border-radius: var(--pw-radius); border: 1px solid var(--pw-border-strong); background: var(--pw-surface-2); color: var(--pw-text); cursor: pointer; display: grid; place-items: center; }
  .big-btn:hover { border-color: var(--pw-primary-hover); }
  .unit { color: var(--pw-primary-hover); font-weight: 700; letter-spacing: 0.2em; margin-bottom: 18px; }
  input[type='range'] { width: 100%; accent-color: var(--pw-primary); }
  .scale { display: flex; justify-content: space-between; color: var(--pw-text-muted); font-size: 0.9rem; }
  .opts { display: flex; flex-direction: column; gap: 18px; }
  .opt-row { display: flex; gap: 20px; flex-wrap: wrap; }
  .col { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 200px; }
  .lbl { font-weight: 600; }
  select { background: var(--pw-bg-raised); color: var(--pw-text); border: 1px solid var(--pw-border-strong); border-radius: var(--pw-radius-sm); padding: 10px 12px; font: inherit; }
  .seg { display: flex; gap: 8px; }
  .seg button { flex: 1; padding: 9px 8px; border-radius: var(--pw-radius-sm); border: 1px solid var(--pw-border-strong); background: var(--pw-surface-2); color: var(--pw-text); cursor: pointer; font-size: 1.05rem; }
  .seg button.on { background: var(--pw-primary); border-color: var(--pw-primary-hover); font-weight: 600; }
  .check { display: flex; gap: 10px; align-items: center; cursor: pointer; }
  .check input { width: 20px; height: 20px; accent-color: var(--pw-amber); }
  .beats { display: flex; gap: 16px; justify-content: center; margin-top: auto; padding-top: 8px; }
  .beat { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 1.3rem; font-weight: 700; border: 2px solid var(--pw-border-strong); background: rgba(11, 17, 25, 0.5); }
  .beat.now { background: var(--pw-primary); border-color: var(--pw-primary-hover); box-shadow: 0 0 18px rgba(35, 139, 235, 0.5); }
  .beat.now.first { background: var(--pw-amber); border-color: var(--pw-amber); color: var(--pw-bg); box-shadow: 0 0 18px rgba(245, 158, 56, 0.5); }
  .transport { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; }
  .tap { justify-self: start; padding: 14px 20px; font-size: 1.05rem; }
  .play-btn { width: 104px; height: 104px; border-radius: 50%; border: 0; background: var(--pw-primary); color: #fff; cursor: pointer; display: grid; place-items: center; box-shadow: 0 0 0 4px rgba(67, 169, 255, 0.35), 0 8px 28px rgba(35, 139, 235, 0.45); }
  .play-btn:hover { background: var(--pw-primary-hover); }
  .vol { justify-self: end; display: flex; align-items: center; gap: 12px; width: min(320px, 100%); color: var(--pw-text-muted); }
  .hint { text-align: center; color: var(--pw-text-muted); margin-top: 14px; font-size: 0.95rem; }
  @media (max-width: 839.98px) { .grid { grid-template-columns: 1fr; } }
</style>

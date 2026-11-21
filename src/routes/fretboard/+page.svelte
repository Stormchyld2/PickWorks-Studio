<script lang="ts">
  import Fretboard from '$lib/components/fretboard/Fretboard.svelte';
  import { preferences } from '$lib/stores/preferences.svelte';
  import type { FretHighlight } from '$lib/components/fretboard/types';
  import {
    allPositions,
    positionsOfPitchClass,
    resolve,
    samePosition,
    type FretPosition,
    type ResolvedPosition,
  } from '$lib/engines/fretboard';
  import {
    STANDARD_TUNING,
    enharmonicSpellings,
    formatSpelling,
    intervalInfo,
    midiToFrequency,
    noteName,
    ordinal,
    pitchName,
    type AccidentalPreference,
  } from '$lib/engines/music-theory';

  type Mode = 'notes' | 'intervals';

  let mode = $state<Mode>('notes');
  let maxFret = $state(12);
  let accidentals = $state<AccidentalPreference>('sharp');
  let showAll = $state(false);
  let showOccurrences = $state(true);
  let selected = $state<FretPosition | null>({ string: 5, fret: 3 });

  const range = $derived({ minFret: 0, maxFret });
  const info = $derived<ResolvedPosition | null>(selected ? resolve(STANDARD_TUNING, selected) : null);

  const highlights = $derived.by<FretHighlight[]>(() => {
    const out: FretHighlight[] = [];
    if (mode === 'intervals' && info) {
      for (const p of allPositions(STANDARD_TUNING, range)) {
        const iv = intervalInfo(info.pitchClass, p.pitchClass);
        out.push({ ...p, label: iv.short, variant: samePosition(p, info) ? 'focus' : iv.semitones === 0 ? 'root' : 'muted' });
      }
      return out;
    }
    if (showAll) {
      for (const p of allPositions(STANDARD_TUNING, range)) out.push({ ...p, variant: 'muted' });
    }
    if (info && showOccurrences) {
      for (const p of positionsOfPitchClass(STANDARD_TUNING, info.pitchClass, range)) {
        const i = out.findIndex((h) => samePosition(h, p));
        const h: FretHighlight = { ...p, variant: 'root' };
        if (i >= 0) out[i] = h;
        else out.push(h);
      }
    }
    if (info) {
      const i = out.findIndex((h) => samePosition(h, info));
      const h: FretHighlight = { string: info.string, fret: info.fret, variant: 'focus' };
      if (i >= 0) out[i] = h;
      else out.push(h);
    }
    return out;
  });

  const occurrences = $derived(info ? positionsOfPitchClass(STANDARD_TUNING, info.pitchClass, range).length : 0);
</script>

<header class="head">
  <div>
    <h1>Fretboard Explorer</h1>
    <p>Click or tap any position, or focus the fretboard and use the arrow keys and Enter.</p>
  </div>
  <div class="tabs" role="tablist" aria-label="Overlay">
    <button role="tab" aria-selected={mode === 'notes'} class:active={mode === 'notes'} onclick={() => (mode = 'notes')}>Notes</button>
    <button role="tab" aria-selected="false" disabled title="Arrives with the chords course (Phase 2)">Chords</button>
    <button role="tab" aria-selected="false" disabled title="Arrives with the scales course (Phase 3)">Scales</button>
    <button role="tab" aria-selected={mode === 'intervals'} class:active={mode === 'intervals'} onclick={() => (mode = 'intervals')}>Intervals</button>
  </div>
</header>

<section class="card board">
  <div class="board-meta">
    <span>{STANDARD_TUNING.name} (E A D G B E) · Frets 0 – {maxFret}</span>
    <div class="controls">
      <label><input type="checkbox" bind:checked={showAll} disabled={mode === 'intervals'} /> All notes</label>
      <label><input type="checkbox" bind:checked={showOccurrences} disabled={mode === 'intervals'} /> Every occurrence</label>
      <select bind:value={accidentals} aria-label="Accidentals">
        <option value="sharp">Sharps (♯)</option>
        <option value="flat">Flats (♭)</option>
      </select>
      <select bind:value={maxFret} aria-label="Fret count">
        <option value={5}>5 frets</option>
        <option value={12}>12 frets</option>
        <option value={24}>24 frets</option>
      </select>
    </div>
  </div>
  <Fretboard
    leftHanded={preferences.value.display.leftHanded}
    {range}
    {highlights}
    {accidentals}
    focusString={selected?.string ?? null}
    onselect={(p) => (selected = p)}
    label="Interactive fretboard explorer"
  />
</section>

{#if info}
  <section class="details" aria-live="polite">
    <div class="card stat">
      <div class="eyebrow">Note</div>
      <div class="big">{noteName(info.pitchClass, accidentals)}</div>
      <div class="muted">{enharmonicSpellings(info.pitchClass).map((s) => formatSpelling(s, true)).join(' / ')}</div>
    </div>
    <div class="card stat">
      <div class="eyebrow">Position</div>
      <div class="big">{ordinal(info.string)} string</div>
      <div class="muted">{info.fret === 0 ? 'Open string' : `${ordinal(info.fret)} fret`}</div>
    </div>
    <div class="card stat">
      <div class="eyebrow">Pitch</div>
      <div class="big">{pitchName(info.midi, accidentals)}</div>
      <div class="muted">{midiToFrequency(info.midi).toFixed(1)} Hz</div>
    </div>
    <div class="card stat">
      <div class="eyebrow">On this board</div>
      <div class="big">{occurrences}×</div>
      <div class="muted">places to play {noteName(info.pitchClass, accidentals)}</div>
    </div>
  </section>
{/if}

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }
  h1 {
    font-size: 2.4rem;
  }
  .head p {
    margin: 4px 0 0;
    color: var(--pw-text-muted);
  }
  .tabs {
    display: flex;
    border: 1px solid var(--pw-border-strong);
    border-radius: var(--pw-radius-sm);
    overflow: hidden;
  }
  .tabs button {
    background: var(--pw-surface);
    border: 0;
    border-right: 1px solid var(--pw-border);
    padding: 8px 16px;
    cursor: pointer;
  }
  .tabs button:last-child {
    border-right: 0;
  }
  .tabs button.active {
    background: var(--pw-primary);
    font-weight: 600;
  }
  .tabs button:disabled {
    color: var(--pw-text-faint);
    cursor: not-allowed;
  }
  .tabs button:not(:disabled):not(.active):hover {
    background: var(--pw-surface-2);
  }
  .board-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 12px;
  }
  .controls {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
    color: var(--pw-text-muted);
  }
  .controls input {
    accent-color: var(--pw-primary);
  }
  select {
    background: var(--pw-surface-2);
    color: var(--pw-text);
    border: 1px solid var(--pw-border-strong);
    border-radius: var(--pw-radius-sm);
    padding: 6px 10px;
    font: inherit;
  }
  .details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-top: 20px;
  }
  .big {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--pw-primary-hover);
  }
  .muted {
    color: var(--pw-text-muted);
  }
</style>

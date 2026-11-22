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
  import { getChordQuality, spellChord } from '$lib/engines/music-theory/chords';
  import { SCALES, getScale, spellScale } from '$lib/engines/music-theory/scales';
  import { parseSpelling, spellingToPitchClass } from '$lib/engines/music-theory/notes';
  import { scalePositions } from '$lib/engines/fretboard/scale-positions';
  import { STARTER_CHORDS, analyzeShape, chordDiagram } from '$lib/engines/chords';
  import ChordDiagram from '$lib/components/chord/ChordDiagram.svelte';

  type Mode = 'notes' | 'chords' | 'scales' | 'intervals';
  type Labels = 'notes' | 'intervals';

  // Chords: the provisional starter shapes, grouped by chord type in library order.
  const chordGroups = [...new Set(STARTER_CHORDS.map((c) => c.quality))].map((q) => ({
    name: getChordQuality(q).name,
    shapes: STARTER_CHORDS.filter((c) => c.quality === q),
  }));
  const ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  let chordId = $state(STARTER_CHORDS[0].id);
  let scaleRoot = $state('A');
  let scaleId = $state('minor-pentatonic');
  let labels = $state<Labels>('notes');
  let diagramLabels = $state<'fingers' | 'notes' | 'intervals'>('fingers');

  const chord = $derived(STARTER_CHORDS.find((c) => c.id === chordId) ?? STARTER_CHORDS[0]);
  const chordInfo = $derived(analyzeShape(chord, STANDARD_TUNING));
  const chordName = (c: (typeof STARTER_CHORDS)[number]) => analyzeShape(c, STANDARD_TUNING).symbol.replace('b', '♭').replace('#', '♯') + (c.voicing ? ` (${c.voicing})` : '');
  const diagram = $derived(chordDiagram(chord, STANDARD_TUNING, { leftHanded: preferences.value.display.leftHanded, labels: diagramLabels }));
  const scale = $derived(getScale(scaleId));
  const scaleRootPc = $derived(spellingToPitchClass(parseSpelling(scaleRoot)));
  const scaleNotes = $derived(scale.degrees ? spellScale(parseSpelling(scaleRoot), scale) : null);

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
    if (mode === 'chords') {
      for (const n of chordInfo.notes) {
        if (n.fret === null) continue;
        out.push({ string: n.string, fret: n.fret, label: (labels === 'notes' ? n.name : n.interval) ?? undefined, variant: n.interval === 'R' ? 'root' : 'note' });
      }
      return out;
    }
    if (mode === 'scales') {
      const names = scaleNotes;
      for (const p of scalePositions(STANDARD_TUNING, scaleRootPc, scale, range)) {
        const i = scale.labels.indexOf(p.label);
        const label = labels === 'intervals' ? p.label : names && i >= 0 ? names[i] : noteName(p.pitchClass, accidentals);
        out.push({ string: p.string, fret: p.fret, label, variant: p.isRoot ? 'root' : 'note' });
      }
      return out;
    }
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
    <button role="tab" aria-selected={mode === 'chords'} class:active={mode === 'chords'} onclick={() => (mode = 'chords')}>Chords</button>
    <button role="tab" aria-selected={mode === 'scales'} class:active={mode === 'scales'} onclick={() => (mode = 'scales')}>Scales</button>
    <button role="tab" aria-selected={mode === 'intervals'} class:active={mode === 'intervals'} onclick={() => (mode = 'intervals')}>Intervals</button>
  </div>
</header>

<section class="card board">
  <div class="board-meta">
    <span>{STANDARD_TUNING.name} (E A D G B E) · Frets 0 – {maxFret}</span>
    <div class="controls">
      {#if mode === 'chords'}
        <select bind:value={chordId} aria-label="Chord">
          {#each chordGroups as g (g.name)}
            <optgroup label={g.name}>
              {#each g.shapes as c (c.id)}<option value={c.id}>{chordName(c)}</option>{/each}
            </optgroup>
          {/each}
        </select>
      {:else if mode === 'scales'}
        <select bind:value={scaleRoot} aria-label="Scale root">
          {#each ROOTS as r (r)}<option value={r}>{r.replace('b', '♭').replace('#', '♯')}</option>{/each}
        </select>
        <select bind:value={scaleId} aria-label="Scale">
          {#each SCALES as sc (sc.id)}<option value={sc.id}>{sc.name}</option>{/each}
        </select>
      {:else}
        <label><input type="checkbox" bind:checked={showAll} disabled={mode === 'intervals'} /> All notes</label>
        <label><input type="checkbox" bind:checked={showOccurrences} disabled={mode === 'intervals'} /> Every occurrence</label>
      {/if}
      {#if mode === 'chords' || mode === 'scales'}
        <select bind:value={labels} aria-label="Labels">
          <option value="notes">Note names</option>
          <option value="intervals">Intervals</option>
        </select>
      {/if}
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
    focusString={mode === "chords" || mode === "scales" ? null : (selected?.string ?? null)}
    onselect={(p) => (selected = p)}
    label="Interactive fretboard explorer"
  />
</section>

{#if mode === 'chords'}
  <section class="theory" aria-live="polite">
    <div class="card diagram">
      <ChordDiagram {diagram} width={200} />
      <select bind:value={diagramLabels} aria-label="Diagram labels">
        <option value="fingers">Fingers</option>
        <option value="notes">Note names</option>
        <option value="intervals">Intervals</option>
      </select>
    </div>
    <div class="card stat wide">
      <div class="eyebrow">Chord</div>
      <div class="big">{chordInfo.symbol.replace('b', '♭').replace('#', '♯')}</div>
      <div class="muted">{getChordQuality(chord.quality).name}{chord.voicing ? ` · ${chord.voicing}` : ''}</div>
      <div class="tones">
        {#each spellChord(parseSpelling(chord.root), getChordQuality(chord.quality)) as n, i (i)}
          <span class="pw-pill">{n.replace('b', '♭').replace('#', '♯')} <small>{getChordQuality(chord.quality).labels[i]}</small></span>
        {/each}
      </div>
      <p class="muted small">Provisional starter set: {STARTER_CHORDS.length} shapes for testing. The full chord library is still to be reviewed.</p>
    </div>
  </section>
{:else if mode === 'scales'}
  <section class="theory" aria-live="polite">
    <div class="card stat wide">
      <div class="eyebrow">Scale</div>
      <div class="big">{scaleRoot.replace('b', '♭').replace('#', '♯')} {scale.name}</div>
      <div class="tones">
        {#each scale.labels as l, i (l + i)}
          <span class="pw-pill">{scaleNotes ? scaleNotes[i].replace('b', '♭').replace('#', '♯') : noteName(((scaleRootPc + scale.intervals[i]) % 12) as typeof scaleRootPc, accidentals)} <small>{l}</small></span>
        {/each}
      </div>
      <p class="muted small">Every place the scale's notes fall from fret 0 to {maxFret}. Root notes are highlighted.</p>
    </div>
  </section>
{:else if info}
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
  .theory { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
  .diagram { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .wide { flex: 1; min-width: 320px; }
  .tones { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 4px; }
  .tones small { color: var(--pw-text-muted); margin-left: 4px; }
  .small { font-size: 0.88rem; margin: 10px 0 0; }
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

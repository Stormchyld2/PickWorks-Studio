<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Mic from '@lucide/svelte/icons/mic';
  import MicOff from '@lucide/svelte/icons/mic-off';
  import Crosshair from '@lucide/svelte/icons/crosshair';
  import AudioWaveform from '@lucide/svelte/icons/audio-waveform';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import TunerGauge from '$lib/components/tuner/TunerGauge.svelte';
  import TuningForkIcon from '$lib/components/tuner/TuningForkIcon.svelte';
  import { A4_CHOICES, TUNING_PRESETS } from '$lib/engines/audio';
  import { midiToFrequency } from '$lib/engines/music-theory';
  import { tuner, stringPitchName } from '$lib/stores/tuner.svelte';

  const pickerPresets = TUNING_PRESETS.filter((p) => p.inPicker);
  const stringsLowToHigh = $derived([...tuner.preset.strings].sort((a, b) => b.number - a.number));

  const display = $derived.by(() => {
    if (tuner.mode === 'chromatic') {
      const c = tuner.chromatic;
      return c ? `${c.name}${c.octave}` : '--';
    }
    return stringPitchName(tuner.targetString);
  });

  const signed = (c: number) => `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(1)}`;

  const statusText = $derived.by(() => {
    if (!tuner.listening) return tuner.error ? 'Microphone unavailable' : 'Not listening';
    if (tuner.frequency === null) return 'Listening… play a string';
    if (!tuner.stable) return 'Listening…';
    return 'Listening';
  });

  onMount(() => {
    void tuner.refreshDevices();
  });
  onDestroy(() => {
    void tuner.stop();
  });

  function onDeviceChange(e: Event) {
    tuner.deviceId = (e.currentTarget as HTMLSelectElement).value || null;
    void tuner.restart();
  }
  function onChannelChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value;
    tuner.channel = v === 'mix' ? 'mix' : Number(v);
    void tuner.restart();
  }
</script>

<header class="head">
  <TuningForkIcon size={52} />
  <div>
    <h1>Tuner</h1>
    <p>Tune your guitar: fast, accurate and offline</p>
  </div>
</header>

{#if tuner.error}
  <div class="card banner" role="alert">
    <MicOff size={22} aria-hidden="true" />
    <div>
      <strong>{tuner.error.message}</strong>
      <div class="muted">You can still tune by ear: play a reference tone from a string below and match it.</div>
    </div>
  </div>
{/if}

<div class="layout">
  <section class="card gauge-card">
    <TunerGauge cents={tuner.cents} inTune={tuner.inTune} tolerance={tuner.tolerance} />
    <div class="readout">
      <span class="pill" class:lit={tuner.advice?.direction === 'raise'}>◀ FLAT</span>
      <div class="note">
        <div class="name">{display}</div>
        <div class="hz">{tuner.frequency !== null ? `${tuner.frequency.toFixed(2)} Hz` : '— Hz'}</div>
      </div>
      <span class="pill" class:lit={tuner.advice?.direction === 'lower'}>SHARP ▶</span>
    </div>
    <div class="feedback" aria-live="polite">
      {#if tuner.inTune && tuner.cents !== null}
        <div class="badge ok">✓ In tune <span>({signed(tuner.cents)} cents)</span></div>
      {:else if tuner.advice && tuner.cents !== null}
        <div class="badge guide">
          {#if tuner.mode === 'guided'}{tuner.advice.message}{:else}{tuner.advice.direction === 'raise' ? 'Flat' : 'Sharp'}{/if}
          <span>({signed(tuner.cents)} cents)</span>
        </div>
      {:else if tuner.listening}
        <div class="badge idle">{tuner.frequency === null ? 'Play a single string' : 'Hold the note…'}</div>
      {:else}
        <button class="primary" onclick={() => tuner.start()} disabled={tuner.starting || !tuner.supported}>
          <Mic size={20} aria-hidden="true" /> {tuner.starting ? 'Starting…' : 'Start listening'}
        </button>
      {/if}
    </div>
  </section>

  <aside class="side">
    <section class="card">
      <h2>Tuning Mode</h2>
      <div class="seg" role="radiogroup" aria-label="Tuning mode">
        <button role="radio" aria-checked={tuner.mode === 'guided'} class:active={tuner.mode === 'guided'} onclick={() => (tuner.mode = 'guided')}>
          <Crosshair size={18} aria-hidden="true" /> Guided
        </button>
        <button
          role="radio"
          aria-checked={tuner.mode === 'chromatic'}
          class:active={tuner.mode === 'chromatic'}
          onclick={() => {
            tuner.mode = 'chromatic';
            tuner.cancelTuneAll();
          }}
        >
          <AudioWaveform size={18} aria-hidden="true" /> Chromatic
        </button>
      </div>
    </section>

    <section class="card">
      <h2>Tuning Preset</h2>
      <select
        bind:value={tuner.presetId}
        aria-label="Tuning preset"
        onchange={() => tuner.cancelTuneAll()}
      >
        {#each pickerPresets as p (p.id)}<option value={p.id}>{p.name} ({p.notes})</option>{/each}
      </select>
      <div class="row">
        <label for="a4">Reference Pitch (A4)</label>
        <select id="a4" bind:value={tuner.a4}>
          {#each A4_CHOICES as hz}<option value={hz}>{hz} Hz</option>{/each}
        </select>
      </div>
      <label class="check"><input type="checkbox" bind:checked={tuner.precise} /> Precise mode (±2 cents instead of ±5)</label>
      <label class="check"><input type="checkbox" bind:checked={tuner.chime} /> Play a chime when in tune</label>
    </section>

    <section class="card">
      <h2>Input</h2>
      <div class="row">
        <Mic size={18} aria-hidden="true" />
        <select aria-label="Audio input" value={tuner.deviceId ?? ''} onchange={onDeviceChange}>
          <option value="">Default input</option>
          {#each tuner.devices as d (d.deviceId)}{#if d.deviceId !== 'default'}<option value={d.deviceId}>{d.label}</option>{/if}{/each}
        </select>
      </div>
      {#if tuner.channelCount > 1}
        <div class="row">
          <label for="ch">Channel</label>
          <select id="ch" value={String(tuner.channel)} onchange={onChannelChange}>
            <option value="mix">All channels</option>
            {#each Array.from({ length: tuner.channelCount }, (_, i) => i) as i}<option value={String(i)}>Input {i + 1}</option>{/each}
          </select>
        </div>
      {/if}
      <div class="meter" role="meter" aria-label="Input level" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(tuner.level * 100)}>
        {#each Array.from({ length: 20 }, (_, i) => i) as i}
          <span class:on={tuner.level * 20 > i} class:hot={i >= 16}></span>
        {/each}
      </div>
      {#if tuner.listening}
        <button class="ghost" onclick={() => tuner.stop()}><MicOff size={16} aria-hidden="true" /> Stop listening</button>
      {/if}
    </section>
  </aside>
</div>

<section class="card strings">
  <div class="strings-head">
    <h2>Strings: {tuner.preset.name} Tuning</h2>
    <div class="strings-actions">
      {#if tuner.mode === 'guided' && !tuner.tuneAll}
        <label class="check"><input type="checkbox" bind:checked={tuner.autoString} /> Detect string automatically</label>
        <button class="ghost" onclick={() => tuner.startTuneAll()}>Tune all six strings</button>
      {:else if tuner.tuneAll && !tuner.tuneAll.finished}
        <span class="muted">Tuning all six: string {tuner.tuneAll.currentIndex + 1} of 6</span>
        <button class="ghost" onclick={() => tuner.skipTuneAllString()}>Skip string</button>
        <button class="ghost" onclick={() => tuner.cancelTuneAll()}>Cancel</button>
      {:else if tuner.tuneAll?.finished}
        <span class="done-msg">✓ Done: {tuner.tuneAll.done.length} of 6 strings tuned</span>
        <button class="ghost" onclick={() => tuner.cancelTuneAll()}>Close</button>
      {/if}
    </div>
  </div>
  <div class="string-row">
    {#each stringsLowToHigh as s (s.number)}
      {@const active = tuner.mode === 'guided' && tuner.targetString.number === s.number}
      {@const done = tuner.tuneAll?.done.includes(s.number)}
      <div class="string" class:active class:done>
        <button
          class="string-main"
          onclick={() => tuner.selectString(s.number)}
          aria-pressed={active}
          disabled={!!tuner.tuneAll && !tuner.tuneAll.finished}
        >
          <span class="num">{s.number}{#if done} ✓{/if}</span>
          <span class="pitch">{stringPitchName(s)}</span>
          <span class="freq">{midiToFrequency(s.openMidi, tuner.a4).toFixed(1)} Hz</span>
        </button>
        <button class="tone" onclick={() => tuner.playReference(s.number)} aria-label="Play reference tone for string {s.number}" title="Play reference tone">
          <Volume2 size={16} aria-hidden="true" />
        </button>
      </div>
    {/each}
  </div>
</section>

<footer class="status card">
  <span class:live={tuner.listening}><Mic size={16} aria-hidden="true" /> {statusText}</span>
  <span>String: {tuner.mode === 'guided' ? `${tuner.targetString.number} (${stringPitchName(tuner.targetString)})` : 'any'}</span>
  <span>Tuning: {tuner.preset.name}</span>
  <span>A4: {tuner.a4} Hz</span>
  <span class="muted">Audio is analysed on this computer and never recorded.</span>
</footer>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }
  h1 {
    font-size: 2.4rem;
  }
  .head p {
    margin: 2px 0 0;
    color: var(--pw-text-muted);
    font-size: 1.1rem;
  }
  h2 {
    font-size: 1.15rem;
    margin-bottom: 12px;
  }
  .banner {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    border-color: var(--pw-amber);
    margin-bottom: 16px;
  }
  .muted {
    color: var(--pw-text-muted);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr);
    gap: 16px;
  }
  @media (max-width: 1100px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .gauge-card {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .readout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    width: 100%;
    margin-top: -6px;
  }
  .note {
    text-align: center;
    min-width: 180px;
  }
  .name {
    font-size: 4.5rem;
    font-weight: 800;
    line-height: 1;
  }
  .hz {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--pw-primary-hover);
    font-variant-numeric: tabular-nums;
  }
  .pill {
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid var(--pw-border-strong);
    color: var(--pw-text-faint);
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .pill.lit {
    color: var(--pw-text);
    border-color: var(--pw-primary-hover);
    background: var(--pw-primary-soft);
  }
  .feedback {
    margin-top: 16px;
    min-height: 52px;
    display: flex;
    align-items: center;
  }
  .badge {
    padding: 10px 18px;
    border-radius: var(--pw-radius);
    font-weight: 700;
    font-size: 1.1rem;
  }
  .badge span {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .badge.ok {
    border: 2px solid var(--pw-success);
    background: rgba(63, 178, 127, 0.14);
  }
  .badge.guide {
    border: 2px solid var(--pw-primary);
    background: var(--pw-primary-soft);
  }
  .badge.idle {
    color: var(--pw-text-muted);
    font-weight: 500;
  }
  button.primary {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    background: var(--pw-primary);
    border: 0;
    border-radius: var(--pw-radius);
    padding: 12px 22px;
    font-weight: 700;
    font-size: 1.05rem;
    cursor: pointer;
  }
  button.primary:hover:not(:disabled) {
    background: var(--pw-primary-hover);
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .seg button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-radius: var(--pw-radius-sm);
    border: 1px solid var(--pw-border-strong);
    background: var(--pw-surface-2);
    cursor: pointer;
    font-weight: 600;
  }
  .seg button.active {
    background: var(--pw-primary);
    border-color: var(--pw-primary-hover);
  }
  select {
    width: 100%;
    background: var(--pw-surface-2);
    color: var(--pw-text);
    border: 1px solid var(--pw-border-strong);
    border-radius: var(--pw-radius-sm);
    padding: 8px 10px;
    font: inherit;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
  }
  .row label {
    white-space: nowrap;
    color: var(--pw-text-muted);
  }
  .row select {
    flex: 1;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 10px;
    color: var(--pw-text-muted);
  }
  .check input {
    accent-color: var(--pw-primary);
  }
  .meter {
    display: flex;
    gap: 3px;
    margin-top: 12px;
  }
  .meter span {
    flex: 1;
    height: 12px;
    border-radius: 2px;
    background: var(--pw-surface-2);
  }
  .meter span.on {
    background: var(--pw-primary);
  }
  .meter span.on.hot {
    background: var(--pw-amber);
  }
  button.ghost {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    background: none;
    border: 1px solid var(--pw-border-strong);
    border-radius: var(--pw-radius-sm);
    padding: 6px 12px;
    cursor: pointer;
    margin-top: 10px;
  }
  button.ghost:hover {
    border-color: var(--pw-primary-hover);
  }
  .strings {
    margin-top: 16px;
  }
  .strings-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  .strings-head h2 {
    margin: 0;
  }
  .strings-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .strings-actions .check,
  .strings-actions button.ghost {
    margin-top: 0;
  }
  .done-msg {
    color: var(--pw-success);
    font-weight: 600;
  }
  .string-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
    margin-top: 14px;
  }
  .string {
    position: relative;
  }
  .string-main {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 6px;
    border-radius: var(--pw-radius);
    border: 1px solid var(--pw-border-strong);
    background: var(--pw-bg-raised);
    cursor: pointer;
  }
  .string.active .string-main {
    background: var(--pw-primary);
    border-color: var(--pw-primary-hover);
    box-shadow: 0 0 18px rgba(35, 139, 235, 0.35);
  }
  .string.done .string-main {
    border-color: var(--pw-success);
  }
  .num {
    font-size: 1.4rem;
    font-weight: 700;
  }
  .pitch {
    font-size: 1.5rem;
    font-weight: 800;
  }
  .freq {
    color: var(--pw-text-muted);
  }
  .string.active .freq {
    color: var(--pw-text);
  }
  .tone {
    position: absolute;
    top: 6px;
    right: 6px;
    background: none;
    border: 0;
    color: var(--pw-text-muted);
    cursor: pointer;
    padding: 4px;
  }
  .tone:hover {
    color: var(--pw-text);
  }
  .status {
    margin-top: 16px;
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    align-items: center;
    padding: 12px 20px;
  }
  .status span {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .status .live {
    color: var(--pw-success);
  }
</style>

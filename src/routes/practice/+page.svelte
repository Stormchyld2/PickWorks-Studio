<script lang="ts">
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte';
</script>


<ComingSoon title="Practice" message="Guided practice is coming soon. You can use the metronome and fretboard tools now.">
  <a class="pw-btn" href="/fretboard">Open Fretboard Explorer</a>
</ComingSoon>

<section class="card tool">
  <div>
    <strong>Metronome</strong>
    <span>Keep steady time with tempo, time signature, subdivisions and tap tempo.</span>
  </div>
  <a class="pw-btn primary" href="/practice/metronome">Open Metronome</a>
</section>

<style>
  .tool { display: flex; align-items: center; justify-content: space-between; gap: 16px; max-width: 880px; margin-top: 20px; }
  .tool div { display: flex; flex-direction: column; gap: 4px; }
  .tool span { color: var(--pw-text-muted); }
  .tool a { text-decoration: none; white-space: nowrap; }
</style>

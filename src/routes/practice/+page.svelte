<script lang="ts">
  import PlannedScreen from '$lib/components/ui/PlannedScreen.svelte';
</script>


<PlannedScreen
  title="Practice"
  milestone={4}
  summary="Guided drills, timed and untimed challenges, weak-area review and practice history."
  items={['Find the note, name the note, identify string and fret', 'Locate all occurrences, anchors, octave patterns', 'Mixed and weak-area review']}
/>

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

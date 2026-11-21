<script lang="ts">
  import PlannedScreen from '$lib/components/ui/PlannedScreen.svelte';
</script>


<PlannedScreen
  title="Practice"
  milestone={4}
  summary="Guided drills, timed and untimed challenges, weak-area review and practice history."
  items={['Find the note, name the note, identify string and fret', 'Locate all occurrences, anchors, octave patterns', 'Mixed and weak-area review']}
/>

<a class="card tool" href="/practice/metronome">
  <strong>Metronome</strong>
  <span>Keep steady time with tempo, time signature, subdivisions and tap tempo.</span>
</a>

<style>
  .tool { display: flex; flex-direction: column; gap: 4px; max-width: 880px; margin-top: 20px; color: var(--pw-text); text-decoration: none; }
  .tool:hover { border-color: var(--pw-primary-hover); }
  .tool span { color: var(--pw-text-muted); }
</style>

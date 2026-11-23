<!--
  "Still there?" shown in the last minute before the idle sign-out.
  Any input dismisses it, because input counts as activity.
-->
<script lang="ts">
  import Clock from '@lucide/svelte/icons/clock';

  let { secondsLeft, onstay }: { secondsLeft: number; onstay: () => void } = $props();
</script>

<div class="backdrop">
  <div class="glow-card dialog" role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-desc">
    <h2 id="idle-title"><Clock size={22} /> Still there?</h2>
    <p id="idle-desc">You'll be signed out in <b>{secondsLeft}</b> seconds because there's been no activity. Your work will be saved first.</p>
    <button class="pw-btn primary wide" onclick={onstay}>I'm Still Here</button>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgba(11, 17, 25, 0.7); }
  .dialog { width: min(440px, calc(100vw - 32px)); }
  h2 { display: flex; align-items: center; gap: 10px; font-size: 1.3rem; }
  h2 :global(svg) { color: var(--pw-amber); }
  p { margin: 12px 0 18px; }
</style>

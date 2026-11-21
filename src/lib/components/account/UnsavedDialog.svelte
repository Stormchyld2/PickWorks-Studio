<!-- Asks before a manual sign-out that would leave work unsaved. -->
<script lang="ts">
  import CircleAlert from '@lucide/svelte/icons/circle-alert';

  let { items, oncancel, onconfirm }: { items: string[]; oncancel: () => void; onconfirm: () => void } = $props();
</script>

<div class="backdrop">
  <div class="glow-card dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title">
    <h2 id="unsaved-title"><CircleAlert size={22} /> Some work couldn't be saved</h2>
    <p>These couldn't be saved yet: <b>{items.join(', ')}</b>. If you sign out now they will be lost.</p>
    <div class="actions">
      <button class="pw-btn primary" onclick={oncancel}>Stay Signed In</button>
      <button class="pw-btn warn" onclick={onconfirm}>Sign Out Anyway</button>
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgba(11, 17, 25, 0.7); }
  .dialog { width: min(480px, calc(100vw - 32px)); }
  h2 { display: flex; align-items: center; gap: 10px; font-size: 1.3rem; }
  h2 :global(svg) { color: var(--pw-amber); }
  p { margin: 12px 0 18px; }
  .actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>

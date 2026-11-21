<!-- Modal dialog with a glow card. Escape or the close button dismisses it. -->
<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import type { Snippet } from 'svelte';

  let { title, onclose, width = 520, children }: { title: string; onclose: () => void; width?: number; children: Snippet } = $props();
  let card: HTMLDivElement | undefined = $state();

  $effect(() => {
    const first = card?.querySelector<HTMLElement>('input, select, textarea, button:not(.x)');
    first?.focus();
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop">
  <div bind:this={card} class="glow-card dialog" style:width="min({width}px, calc(100vw - 32px))" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
    <div class="head">
      <h2 id="dlg-title">{title}</h2>
      <button class="x" onclick={onclose} aria-label="Close"><X size={20} /></button>
    </div>
    {@render children()}
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: rgba(11, 17, 25, 0.72); }
  .dialog { max-height: calc(100vh - 48px); overflow-y: auto; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  h2 { font-size: 1.3rem; }
  .x { background: none; border: 0; color: var(--pw-text-muted); cursor: pointer; padding: 4px; display: grid; }
  .x:hover { color: var(--pw-text); }
</style>

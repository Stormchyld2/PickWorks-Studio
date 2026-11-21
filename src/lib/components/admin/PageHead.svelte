<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  let { title, subtitle, icon: Icon, actions }: { title: string; subtitle: string; icon: Component<{ size?: number }>; actions?: Snippet } = $props();
</script>

<header class="head">
  <span class="ic" aria-hidden="true"><Icon size={44} /></span>
  <div class="txt">
    <h1>{title}</h1>
    <p>{subtitle}</p>
  </div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
  .head { display: flex; align-items: center; gap: 18px; margin: 0 260px 24px 0; }
  .ic { color: var(--pw-amber); display: grid; }
  h1 { font-size: 2.4rem; }
  p { margin: 2px 0 0; color: var(--pw-text-muted); font-size: 1.1rem; }
  .txt { flex: 1; }
</style>

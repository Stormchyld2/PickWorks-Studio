<!--
  Student-facing empty state for a screen whose content arrives later. Plain
  language only: development status belongs in the docs, not the app.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, message, children }: { title: string; message: string; children?: Snippet } = $props();
</script>

<section class="soon">
  <h1>{title}</h1>
  <div class="glow-card">
    <p>{message}</p>
    {#if children}<div class="actions">{@render children()}</div>{/if}
  </div>
</section>

<style>
  .soon { max-width: 880px; }
  h1 { font-size: 2.4rem; margin-bottom: 20px; }
  p { margin: 0; font-size: 1.1rem; color: var(--pw-text); }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
  .actions :global(a) { text-decoration: none; }
</style>

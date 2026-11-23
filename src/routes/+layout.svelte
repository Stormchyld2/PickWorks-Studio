<script lang="ts">
  import '$lib/styles/base.css';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';

  let { children } = $props();
  let collapsed = $state(false);
</script>

<div class="shell">
  <Sidebar bind:collapsed />
  <main>
    {@render children()}
  </main>
</div>

<style>
  .shell {
    display: flex;
    min-height: 100vh;
  }
  main {
    flex: 1;
    min-width: 0;
    padding: 28px 32px 32px;
  }
</style>

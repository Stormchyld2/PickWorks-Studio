<!--
  Focused layout for the account screens (no sidebar): a photo panel with the
  approved logo on the left, the form on the right. From the approved v2 designs.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { panel, children }: { panel?: Snippet; children: Snippet } = $props();
</script>

<div class="split">
  <div class="panel">
    {#if panel}
      {@render panel()}
    {:else}
      <img class="logo" src="/branding/pickworks-logo.png" alt="PickWorks Studio" />
      <div class="tag">Guitar Learning System</div>
    {/if}
  </div>
  <main class="side">
    {@render children()}
  </main>
</div>

<style>
  .split {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 44% 1fr;
    background: var(--pw-bg);
  }
  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    overflow: hidden;
    background:
      linear-gradient(90deg, rgba(11, 17, 25, 0.35) 0%, rgba(11, 17, 25, 0.55) 70%, var(--pw-bg) 100%),
      linear-gradient(0deg, rgba(11, 17, 25, 0.85), rgba(11, 17, 25, 0.15) 55%),
      url('/images/panel-acoustic.jpg') 30% center / cover no-repeat;
  }
  .panel :global(.logo) {
    width: 300px;
    max-width: 90%;
    height: auto;
  }
  .panel :global(.tag) {
    font-size: 1.1rem;
    margin: 4px 0 30px;
  }
  .side {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 48px 72px 48px 56px;
    background: radial-gradient(ellipse at 80% 10%, rgba(35, 139, 235, 0.12), transparent 55%);
  }
  @media (max-width: 839.98px) {
    .split {
      grid-template-columns: 1fr;
    }
    .panel {
      padding: 28px;
      min-height: 220px;
    }
    .side {
      padding: 32px 24px;
    }
  }
</style>

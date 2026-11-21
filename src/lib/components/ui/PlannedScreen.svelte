<!--
  Honest placeholder for screens that are not built yet. Shows what the
  screen will do and which milestone delivers it; never fake data.
-->
<script lang="ts">
  let { title, milestone, summary, items = [] }: { title: string; milestone: number | string; summary: string; items?: string[] } =
    $props();
</script>

<section class="planned">
  <h1>{title}</h1>
  <div class="card">
    <div class="eyebrow">Planned for Milestone {milestone}</div>
    <p>{summary}</p>
    {#if items.length}
      <ul>
        {#each items as item}<li>{item}</li>{/each}
      </ul>
    {/if}
  </div>
</section>

<style>
  .planned {
    max-width: 880px;
  }
  h1 {
    font-size: 2.4rem;
    margin-bottom: 20px;
  }
  p {
    color: var(--pw-text-muted);
    margin: 8px 0 0;
  }
  ul {
    margin: 12px 0 0;
    padding-left: 20px;
    color: var(--pw-text-muted);
  }
</style>

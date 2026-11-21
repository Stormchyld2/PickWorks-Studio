<!--
  A student's picture, or a neutral placeholder. The pick icon is reserved
  for the app icon and is never used as an avatar.
-->
<script lang="ts">
  import User from '@lucide/svelte/icons/user';

  let { src, size = 104, glow = false }: { src?: string; size?: number; glow?: boolean } = $props();
</script>

<span class="avatar" class:glow style:width="{size}px" style:height="{size}px" aria-hidden="true">
  {#if src}
    <img {src} alt="" />
  {:else}
    <User size={Math.round(size * 0.48)} strokeWidth={1.6} />
  {/if}
</span>

<style>
  .avatar {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border-radius: 50%;
    overflow: hidden;
    color: var(--pw-text-muted);
    background: radial-gradient(circle at 50% 35%, var(--pw-surface-2), var(--pw-bg-raised));
    box-shadow: 0 0 0 3px rgba(67, 169, 255, 0.5);
  }
  .avatar.glow {
    box-shadow: 0 0 0 3px var(--pw-primary-hover), 0 0 22px rgba(35, 139, 235, 0.5);
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>

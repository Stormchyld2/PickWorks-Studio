<!--
  Signed-in profile at the top right of the shell. The compact profile
  quick-view opens from here with milestone F; for now it offers Sign Out.
-->
<script lang="ts">
  import LogOut from '@lucide/svelte/icons/log-out';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Avatar from './Avatar.svelte';
  import { auth } from '$lib/stores/auth.svelte';

  let { avatar }: { avatar?: string } = $props();
</script>

{#if auth.info}
  <div class="chip">
    {#if auth.isAdmin}
      <span class="admin" aria-hidden="true"><ShieldCheck size={20} /></span>
    {:else}
      <Avatar src={avatar} size={36} />
    {/if}
    <span class="name">{auth.info.displayName}</span>
    <button class="pw-btn ghost out" onclick={() => auth.signOut('manual')}><LogOut size={18} /> Sign Out</button>
  </div>
{/if}

<style>
  .chip { display: flex; align-items: center; gap: 10px; padding: 4px 4px 4px 6px; border-radius: 999px; background: rgba(24, 37, 51, 0.85); border: 1px solid var(--pw-border); }
  .name { font-weight: 600; }
  .admin { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: var(--pw-amber); background: var(--pw-bg-raised); box-shadow: 0 0 0 2px rgba(245, 158, 56, 0.55); }
  .out { padding: 6px 12px; border-radius: 999px; }
</style>

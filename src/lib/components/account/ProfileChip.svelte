<!--
  Signed-in profile at the top right of the shell (approved designs 4 and 7).
  Students open their profile quick-view from it; both can sign out.
-->
<script lang="ts">
  import LogOut from '@lucide/svelte/icons/log-out';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Avatar from './Avatar.svelte';
  import ProfileQuickView from './ProfileQuickView.svelte';
  import { auth } from '$lib/stores/auth.svelte';

  let open = $state(false);
  const avatar = $derived.by(() => {
    const p = auth.info?.principal;
    return p?.kind === 'student' ? auth.profiles.find((x) => x.id === p.id)?.avatar : undefined;
  });
</script>

{#if auth.info}
  <div class="chip">
    {#if auth.isAdmin}
      <span class="who">
        <span class="admin" aria-hidden="true"><ShieldCheck size={22} /></span>
        <span class="txt"><b>Administrator</b><small>Signs out after 5 min idle</small></span>
      </span>
    {:else}
      <button class="who" onclick={() => (open = true)} aria-haspopup="dialog" aria-label="Open your profile">
        <Avatar src={avatar} size={40} />
        <span class="txt"><b>{auth.info.displayName}</b><small>View profile</small></span>
      </button>
    {/if}
    <button class="out" onclick={() => auth.requestSignOut()} aria-label="Sign out" title="Sign out"><LogOut size={20} /></button>
  </div>
  {#if open}<ProfileQuickView {avatar} onclose={() => (open = false)} />{/if}
{/if}

<style>
  .chip { display: flex; align-items: center; gap: 6px; padding: 5px 8px 5px 5px; border-radius: 999px; background: rgba(24, 37, 51, 0.88); border: 1px solid var(--pw-border-strong); }
  .who { display: flex; align-items: center; gap: 10px; background: none; border: 0; padding: 0 10px 0 0; color: var(--pw-text); cursor: pointer; text-align: left; border-right: 1px solid var(--pw-border); border-radius: 999px 0 0 999px; }
  span.who { cursor: default; }
  .txt { display: flex; flex-direction: column; line-height: 1.2; }
  small { color: var(--pw-text-muted); font-size: 0.82rem; }
  .admin { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; color: var(--pw-amber); background: var(--pw-bg-raised); box-shadow: 0 0 0 2px rgba(245, 158, 56, 0.6); }
  .out { background: none; border: 0; color: var(--pw-text-muted); cursor: pointer; padding: 6px; display: grid; }
  .out:hover { color: var(--pw-text); }
</style>

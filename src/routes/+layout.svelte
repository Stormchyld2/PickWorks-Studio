<script lang="ts">
  import '$lib/styles/base.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { ADMIN_PRIMARY_NAV, ADMIN_SECONDARY_NAV, PRIMARY_NAV, SECONDARY_NAV, allowedFor } from '$lib/components/navigation/nav-items';
  import AccountScreens from '$lib/components/account/AccountScreens.svelte';
  import ProfileChip from '$lib/components/account/ProfileChip.svelte';
  import IdleWarning from '$lib/components/account/IdleWarning.svelte';
  import UnsavedDialog from '$lib/components/account/UnsavedDialog.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { session } from '$lib/services/session';
  import { bindInputActivity } from '$lib/services/session-lifecycle';
  import { inTauri } from '$lib/services/core-client';

  let { children } = $props();
  let collapsed = $state(false);
  let warningSecs = $state<number | null>(null);

  const signedIn = $derived(auth.screen.name === 'app' && auth.info !== null);
  const kind = $derived(auth.info?.principal.kind ?? 'student');

  onMount(() => {
    void auth.init();
    const unbind = bindInputActivity(window, session);
    const timer = setInterval(async () => {
      const s = await session.tick();
      warningSecs = s.phase === 'warning' ? Math.ceil(s.remainingMs / 1000) : null;
    }, 1000);

    // Closing the window signs out first, so work is saved and audio stops.
    let unlistenClose: (() => void) | undefined;
    if (inTauri()) {
      void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
        unlistenClose = await getCurrentWindow().onCloseRequested(async () => {
          await auth.signOut('shutdown');
        });
      });
    }
    return () => {
      unbind();
      clearInterval(timer);
      unlistenClose?.();
    };
  });

  // Each account sees only its own pages: students never reach the admin area,
  // and the administrator has no student pages.
  $effect(() => {
    if (!signedIn) return;
    if (!allowedFor(kind, page.url.pathname)) void goto(kind === 'admin' ? '/admin' : '/', { replaceState: true });
  });
</script>

{#if !signedIn}
  <AccountScreens />
{:else}
  <div class="shell">
    {#if kind === 'admin'}
      <Sidebar bind:collapsed primary={ADMIN_PRIMARY_NAV} secondary={ADMIN_SECONDARY_NAV} onsignout={() => auth.signOut('manual')} />
    {:else}
      <Sidebar bind:collapsed primary={PRIMARY_NAV} secondary={SECONDARY_NAV} />
    {/if}
    <main>
      <div class="topbar"><ProfileChip /></div>
      {#if allowedFor(kind, page.url.pathname)}{@render children()}{/if}
    </main>
  </div>
{/if}

{#if warningSecs !== null && auth.info}
  <IdleWarning secondsLeft={warningSecs} onstay={() => session.activity()} />
{/if}
{#if auth.unsaved}
  <UnsavedDialog items={auth.unsaved} oncancel={() => (auth.unsaved = null)} onconfirm={() => auth.signOut('manual', true)} />
{/if}

<style>
  .shell {
    display: flex;
    min-height: 100vh;
  }
  main {
    position: relative;
    flex: 1;
    min-width: 0;
    padding: 28px 32px 32px;
  }
  .topbar {
    position: absolute;
    top: 18px;
    right: 24px;
    z-index: 5;
  }
</style>

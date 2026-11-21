<script lang="ts">
  import '$lib/styles/base.css';
  import { onMount, untrack } from 'svelte';
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
  import { preferences } from '$lib/stores/preferences.svelte';
  import { tuner } from '$lib/stores/tuner.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';

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

  // Load the student's settings at sign-in; everyone else uses the defaults.
  $effect(() => {
    const student = auth.info?.principal.kind === 'student' && !auth.info.mustChangePassword;
    const token = auth.info?.token;
    untrack(() => (student && token ? void preferences.load() : preferences.reset()));
  });

  // Tuner changes made on the Tuner screen are saved to the student's settings.
  $effect(() => {
    const t = { a4: tuner.a4, presetId: tuner.presetId, precise: tuner.precise, chime: tuner.chime, mode: tuner.mode };
    if (!preferences.loaded) return;
    const cur = preferences.value.tuner;
    if (t.a4 !== cur.a4 || t.presetId !== cur.presetId || t.precise !== cur.precise || t.chime !== cur.chime || t.mode !== cur.mode) {
      untrack(() => void preferences.update((p) => (p.tuner = t)));
    }
  });
  $effect(() => {
    const id = tuner.deviceId;
    if (preferences.loaded && id !== preferences.value.audio.inputDeviceId) untrack(() => void preferences.update((p) => (p.audio.inputDeviceId = id)));
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
  <a class="skip" href="#main">Skip to content</a>
  <div class="shell">
    {#if kind === 'admin'}
      <Sidebar bind:collapsed primary={ADMIN_PRIMARY_NAV} secondary={ADMIN_SECONDARY_NAV} onsignout={() => auth.requestSignOut()} />
    {:else}
      <Sidebar bind:collapsed primary={PRIMARY_NAV} secondary={SECONDARY_NAV} />
    {/if}
    <main id="main" tabindex="-1">
      <div class="topbar"><ProfileChip /></div>
      {#if allowedFor(kind, page.url.pathname)}{@render children()}{/if}
    </main>
  </div>
{/if}

{#if warningSecs !== null && auth.info}
  <IdleWarning secondsLeft={warningSecs} onstay={() => session.activity()} />
{/if}
{#if auth.confirmingSignOut}
  <Dialog title="Sign out?" onclose={() => (auth.confirmingSignOut = false)} width={420}>
    <p>Your work is saved first. You'll need your password to sign in again.</p>
    <div class="confirm-actions">
      <button class="pw-btn" onclick={() => (auth.confirmingSignOut = false)}>Stay Signed In</button>
      <button class="pw-btn primary" onclick={() => auth.signOut('manual')}>Sign Out</button>
    </div>
  </Dialog>
{/if}
{#if preferences.saveError && signedIn}
  <div class="save-error pw-note amber" role="alert">{preferences.saveError}</div>
{/if}
{#if auth.unsaved}
  <UnsavedDialog items={auth.unsaved} oncancel={() => (auth.unsaved = null)} onconfirm={() => auth.signOut('manual', true)} />
{/if}

<style>
  .skip {
    position: absolute;
    left: 12px;
    top: -60px;
    z-index: 200;
    padding: 10px 16px;
    border-radius: var(--pw-radius-sm);
    background: var(--pw-primary);
    color: #fff;
    font-weight: 600;
    text-decoration: none;
  }
  .skip:focus {
    top: 12px;
  }
  main:focus {
    outline: none;
  }
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
  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 16px;
  }
  .save-error {
    position: fixed;
    bottom: 20px;
    right: 24px;
    z-index: 80;
    max-width: 420px;
  }
  /* The profile chip sits on its own row so it never covers page controls. */
  .topbar {
    display: flex;
    justify-content: flex-end;
    margin: -12px -8px 8px 0;
    position: relative;
    z-index: 5;
  }
</style>

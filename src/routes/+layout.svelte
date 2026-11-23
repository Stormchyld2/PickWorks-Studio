<script lang="ts">
  import '$lib/styles/base.css';
  import { onMount, untrack } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import Sidebar from '$lib/components/navigation/Sidebar.svelte';
  import { ADMIN_PRIMARY_NAV, ADMIN_SECONDARY_NAV, SECONDARY_NAV, TOOLS_NAV, allowedFor, workspaceNav } from '$lib/components/navigation/nav-items';
  import { ownerOfPath } from '$lib/engines/workspaces/config';
  import { workspace } from '$lib/stores/workspace.svelte';
  import AccountScreens from '$lib/components/account/AccountScreens.svelte';
  import ProfileChip from '$lib/components/account/ProfileChip.svelte';
  import IdleWarning from '$lib/components/account/IdleWarning.svelte';
  import UnsavedDialog from '$lib/components/account/UnsavedDialog.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { session } from '$lib/services/session';
  import { bindInputActivity } from '$lib/services/session-lifecycle';
  import { onAppClosing, onAppHidden } from '$lib/services/platform';
  import { layout } from '$lib/stores/layout.svelte';
  import { preferences } from '$lib/stores/preferences.svelte';
  import { tuner } from '$lib/stores/tuner.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';

  let { children } = $props();
  let collapsed = $state(false);
  let warningSecs = $state<number | null>(null);
  /** Set when saving on the way to the background left something unsaved. */
  let backgroundUnsaved = $state<string[]>([]);

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
    const unlistenClose = onAppClosing(() => auth.signOut('shutdown').then(() => {}));
    // Going to the background (app switch, minimise) saves work but never signs out.
    const unlistenHidden = onAppHidden(document, () => {
      void session.checkpoint().then((r) => (backgroundUnsaved = r.unsaved));
    });
    const unbindLayout = layout.bind(window);
    return () => {
      unbind();
      clearInterval(timer);
      unlistenClose();
      unlistenHidden();
      unbindLayout();
    };
  });

  // Load the student's settings and workspace access at sign-in; everyone else uses the defaults.
  $effect(() => {
    const student = auth.info?.principal.kind === 'student' && !auth.info.mustChangePassword;
    const token = auth.info?.token;
    untrack(() => {
      if (student && token) void startStudent();
      else {
        preferences.reset();
        workspace.reset();
        collapsed = false;
      }
    });
  });

  async function startStudent() {
    await preferences.load();
    collapsed = preferences.value.workspace.sidebarCollapsed;
    const home = await workspace.load();
    // Open the start-up workspace (Learning Studio unless another one is chosen and open).
    if (home !== '/' && page.url.pathname === '/') void goto(home, { replaceState: true });
  }

  // "Keep the sidebar collapsed" in Settings applies straight away.
  $effect(() => {
    if (kind !== 'student' || !preferences.loaded) return;
    const c = preferences.value.workspace.sidebarCollapsed;
    untrack(() => (collapsed = c));
  });

  function rememberCollapsed(c: boolean) {
    if (kind === 'student' && preferences.loaded) void preferences.update((p) => (p.workspace.sidebarCollapsed = c));
  }

  // Workspace access is enforced on every navigation, not only by what the
  // sidebar shows. Links, back and forward are stopped before they leave...
  beforeNavigate((nav) => {
    if (!signedIn || kind !== 'student' || !nav.to || nav.to.url.origin !== location.origin) return;
    const g = workspace.guard(nav.to.url.pathname);
    if (!g.allow) {
      nav.cancel();
      workspace.notice = g.message;
    }
  });

  // ...and any address that is open anyway (typed, pasted, start-up, or access
  // that changed) is replaced before its page is shown.
  $effect(() => {
    if (!signedIn || kind !== 'student') return;
    const path = page.url.pathname;
    const g = workspace.guard(path);
    untrack(() => {
      if (!g.allow) {
        workspace.notice = g.message;
        void goto(g.redirect, { replaceState: true });
      } else workspace.follow(path);
    });
  });

  // When the student hides the workspace they're in (or it stops being
  // available), move to Learning Studio, or the next visible workspace.
  $effect(() => {
    if (!signedIn || kind !== 'student') return;
    const visible = workspace.visible.join(',');
    untrack(() => {
      void visible;
      const home = workspace.settle();
      const owner = ownerOfPath(page.url.pathname);
      if (home && owner.kind === 'workspace' && owner.workspace !== workspace.current) void goto(home);
    });
  });

  $effect(() => {
    if (!workspace.notice) return;
    const t = setTimeout(() => (workspace.notice = null), 8000);
    return () => clearTimeout(t);
  });

  const pageAllowed = $derived(allowedFor(kind, page.url.pathname) && (kind === 'admin' || workspace.guard(page.url.pathname).allow));

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
      <Sidebar bind:collapsed primary={workspaceNav(workspace.current)} secondary={SECONDARY_NAV} tools={TOOLS_NAV} workspaces oncollapse={rememberCollapsed} />
    {/if}
    <main id="main" tabindex="-1">
      <div class="topbar"><ProfileChip /></div>
      {#if pageAllowed}{@render children()}{/if}
    </main>
  </div>
{/if}

<div class="sr-only" aria-live="polite" role="status">{signedIn ? workspace.announcement : ''}</div>
{#if workspace.notice && signedIn}
  <div class="save-error pw-note" role="alert">
    {workspace.notice}
    <button class="pw-btn ghost" onclick={() => (workspace.notice = null)}>Dismiss</button>
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
{#if backgroundUnsaved.length && signedIn}
  <div class="save-error pw-note amber" role="alert">
    Some work couldn't be saved yet: {backgroundUnsaved.join(', ')}. It will be tried again.
    <button class="pw-btn ghost" onclick={() => (backgroundUnsaved = [])}>Dismiss</button>
  </div>
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

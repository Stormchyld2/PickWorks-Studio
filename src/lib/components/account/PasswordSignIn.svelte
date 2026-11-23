<!--
  Password sign-in (approved design 3), for a student or the administrator.
  Wrong passwords wait a little longer each time; the countdown shows how long.
-->
<script lang="ts">
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import Info from '@lucide/svelte/icons/info';
  import LogIn from '@lucide/svelte/icons/log-in';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import FocusSplit from './FocusSplit.svelte';
  import PasswordField from './PasswordField.svelte';
  import Avatar from './Avatar.svelte';
  import { formatWait, friendlyError } from './errors';
  import { auth } from '$lib/stores/auth.svelte';
  import { CoreError, type ProfileCard } from '$lib/services/core-client';

  let { profile }: { profile: ProfileCard | 'admin' } = $props();

  const isAdmin = $derived(profile === 'admin');
  const name = $derived(profile === 'admin' ? 'Administrator' : profile.displayName);

  let password = $state('');
  let error = $state('');
  let busy = $state(false);
  let waitUntil = $state(0);
  let now = $state(Date.now());
  const waitSecs = $derived(Math.max(0, Math.ceil((waitUntil - now) / 1000)));

  $effect(() => {
    if (!waitUntil) return;
    const t = setInterval(() => (now = Date.now()), 500);
    return () => clearInterval(t);
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!password || busy || waitSecs > 0) return;
    busy = true;
    error = '';
    try {
      await auth.signIn(password);
    } catch (err) {
      error = friendlyError(err);
      if (err instanceof CoreError && err.retryAfterSecs) {
        waitUntil = Date.now() + err.retryAfterSecs * 1000;
        now = Date.now();
      }
      password = '';
    } finally {
      busy = false;
    }
  }
</script>

<FocusSplit>
  {#snippet panel()}
    {#if profile === 'admin'}
      <span class="admin-badge" aria-hidden="true"><ShieldCheck size={96} strokeWidth={1.4} /></span>
    {:else}
      <Avatar src={profile.avatar} size={210} glow />
    {/if}
    <h2 class="nm">{name}</h2>
  {/snippet}

  <img class="mini-logo" src="/branding/pickworks-logo.png" alt="PickWorks Studio" />
  <h1 class="h">Enter Your Password</h1>
  <p class="muted lead">{isAdmin ? 'Sign in to manage students, backups and passwords.' : 'Sign in to your PickWorks Studio profile.'}</p>

  <form class="form" onsubmit={submit}>
    <label class="sr-only" for="pw">Password for {name}</label>
    <PasswordField id="pw" bind:value={password} placeholder="Password" invalid={!!error} autofocus />
    {#if error}
      <div class="pw-note error" role="alert">
        <CircleAlert size={18} />
        <span>{waitSecs > 0 ? `Too many tries. You can try again in ${formatWait(waitSecs)}.` : error}</span>
      </div>
    {/if}
    <button class="pw-btn primary big wide" type="submit" disabled={!password || busy || waitSecs > 0}><LogIn size={20} /> Sign In</button>
    <button class="pw-btn ghost back" type="button" onclick={() => auth.showProfiles()}><ChevronLeft size={18} /> Back to Profiles</button>
    {#if isAdmin}
      <button class="pw-btn ghost back" type="button" onclick={() => (auth.screen = { name: 'recover' })}>Forgot the administrator password?</button>
    {:else}
      <div class="pw-note"><Info size={18} color="var(--pw-primary-hover)" /> <span>Forgot your password? Ask your administrator to reset it. Your progress is always kept.</span></div>
    {/if}
  </form>
  <p class="fine">
    After a wrong password, sign-in waits a little longer each time.
    {isAdmin ? 'The administrator is signed out after 5 minutes without activity.' : 'Inactive students are signed out after 20 minutes, and work is saved first.'}
  </p>
</FocusSplit>

<style>
  .admin-badge { width: 210px; height: 210px; border-radius: 50%; display: grid; place-items: center; color: var(--pw-amber); background: radial-gradient(circle at 50% 35%, var(--pw-surface-2), var(--pw-bg-raised)); box-shadow: 0 0 0 4px rgba(245, 158, 56, 0.6); }
  .nm { font-size: 2.2rem; margin-top: 22px; }
  .mini-logo { width: 190px; height: auto; margin-bottom: 26px; }
  .h { font-size: 2.3rem; }
  .lead { margin: 4px 0 24px; font-size: 1.1rem; }
  .form { max-width: 520px; display: flex; flex-direction: column; gap: 14px; }
  .form :global(.pw-field) { margin-bottom: 0; }
  .back { align-self: center; }
  .fine { max-width: 520px; color: var(--pw-text-faint); font-size: 0.84rem; margin-top: 22px; }
</style>

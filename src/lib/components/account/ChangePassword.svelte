<!--
  Shown after signing in with a temporary password (new student, or after an
  administrator reset). Nothing else opens until a new password is chosen.
-->
<script lang="ts">
  import KeyRound from '@lucide/svelte/icons/key-round';
  import Check from '@lucide/svelte/icons/check';
  import Info from '@lucide/svelte/icons/info';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import FocusSplit from './FocusSplit.svelte';
  import PasswordField from './PasswordField.svelte';
  import { friendlyError } from './errors';
  import { auth } from '$lib/stores/auth.svelte';

  let current = $state('');
  let next = $state('');
  let confirm = $state('');
  let error = $state('');
  let busy = $state(false);

  const longEnough = $derived(next.length >= 8);
  const matches = $derived(next.length > 0 && next === confirm);
  const different = $derived(next.length > 0 && next !== current);
  const ok = $derived(current.length > 0 && longEnough && matches && different && !busy);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!ok) return;
    busy = true;
    error = '';
    try {
      await auth.changePassword(current, next);
    } catch (err) {
      error = friendlyError(err);
    } finally {
      busy = false;
    }
  }
</script>

<FocusSplit>
  <h1 class="h">Choose a New Password</h1>
  <p class="muted lead">Hi {auth.info?.displayName}. Your administrator gave you a temporary password. Choose your own to continue.</p>
  <form class="glow-card form" onsubmit={submit}>
    <h2><KeyRound size={22} /> New Password</h2>
    <PasswordField id="cur" label="Temporary password" bind:value={current} autofocus />
    <PasswordField id="new" label="New password" hint="(minimum 8 characters)" autocomplete="new-password" bind:value={next} />
    <PasswordField id="new2" label="Confirm new password" autocomplete="new-password" bind:value={confirm} />
    <ul class="rules">
      <li class:ok={longEnough}><Check size={16} /> At least 8 characters</li>
      <li class:ok={matches}><Check size={16} /> Both match</li>
      <li class:ok={different}><Check size={16} /> Not the temporary one</li>
    </ul>
    {#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}
    <div class="pw-note"><Info size={18} color="var(--pw-primary-hover)" /> <span>Your progress, mastery and history are kept.</span></div>
    <div class="actions">
      <button class="pw-btn ghost" type="button" onclick={() => auth.signOut('manual', true)}>Sign Out</button>
      <button class="pw-btn primary" type="submit" disabled={!ok}>Save and Continue</button>
    </div>
  </form>
</FocusSplit>

<style>
  .h { font-size: 2.3rem; }
  .lead { margin: 4px 0 20px; font-size: 1.1rem; max-width: 640px; }
  .form { max-width: 640px; display: flex; flex-direction: column; gap: 4px; }
  .form h2 { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; margin-bottom: 12px; }
  .form h2 :global(svg) { color: var(--pw-primary); }
  .rules { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-wrap: wrap; gap: 22px; color: var(--pw-text-muted); font-size: 0.9rem; }
  .rules li { display: flex; align-items: center; gap: 6px; }
  .rules li.ok { color: var(--pw-success); }
  .pw-note { margin-top: 8px; }
  .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
</style>

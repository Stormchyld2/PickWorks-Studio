<!--
  Compact profile quick-view (approved design 7). Shows what exists in
  Phase 1; levels, XP and badges arrive with gamification in Phase 2.
-->
<script lang="ts">
  import Star from '@lucide/svelte/icons/star';
  import Target from '@lucide/svelte/icons/target';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import LogOut from '@lucide/svelte/icons/log-out';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Avatar from './Avatar.svelte';
  import PasswordField from './PasswordField.svelte';
  import { friendlyError } from './errors';
  import { auth } from '$lib/stores/auth.svelte';
  import { backend } from '$lib/services/backend';

  let { avatar, onclose }: { avatar?: string; onclose: () => void } = $props();

  let mastered = $state<number | null>(null);
  let answers = $state<number | null>(null);
  let changing = $state(false);
  let current = $state('');
  let next = $state('');
  let confirm = $state('');
  let error = $state('');
  let done = $state(false);
  let busy = $state(false);

  $effect(() => {
    const data = auth.data;
    if (!data) return;
    data.masteryEvents().then((e) => (mastered = e.length)).catch(() => (mastered = null));
    data.attempts().then((a) => (answers = a.length)).catch(() => (answers = null));
  });

  async function change(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      await backend.changePassword(auth.info!.token, current, next);
      done = true;
      changing = false;
      current = next = confirm = '';
    } catch (err) {
      error = friendlyError(err);
    } finally {
      busy = false;
    }
  }
</script>

<Dialog title="Your Profile" {onclose} width={620}>
  <div class="top">
    <Avatar src={avatar} size={96} glow />
    <div>
      <div class="name">{auth.info?.displayName}</div>
      <div class="muted">Signed in · signs out after 20 minutes without activity</div>
    </div>
  </div>

  <div class="stats">
    <div class="glow-card stat"><Star size={22} /><strong>{mastered ?? '–'}</strong><span class="muted">Skills mastered</span></div>
    <div class="glow-card stat"><Target size={22} /><strong>{answers ?? '–'}</strong><span class="muted">Practice answers</span></div>
  </div>

  {#if done}<div class="pw-note ok" role="status"><CircleCheck size={18} /> <span>Your password was changed.</span></div>{/if}

  {#if changing}
    <form class="change" onsubmit={change}>
      <PasswordField id="qv-cur" label="Current password" bind:value={current} />
      <PasswordField id="qv-new" label="New password" hint="(minimum 8 characters)" autocomplete="new-password" bind:value={next} />
      <PasswordField id="qv-new2" label="Confirm new password" autocomplete="new-password" bind:value={confirm} />
      {#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}
      <div class="actions">
        <button class="pw-btn" type="button" onclick={() => (changing = false)}>Cancel</button>
        <button class="pw-btn primary" type="submit" disabled={busy || !current || next.length < 8 || next !== confirm}>Change Password</button>
      </div>
    </form>
  {:else}
    <div class="actions">
      <button class="pw-btn" onclick={() => ((changing = true), (done = false), (error = ''))}><KeyRound size={18} /> Change password</button>
      <span class="spacer"></span>
      <button class="pw-btn warn" onclick={() => auth.requestSignOut()}><LogOut size={18} /> Sign out</button>
    </div>
  {/if}
</Dialog>

<style>
  .top { display: flex; align-items: center; gap: 20px; margin-bottom: 18px; }
  .name { font-size: 1.8rem; font-weight: 700; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
  .stat { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px; }
  .stat :global(svg) { color: var(--pw-primary); }
  .stat strong { font-size: 1.5rem; }
  .actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 14px; border-top: 1px solid var(--pw-border); }
  .spacer { flex: 1; }
  .change .actions { border-top: 0; }
  .pw-note { margin-bottom: 14px; }
  .pw-note.ok { background: rgba(63, 178, 127, 0.12); border-color: rgba(63, 178, 127, 0.5); }
</style>

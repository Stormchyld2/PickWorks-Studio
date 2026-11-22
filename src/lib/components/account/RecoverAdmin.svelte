<!--
  Administrator recovery. With the recovery key from setup; or, when the key
  is lost too, with approval from a Windows administrator (the app restarts
  through the Windows UAC prompt). Either way only the administrator password
  changes, a new recovery key is issued, and the recovery is audited.
-->
<script lang="ts">
  import KeyRound from '@lucide/svelte/icons/key-round';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Info from '@lucide/svelte/icons/info';
  import Copy from '@lucide/svelte/icons/copy';
  import Printer from '@lucide/svelte/icons/printer';
  import FocusSplit from './FocusSplit.svelte';
  import PasswordField from './PasswordField.svelte';
  import { friendlyError } from './errors';
  import { auth } from '$lib/stores/auth.svelte';
  import { backend } from '$lib/services/backend';
  import { platform, printPage } from '$lib/services/platform';

  const elevated = auth.launchMode === 'recover-admin';
  let mode = $state<'key' | 'windows'>(elevated ? 'windows' : 'key');
  let key = $state('');
  let next = $state('');
  let confirm = $state('');
  let error = $state('');
  let busy = $state(false);
  let newKey = $state('');
  let saved = $state(false);

  const ok = $derived((mode === 'windows' || key.trim().length >= 25) && next.length >= 8 && next === confirm && !busy);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!ok) return;
    busy = true;
    error = '';
    try {
      newKey = mode === 'key' ? await backend.recoverWithKey(key, next) : await backend.recoverWithWindowsAdmin(next);
      key = next = confirm = '';
    } catch (err) {
      error = friendlyError(err);
    } finally {
      busy = false;
    }
  }

  async function relaunch() {
    error = '';
    try {
      await backend.relaunchElevated();
    } catch (err) {
      error = friendlyError(err);
    }
  }
</script>

<FocusSplit>
  <h1 class="h">Reset Administrator Password</h1>
  <p class="muted lead">Student accounts and progress are not changed.</p>

  {#if newKey}
    <section class="glow-card form print-key">
      <h2><KeyRound size={22} /> Password Changed. Here Is Your New Recovery Key</h2>
      <p class="muted sub">The old recovery key no longer works. Save this one; it is shown only once.</p>
      <div class="key">{newKey}</div>
      <div class="row no-print">
        <button class="pw-btn" type="button" onclick={() => navigator.clipboard.writeText(newKey).catch(() => {})}><Copy size={18} /> Copy</button>
        {#if platform.print !== 'none'}<button class="pw-btn" type="button" onclick={printPage}><Printer size={18} /> Print</button>{/if}
      </div>
      <label class="check no-print"><input type="checkbox" bind:checked={saved} /> I have saved or printed my new recovery key</label>
      <div class="actions no-print">
        <button class="pw-btn primary" type="button" disabled={!saved} onclick={() => auth.showProfiles()}>Done</button>
      </div>
    </section>
  {:else if mode === 'windows' && !elevated}
    <section class="glow-card form">
      <h2><ShieldCheck size={22} /> Lost the Recovery Key Too?</h2>
      <p class="sub">A Windows administrator on this computer can approve the reset. PickWorks Studio will restart and Windows will ask for approval.</p>
      {#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}
      <div class="actions">
        <button class="pw-btn ghost" type="button" onclick={() => (mode = 'key')}><ChevronLeft size={18} /> Use the recovery key</button>
        <button class="pw-btn primary" type="button" onclick={relaunch}><ShieldCheck size={18} /> Restart with Windows Approval</button>
      </div>
    </section>
  {:else}
    <form class="glow-card form" onsubmit={submit}>
      {#if mode === 'key'}
        <h2><KeyRound size={22} /> Use Your Recovery Key</h2>
        <div class="pw-field">
          <label for="rk">Recovery key <span class="hint">(from setup, like ABCDE-FGHJK-…)</span></label>
          <div class="pw-input"><KeyRound size={18} aria-hidden="true" /><input id="rk" bind:value={key} autocomplete="off" spellcheck="false" /></div>
        </div>
      {:else}
        <h2><ShieldCheck size={22} /> Approved by Windows</h2>
        <p class="sub">A Windows administrator approved this reset. Choose a new administrator password.</p>
      {/if}
      <PasswordField id="np" label="New administrator password" hint="(minimum 8 characters)" autocomplete="new-password" bind:value={next} />
      <PasswordField id="np2" label="Confirm new password" autocomplete="new-password" bind:value={confirm} />
      {#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}
      <div class="pw-note"><Info size={18} color="var(--pw-primary-hover)" /> <span>This is recorded in the audit log.</span></div>
      <div class="actions">
        {#if mode === 'key' && platform.windowsAdminRecovery}<button class="pw-btn ghost" type="button" onclick={() => (mode = 'windows')}>I lost the recovery key</button>{/if}
        <button class="pw-btn" type="button" onclick={() => auth.showProfiles()}>Cancel</button>
        <button class="pw-btn primary" type="submit" disabled={!ok}>Reset Password</button>
      </div>
    </form>
  {/if}
</FocusSplit>

<style>
  .h { font-size: 2.3rem; }
  .lead { margin: 4px 0 20px; font-size: 1.1rem; }
  .form { max-width: 640px; display: flex; flex-direction: column; gap: 4px; }
  .form h2 { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; margin-bottom: 12px; }
  .form h2 :global(svg) { color: var(--pw-primary); flex-shrink: 0; }
  .sub { margin: 0 0 14px; font-size: 0.95rem; }
  .pw-note { margin-top: 8px; }
  .actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
  .key { font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; font-size: 1.6rem; letter-spacing: 0.08em; text-align: center; padding: 18px; border-radius: var(--pw-radius); background: var(--pw-bg-raised); border: 1px solid var(--pw-border-strong); user-select: all; }
  .row { display: flex; gap: 10px; justify-content: center; margin: 14px 0 6px; }
  .check { display: flex; gap: 10px; align-items: center; margin-top: 12px; cursor: pointer; }
  .check input { width: 18px; height: 18px; accent-color: var(--pw-primary); }
  @media print {
    :global(body *) { visibility: hidden; }
    .print-key, .print-key :global(*) { visibility: visible; color: #000 !important; }
    .print-key { position: absolute; inset: 0 auto auto 0; background: #fff; box-shadow: none; border: 0; }
    .print-key .key { background: #fff; border-color: #000; }
    .no-print { display: none !important; }
  }
</style>

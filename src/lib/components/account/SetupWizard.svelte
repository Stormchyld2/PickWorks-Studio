<!--
  First-run setup (approved design 1): administrator account, recovery key,
  confirm and finish. Runs once; there are no default credentials.
-->
<script lang="ts">
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import Check from '@lucide/svelte/icons/check';
  import Info from '@lucide/svelte/icons/info';
  import User from '@lucide/svelte/icons/user';
  import Copy from '@lucide/svelte/icons/copy';
  import Printer from '@lucide/svelte/icons/printer';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import FocusSplit from './FocusSplit.svelte';
  import PasswordField from './PasswordField.svelte';
  import { friendlyError } from './errors';
  import { auth } from '$lib/stores/auth.svelte';
  import { platform, printPage } from '$lib/services/platform';

  const STEPS = [
    { title: 'Administrator Account', sub: 'Name and password' },
    { title: 'Recovery Key', sub: 'Save or print it' },
    { title: 'Confirm & Finish', sub: 'Then add your first student' },
  ];

  let step = $state(0);
  let name = $state('');
  let password = $state('');
  let confirm = $state('');
  let error = $state('');
  let busy = $state(false);
  let recoveryKey = $state('');
  let saved = $state(false);
  let copied = $state(false);

  const longEnough = $derived(password.length >= 8);
  const matches = $derived(password.length > 0 && password === confirm);
  const canCreate = $derived(name.trim().length > 0 && longEnough && matches && !busy);

  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (!canCreate) return;
    busy = true;
    error = '';
    try {
      recoveryKey = await auth.setupAdmin(name.trim(), password);
      password = confirm = '';
      step = 1;
    } catch (err) {
      error = friendlyError(err);
    } finally {
      busy = false;
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      copied = true;
    } catch {
      copied = false;
    }
  }
</script>

<FocusSplit>
  {#snippet panel()}
    <img class="logo" src="/branding/pickworks-logo.png" alt="PickWorks Studio" />
    <div class="tag">Guitar Learning System</div>
    <ol class="steps" aria-label="Setup steps">
      {#each STEPS as s, i}
        <li class:on={i === step} class:done={i < step} aria-current={i === step ? 'step' : undefined}>
          <span class="n">{#if i < step}<Check size={18} />{:else}{i + 1}{/if}</span>
          <span><b>{s.title}</b><small>{s.sub}</small></span>
        </li>
      {/each}
    </ol>
  {/snippet}

  <div class="eyebrow">First-time setup · Step {step + 1} of 3</div>
  <h1 class="h">First-Time Setup</h1>
  <p class="muted lead">Let's set up PickWorks Studio for your guitar learners.</p>

  {#if step === 0}
    <form class="glow-card form" onsubmit={create}>
      <h2><ShieldCheck size={22} /> Create Administrator Account</h2>
      <p class="muted sub">This account manages students, backups and passwords. Usually a parent or teacher.</p>

      <div class="pw-field">
        <label for="admin-name">Administrator name</label>
        <div class="pw-input">
          <User size={18} aria-hidden="true" />
          <input id="admin-name" bind:value={name} autocomplete="name" maxlength="60" />
        </div>
      </div>
      <PasswordField id="admin-pw" label="Password" hint="(minimum 8 characters)" autocomplete="new-password" bind:value={password} />
      <PasswordField id="admin-pw2" label="Confirm password" placeholder="Type the password again" autocomplete="new-password" bind:value={confirm} />
      <ul class="rules">
        <li class:ok={longEnough}><Check size={16} /> At least 8 characters</li>
        <li class:ok={matches}><Check size={16} /> Both passwords match</li>
      </ul>

      {#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}
      <div class="pw-note"><Info size={18} color="var(--pw-primary-hover)" /> <span>Everything stays on this computer. No internet or online account is needed.</span></div>

      <div class="actions">
        <button class="pw-btn primary" type="submit" disabled={!canCreate}>Next <ChevronRight size={18} /></button>
      </div>
    </form>
  {:else if step === 1}
    <section class="glow-card form print-key">
      <h2><KeyRound size={22} /> Your Recovery Key</h2>
      <p class="muted sub">If you ever forget the administrator password, this key lets you set a new one. It is shown only once.</p>
      <div class="key" aria-label="Recovery key">{recoveryKey}</div>
      <div class="key-actions no-print">
        <button class="pw-btn" type="button" onclick={copyKey}><Copy size={18} /> {copied ? 'Copied' : 'Copy'}</button>
        {#if platform.print !== 'none'}<button class="pw-btn" type="button" onclick={printPage}><Printer size={18} /> Print</button>{/if}
      </div>
      <div class="pw-note amber"><Info size={18} color="var(--pw-amber)" /> <span>Keep it somewhere safe and away from students, such as with your important papers. Anyone with this key can reset the administrator password.</span></div>
      <label class="check no-print"><input type="checkbox" bind:checked={saved} /> I have saved or printed my recovery key</label>
      <div class="actions no-print">
        <button class="pw-btn primary" type="button" disabled={!saved} onclick={() => (step = 2)}>Next <ChevronRight size={18} /></button>
      </div>
    </section>
  {:else}
    <section class="glow-card form">
      <h2><Check size={22} /> You're All Set</h2>
      <ul class="summary">
        <li><Check size={18} /> Administrator account created for <b>{name.trim()}</b></li>
        <li><Check size={18} /> Recovery key saved</li>
        <li><Check size={18} /> Students are signed out after 20 minutes without activity, and the administrator after 5. Work is saved first.</li>
      </ul>
      <p class="muted sub">Next, sign in as the administrator to add your first student.</p>
      <div class="actions">
        <button class="pw-btn primary" type="button" onclick={() => auth.showProfiles()}>Finish <ChevronRight size={18} /></button>
      </div>
    </section>
  {/if}
  <p class="copy">© PickWorks Studio, all rights reserved.</p>
</FocusSplit>

<style>
  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; width: 300px; }
  .steps li { display: flex; gap: 14px; align-items: center; padding: 10px 14px; border-radius: 999px; color: var(--pw-text-muted); }
  .steps li.on { background: rgba(35, 139, 235, 0.18); color: var(--pw-text); box-shadow: inset 0 0 0 1px rgba(67, 169, 255, 0.55); }
  .steps .n { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--pw-border-strong); background: rgba(11, 17, 25, 0.6); font-weight: 700; flex-shrink: 0; }
  .steps li.on .n { background: var(--pw-primary); border-color: var(--pw-primary-hover); color: #fff; box-shadow: 0 0 14px rgba(35, 139, 235, 0.6); }
  .steps li.done .n { color: var(--pw-primary-hover); border-color: rgba(67, 169, 255, 0.55); }
  .steps b { display: block; }
  .steps small { font-size: 0.82rem; }
  .h { font-size: 2.3rem; margin-top: 4px; }
  .lead { margin: 4px 0 20px; font-size: 1.1rem; }
  .form { max-width: 640px; padding: 24px 28px; display: flex; flex-direction: column; gap: 4px; }
  .form h2 { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; margin-bottom: 4px; }
  .form h2 :global(svg) { color: var(--pw-primary); }
  .sub { margin: 0 0 14px; font-size: 0.92rem; }
  .rules { list-style: none; margin: 0 0 12px; padding: 0; display: flex; gap: 22px; color: var(--pw-text-muted); font-size: 0.9rem; }
  .rules li { display: flex; align-items: center; gap: 6px; }
  .rules li.ok { color: var(--pw-success); }
  .pw-note { margin-top: 8px; }
  .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
  .copy { color: var(--pw-text-faint); font-size: 0.82rem; margin-top: 18px; }
  .key { font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; font-size: 1.6rem; letter-spacing: 0.08em; text-align: center; padding: 18px; border-radius: var(--pw-radius); background: var(--pw-bg-raised); border: 1px solid var(--pw-border-strong); user-select: all; }
  .key-actions { display: flex; gap: 10px; justify-content: center; margin: 14px 0 6px; }
  .check { display: flex; gap: 10px; align-items: center; margin-top: 16px; cursor: pointer; }
  .check input { width: 18px; height: 18px; accent-color: var(--pw-primary); }
  .summary { list-style: none; padding: 0; margin: 4px 0 14px; display: flex; flex-direction: column; gap: 10px; }
  .summary li { display: flex; gap: 10px; align-items: flex-start; }
  .summary :global(svg) { color: var(--pw-success); flex-shrink: 0; margin-top: 2px; }

  @media print {
    :global(body *) { visibility: hidden; }
    .print-key, .print-key :global(*) { visibility: visible; }
    .print-key { position: absolute; inset: 0 auto auto 0; background: #fff; color: #000; box-shadow: none; border: 0; }
    .print-key .key { background: #fff; border-color: #000; }
    .print-key, .print-key :global(*) { color: #000 !important; }
    .no-print { display: none !important; }
  }
</style>

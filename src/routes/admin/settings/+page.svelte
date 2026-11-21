<script lang="ts">
  import Settings from '@lucide/svelte/icons/settings';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import Wrench from '@lucide/svelte/icons/wrench';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Lock from '@lucide/svelte/icons/lock';
  import Copy from '@lucide/svelte/icons/copy';
  import Printer from '@lucide/svelte/icons/printer';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import PageHead from '$lib/components/admin/PageHead.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import PasswordField from '$lib/components/account/PasswordField.svelte';
  import { friendlyError } from '$lib/components/account/errors';
  import { admin } from '$lib/stores/admin.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { backend } from '$lib/services/backend';
  import type { StudentAdminView } from '$lib/services/core-client';

  let dialog = $state<'password' | 'key' | { delete: StudentAdminView } | null>(null);
  let current = $state('');
  let next = $state('');
  let confirm = $state('');
  let typedName = $state('');
  let error = $state('');
  let done = $state('');
  let busy = $state(false);
  let newKey = $state('');

  $effect(() => {
    admin.loadStudents().catch((e) => (error = friendlyError(e)));
  });
  const archived = $derived(admin.students.filter((s) => s.status === 'archived'));

  function open(d: typeof dialog) {
    dialog = d;
    current = next = confirm = typedName = error = newKey = '';
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const d = dialog;
    busy = true;
    error = '';
    try {
      if (d === 'password') {
        await backend.changePassword(auth.info!.token, current, next);
        done = 'Administrator password changed.';
        dialog = null;
      } else if (d === 'key') {
        newKey = await backend.adminNewRecoveryKey(auth.info!.token, current);
        current = '';
      } else if (d) {
        await admin.act((t) => backend.adminDeleteStudent(t, d.delete.id, typedName));
        done = `${d.delete.displayName} was permanently deleted.`;
        dialog = null;
      }
    } catch (err) {
      error = friendlyError(err);
    } finally {
      busy = false;
    }
  }
</script>

<PageHead title="Settings" subtitle="Administrator password, recovery key and maintenance." icon={Settings} />

{#if done}<div class="pw-note ok" role="status"><CircleCheck size={18} /> <span>{done}</span></div>{/if}

<div class="grid">
  <section class="glow-card">
    <h2><Lock size={22} /> Administrator Password</h2>
    <p class="muted">Signs you in to this administration area. The administrator is signed out after 5 minutes without activity.</p>
    <button class="pw-btn" onclick={() => open('password')}>Change Password</button>
  </section>
  <section class="glow-card">
    <h2><KeyRound size={22} /> Recovery Key</h2>
    <p class="muted">Lets you reset the administrator password if you forget it. Making a new key stops the old one working.</p>
    <button class="pw-btn" onclick={() => open('key')}>Create New Recovery Key</button>
  </section>
</div>

<section class="glow-card maint">
  <h2><Wrench size={22} /> Maintenance</h2>
  <p class="muted">Permanently delete an archived student and all of their records. This can't be undone; existing backups are kept.</p>
  {#if archived.length}
    <ul>
      {#each archived as s (s.id)}
        <li><span>{s.displayName}</span><button class="pw-btn warn" onclick={() => open({ delete: s })}><Trash2 size={16} /> Delete Permanently</button></li>
      {/each}
    </ul>
  {:else}
    <p class="muted small">No archived students. Archive a student in Student Management first.</p>
  {/if}
</section>

{#if dialog}
  <Dialog title={dialog === 'password' ? 'Change Administrator Password' : dialog === 'key' ? 'New Recovery Key' : `Delete ${dialog.delete.displayName} Permanently`} onclose={() => (dialog = null)}>
    {#if dialog === 'key' && newKey}
      <div class="print-key">
        <p>Your new recovery key. It is shown only once; the old key no longer works.</p>
        <div class="key">{newKey}</div>
      </div>
      <div class="dlg-actions">
        <button class="pw-btn" onclick={() => navigator.clipboard.writeText(newKey).catch(() => {})}><Copy size={16} /> Copy</button>
        <button class="pw-btn" onclick={() => window.print()}><Printer size={16} /> Print</button>
        <button class="pw-btn primary" onclick={() => (dialog = null)}>Done</button>
      </div>
    {:else}
      <form onsubmit={submit}>
        {#if dialog === 'password'}
          <PasswordField id="cur" label="Current password" bind:value={current} />
          <PasswordField id="np" label="New password" hint="(minimum 8 characters)" autocomplete="new-password" bind:value={next} />
          <PasswordField id="np2" label="Confirm new password" autocomplete="new-password" bind:value={confirm} />
        {:else if dialog === 'key'}
          <PasswordField id="cur" label="Administrator password" bind:value={current} />
        {:else}
          <p>All of {dialog.delete.displayName}'s progress, mastery and history will be removed from this computer. Type <b>{dialog.delete.displayName}</b> to confirm.</p>
          <div class="pw-field"><div class="pw-input"><input bind:value={typedName} aria-label="Type the student's name to confirm" autocomplete="off" /></div></div>
        {/if}
        {#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}
        <div class="dlg-actions">
          <button class="pw-btn" type="button" onclick={() => (dialog = null)}>Cancel</button>
          {#if dialog === 'password'}
            <button class="pw-btn primary" type="submit" disabled={busy || !current || next.length < 8 || next !== confirm}>Change Password</button>
          {:else if dialog === 'key'}
            <button class="pw-btn primary" type="submit" disabled={busy || !current}>Create Key</button>
          {:else}
            <button class="pw-btn warn" type="submit" disabled={busy || typedName.trim() !== dialog.delete.displayName}>Delete Permanently</button>
          {/if}
        </div>
      </form>
    {/if}
  </Dialog>
{/if}

<style>
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  h2 { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; margin-bottom: 6px; }
  h2 :global(svg) { color: var(--pw-primary); }
  section p { margin: 0 0 14px; }
  .maint { margin-top: 18px; }
  .maint h2 :global(svg) { color: var(--pw-amber); }
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid var(--pw-border); }
  .small { font-size: 0.9rem; }
  .pw-note { margin-bottom: 16px; }
  .pw-note.ok { background: rgba(63, 178, 127, 0.12); border-color: rgba(63, 178, 127, 0.5); }
  .dlg-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
  .key { font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; font-size: 1.4rem; letter-spacing: 0.08em; text-align: center; padding: 16px; border-radius: var(--pw-radius); background: var(--pw-bg-raised); border: 1px solid var(--pw-border-strong); user-select: all; }
  @media print {
    :global(body *) { visibility: hidden; }
    .print-key, .print-key :global(*) { visibility: visible; color: #000 !important; }
    .print-key { position: absolute; inset: 0 auto auto 0; }
    .print-key .key { background: #fff; border-color: #000; }
  }
  @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
</style>

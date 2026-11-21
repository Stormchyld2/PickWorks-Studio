<script lang="ts">
  import DatabaseBackup from '@lucide/svelte/icons/database-backup';
  import HardDrive from '@lucide/svelte/icons/hard-drive';
  import User from '@lucide/svelte/icons/user';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Info from '@lucide/svelte/icons/info';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import PageHead from '$lib/components/admin/PageHead.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import PasswordField from '$lib/components/account/PasswordField.svelte';
  import { friendlyError } from '$lib/components/account/errors';
  import { formatSize, formatWhen } from '$lib/components/admin/format';
  import { admin } from '$lib/stores/admin.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { backend } from '$lib/services/backend';
  import type { BackupInfo } from '$lib/services/core-client';

  let studentId = $state('');
  let message = $state('');
  let error = $state('');
  let busy = $state(false);
  let restoring = $state<BackupInfo | null>(null);
  let password = $state('');
  let restoreError = $state('');

  $effect(() => {
    Promise.all([admin.loadStudents(), admin.loadBackups()]).catch((e) => (error = friendlyError(e)));
  });

  async function run(fn: () => Promise<string>, done: string) {
    busy = true;
    error = message = '';
    try {
      await fn();
      message = done;
    } catch (e) {
      error = friendlyError(e);
    } finally {
      busy = false;
    }
  }

  async function restore(e: SubmitEvent) {
    e.preventDefault();
    const b = restoring;
    if (!b) return;
    busy = true;
    restoreError = '';
    try {
      if (b.kind === 'installation') {
        await admin.act((t) => backend.adminRestoreInstallation(t, b.name, password), []);
        // The restored data may have different passwords: sign in again.
        await auth.signOut('switch');
        return;
      }
      await admin.act((t) => backend.adminRestoreStudent(t, b.name, password), ['backups']);
      message = `${b.studentName}'s records were restored. Their current records were saved as a backup first.`;
      restoring = null;
    } catch (err) {
      restoreError = friendlyError(err);
    } finally {
      busy = false;
      password = '';
    }
  }

  const label = (b: BackupInfo) => (b.kind === 'installation' ? 'Everything' : (b.studentName ?? 'Student'));
</script>

<PageHead title="Backups & Restore" subtitle="Keep copies of student records and the whole installation." icon={DatabaseBackup} />

<div class="grid">
  <section class="glow-card">
    <h2><HardDrive size={22} /> Back Up Everything</h2>
    <p class="muted">All students, their records, settings and accounts (passwords are stored only as secure hashes).</p>
    <button class="pw-btn primary" disabled={busy} onclick={() => run(() => admin.act((t) => backend.adminBackupInstallation(t), ['backups']), 'Everything was backed up.')}>Back Up Now</button>
  </section>
  <section class="glow-card">
    <h2><User size={22} /> Back Up One Student</h2>
    <p class="muted">Just that student's records. Restoring it never brings back an old password.</p>
    <div class="row">
      <select class="pw-select" bind:value={studentId} aria-label="Student to back up">
        <option value="" disabled>Choose a student</option>
        {#each admin.students as s (s.id)}<option value={s.id}>{s.displayName}</option>{/each}
      </select>
      <button class="pw-btn primary" disabled={busy || !studentId} onclick={() => run(() => admin.act((t) => backend.adminBackupStudent(t, studentId), ['backups']), 'The student was backed up.')}>Back Up</button>
    </div>
  </section>
</div>

{#if message}<div class="pw-note ok" role="status"><CircleCheck size={18} /> <span>{message}</span></div>{/if}
{#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}

<section class="glow-card list">
  <h2>Saved Backups</h2>
  {#if admin.backups.length}
    <table>
      <thead><tr><th>Backup</th><th>Made</th><th>Size</th><th class="r">Restore</th></tr></thead>
      <tbody>
        {#each admin.backups as b (b.name)}
          <tr>
            <td><b>{label(b)}</b>{#if b.reason === 'before-restore'} <span class="pw-pill">Saved before a restore</span>{/if}</td>
            <td class="muted">{formatWhen(b.createdMs)}</td>
            <td class="muted">{formatSize(b.sizeBytes)}</td>
            <td class="r"><button class="pw-btn" onclick={() => ((restoring = b), (restoreError = ''), (password = ''))}><RotateCcw size={16} /> Restore</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="muted">No backups yet.</p>
  {/if}
  <div class="pw-note">
    <Info size={18} color="var(--pw-primary-hover)" />
    <span>Backups are kept in the PickWorks Studio data folder on this computer. Every restore saves the current data as a backup first, and is written to the Audit Log.</span>
  </div>
</section>

{#if restoring}
  <Dialog title={restoring.kind === 'installation' ? 'Restore Everything' : `Restore ${restoring.studentName}`} onclose={() => (restoring = null)}>
    <form onsubmit={restore}>
      <p>
        {#if restoring.kind === 'installation'}
          This replaces all students, records, settings and passwords with the copy from <b>{formatWhen(restoring.createdMs)}</b>. Passwords go back to what they were then. You'll be signed out afterwards.
        {:else}
          This replaces {restoring.studentName}'s records with the copy from <b>{formatWhen(restoring.createdMs)}</b>. Their password does not change.
        {/if}
      </p>
      <PasswordField id="admin-confirm" label="Administrator password" bind:value={password} />
      {#if restoreError}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{restoreError}</span></div>{/if}
      <div class="dlg-actions">
        <button class="pw-btn" type="button" onclick={() => (restoring = null)}>Cancel</button>
        <button class="pw-btn warn" type="submit" disabled={busy || !password}>Restore</button>
      </div>
    </form>
  </Dialog>
{/if}

<style>
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
  h2 { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; margin-bottom: 6px; }
  h2 :global(svg) { color: var(--pw-primary); }
  section p { margin: 0 0 14px; }
  .row { display: flex; gap: 10px; }
  .pw-select { flex: 1; background: var(--pw-bg-raised); color: var(--pw-text); border: 1px solid var(--pw-border-strong); border-radius: var(--pw-radius-sm); padding: 10px 12px; font: inherit; }
  .list { margin-top: 18px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pw-text-muted); font-weight: 600; padding: 0 10px 10px; border-bottom: 1px solid var(--pw-border); }
  td { padding: 10px; border-bottom: 1px solid var(--pw-border); }
  .r { text-align: right; }
  .pw-note { margin-top: 16px; }
  .pw-note.ok { background: rgba(63, 178, 127, 0.12); border-color: rgba(63, 178, 127, 0.5); }
  .dlg-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
  @media (max-width: 1100px) { .grid { grid-template-columns: 1fr; } }
</style>

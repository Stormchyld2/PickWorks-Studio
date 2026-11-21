<script lang="ts">
  import Users from '@lucide/svelte/icons/users';
  import UserPlus from '@lucide/svelte/icons/user-plus';
  import Pencil from '@lucide/svelte/icons/pencil';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import LockOpen from '@lucide/svelte/icons/lock-open';
  import Archive from '@lucide/svelte/icons/archive';
  import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
  import Camera from '@lucide/svelte/icons/camera';
  import Info from '@lucide/svelte/icons/info';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import PageHead from '$lib/components/admin/PageHead.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Avatar from '$lib/components/account/Avatar.svelte';
  import PasswordField from '$lib/components/account/PasswordField.svelte';
  import { friendlyError } from '$lib/components/account/errors';
  import { formatDate, toAvatarDataUrl } from '$lib/components/admin/format';
  import { admin } from '$lib/stores/admin.svelte';
  import { backend } from '$lib/services/backend';
  import type { StudentAdminView } from '$lib/services/core-client';

  type Mode = { kind: 'add' } | { kind: 'rename' | 'reset' | 'picture'; s: StudentAdminView } | null;
  let mode = $state<Mode>(null);
  let name = $state('');
  let temp = $state('');
  let error = $state('');
  let busy = $state(false);
  let loadError = $state('');
  let picture = $state<string | null>(null);

  $effect(() => {
    admin.loadStudents().catch((e) => (loadError = friendlyError(e)));
  });

  function open(m: NonNullable<Mode>) {
    mode = m;
    error = '';
    temp = '';
    picture = null;
    name = m.kind === 'add' ? '' : m.s.displayName;
  }

  async function run(fn: () => Promise<unknown>) {
    busy = true;
    error = '';
    try {
      await fn();
      mode = null;
    } catch (e) {
      error = friendlyError(e);
    } finally {
      busy = false;
    }
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const m = mode;
    if (!m) return;
    if (m.kind === 'add') return run(() => admin.act((t) => backend.adminCreateStudent(t, name, temp)));
    if (m.kind === 'rename') return run(() => admin.act((t) => backend.adminRenameStudent(t, m.s.id, name)));
    if (m.kind === 'reset') return run(() => admin.act((t) => backend.adminResetPassword(t, m.s.id, temp)));
    return run(() => admin.act((t) => backend.adminSetAvatar(t, m.s.id, picture)));
  }

  async function choosePicture(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      picture = await toAvatarDataUrl(file);
      error = '';
    } catch (err) {
      error = friendlyError(err);
    }
  }

  const quick = (fn: (t: string) => Promise<unknown>) => admin.act(fn).catch((e) => (loadError = friendlyError(e)));

  function status(s: StudentAdminView): { label: string; cls: string } {
    if (s.status === 'archived') return { label: 'Archived', cls: '' };
    if (s.status === 'deactivated') return { label: 'Deactivated', cls: '' };
    if (s.lockedForSecs > 0) return { label: 'Locked', cls: 'amber' };
    if (s.mustChangePassword) return { label: 'New password needed', cls: 'blue' };
    return { label: 'Active', cls: 'ok' };
  }
</script>

<PageHead title="Student Management" subtitle="Create, rename, reset passwords, unlock and archive student accounts." icon={Users}>
  {#snippet actions()}
    <button class="pw-btn primary" onclick={() => open({ kind: 'add' })}><UserPlus size={18} /> Add Student</button>
  {/snippet}
</PageHead>

<section class="glow-card">
  {#if loadError}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{loadError}</span></div>{/if}
  {#if admin.students.length}
    <table>
      <thead><tr><th>Student</th><th>Status</th><th>Added</th><th class="r">Actions</th></tr></thead>
      <tbody>
        {#each admin.students as s (s.id)}
          {@const st = status(s)}
          <tr class:dim={s.status !== 'active'}>
            <td><span class="who"><Avatar src={admin.avatars[s.id]} size={40} /> <b>{s.displayName}</b></span></td>
            <td><span class="pw-pill {st.cls}">{st.label}</span></td>
            <td class="muted">{formatDate(s.createdMs)}</td>
            <td class="r">
              <span class="acts">
                {#if s.status === 'archived' || s.status === 'deactivated'}
                  <button class="icon" title="Restore {s.displayName}" aria-label="Restore {s.displayName}" onclick={() => quick((t) => backend.adminSetStatus(t, s.id, 'active'))}><ArchiveRestore size={18} /></button>
                {:else}
                  <button class="icon" title="Rename" aria-label="Rename {s.displayName}" onclick={() => open({ kind: 'rename', s })}><Pencil size={18} /></button>
                  <button class="icon" title="Profile picture" aria-label="Profile picture for {s.displayName}" onclick={() => open({ kind: 'picture', s })}><Camera size={18} /></button>
                  <button class="icon" title="Reset password" aria-label="Reset password for {s.displayName}" onclick={() => open({ kind: 'reset', s })}><KeyRound size={18} /></button>
                  {#if s.lockedForSecs > 0}
                    <button class="icon amber" title="Clear sign-in delay" aria-label="Clear sign-in delay for {s.displayName}" onclick={() => quick((t) => backend.adminUnlock(t, s.id))}><LockOpen size={18} /></button>
                  {/if}
                  <button class="icon" title="Archive" aria-label="Archive {s.displayName}" onclick={() => quick((t) => backend.adminSetStatus(t, s.id, 'archived'))}><Archive size={18} /></button>
                {/if}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if !loadError}
    <p class="muted empty">No students yet. Add your first student to get started.</p>
  {/if}
  <div class="pw-note">
    <Info size={18} color="var(--pw-primary-hover)" />
    <span>Archiving hides a student from the profile screen and keeps all their records. Password resets never change progress, mastery or history. Permanent deletion is under Settings › Maintenance and asks for confirmation. Every change here is written to the Audit Log.</span>
  </div>
</section>

{#if mode}
  <Dialog
    title={mode.kind === 'add' ? 'Add Student' : mode.kind === 'rename' ? `Rename ${mode.s.displayName}` : mode.kind === 'reset' ? `Reset Password for ${mode.s.displayName}` : `Profile Picture for ${mode.s.displayName}`}
    onclose={() => (mode = null)}
  >
    <form onsubmit={submit}>
      {#if mode.kind === 'add' || mode.kind === 'rename'}
        <div class="pw-field">
          <label for="sname">Name shown on the profile screen</label>
          <div class="pw-input"><input id="sname" bind:value={name} maxlength="60" autocomplete="off" /></div>
        </div>
      {/if}
      {#if mode.kind === 'add' || mode.kind === 'reset'}
        <PasswordField id="temp" label="Temporary password" hint="(minimum 8 characters)" autocomplete="new-password" bind:value={temp} />
        <p class="muted small">Give this to the student. They choose their own password the first time they sign in.{mode.kind === 'reset' ? ' Their progress and history are kept.' : ''}</p>
      {/if}
      {#if mode.kind === 'picture'}
        <div class="pic">
          <Avatar src={picture ?? admin.avatars[mode.s.id]} size={120} />
          <div class="pic-actions">
            <label class="pw-btn"><Camera size={18} /> Choose Picture<input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onchange={choosePicture} /></label>
            {#if admin.avatars[mode.s.id]}<button class="pw-btn ghost" type="button" onclick={() => mode?.kind === 'picture' && run(() => admin.act((t) => backend.adminSetAvatar(t, (mode as { s: StudentAdminView }).s.id, null)))}>Remove Picture</button>{/if}
          </div>
        </div>
        <p class="muted small">Pictures are resized to a small square and stay on this computer.</p>
      {/if}
      {#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}
      <div class="dlg-actions">
        <button class="pw-btn" type="button" onclick={() => (mode = null)}>Cancel</button>
        <button
          class="pw-btn primary"
          type="submit"
          disabled={busy ||
            ((mode.kind === 'add' || mode.kind === 'rename') && !name.trim()) ||
            ((mode.kind === 'add' || mode.kind === 'reset') && temp.length < 8) ||
            (mode.kind === 'picture' && !picture)}
        >
          {mode.kind === 'add' ? 'Add Student' : mode.kind === 'reset' ? 'Reset Password' : 'Save'}
        </button>
      </div>
    </form>
  </Dialog>
{/if}

<style>
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pw-text-muted); font-weight: 600; padding: 0 10px 10px; border-bottom: 1px solid var(--pw-border); }
  td { padding: 12px 10px; border-bottom: 1px solid var(--pw-border); }
  .r { text-align: right; }
  .who { display: inline-flex; align-items: center; gap: 12px; }
  .who :global(.avatar) { box-shadow: 0 0 0 2px rgba(67, 169, 255, 0.45); }
  tr.dim td { color: var(--pw-text-muted); }
  .acts { display: inline-flex; gap: 8px; }
  .icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: var(--pw-radius-sm); border: 1px solid var(--pw-primary-hover); background: rgba(35, 139, 235, 0.18); color: var(--pw-primary-hover); cursor: pointer; }
  .icon:hover { background: var(--pw-primary); color: #fff; }
  .icon.amber { border-color: var(--pw-amber); background: var(--pw-amber); color: var(--pw-bg); }
  .pw-pill.ok { color: #fff; background: #2f9d6c; border-color: var(--pw-success); }
  .pw-note { margin-top: 18px; }
  .empty { padding: 12px 0; }
  .small { font-size: 0.88rem; margin: 0 0 12px; }
  .dlg-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
  .pic { display: flex; align-items: center; gap: 20px; margin-bottom: 12px; }
  .pic-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  label.pw-btn { cursor: pointer; }
</style>

<script lang="ts">
  import Settings from '@lucide/svelte/icons/settings';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import Wrench from '@lucide/svelte/icons/wrench';
  import UserPlus from '@lucide/svelte/icons/user-plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Lock from '@lucide/svelte/icons/lock';
  import Copy from '@lucide/svelte/icons/copy';
  import Printer from '@lucide/svelte/icons/printer';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import PageHead from '$lib/components/admin/PageHead.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import PasswordField from '$lib/components/account/PasswordField.svelte';
  import { friendlyError } from '$lib/components/account/errors';
  import { admin } from '$lib/stores/admin.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { backend } from '$lib/services/backend';
  import { platform, printPage } from '$lib/services/platform';
  import type { StudentAdminView, WorkspaceAccessSettings } from '$lib/services/core-client';
  import { DEFAULT_WORKSPACE, WORKSPACES } from '$lib/engines/workspaces/config';
  import { isWholePercent } from '$lib/engines/workspaces/access';

  let dialog = $state<'password' | 'key' | { delete: StudentAdminView } | null>(null);
  let current = $state('');
  let next = $state('');
  let confirm = $state('');
  let typedName = $state('');
  let error = $state('');
  let done = $state('');
  let busy = $state(false);
  let newKey = $state('');

  let selfRegistration = $state(true);
  let regError = $state('');

  $effect(() => {
    admin.loadStudents().catch((e) => (error = friendlyError(e)));
    backend.selfRegistrationEnabled().then((v) => (selfRegistration = v));
  });

  async function setSelfRegistration(e: Event) {
    const enabled = (e.currentTarget as HTMLInputElement).checked;
    regError = '';
    try {
      await admin.act((t) => backend.adminSetSelfRegistration(t, enabled), []);
      selfRegistration = enabled;
    } catch (err) {
      regError = friendlyError(err);
      (e.currentTarget as HTMLInputElement).checked = selfRegistration;
    }
  }
  // Workspace Access (approved mockups 8 and 9). Each change is saved and audited by the native core.
  let wsSettings = $state<WorkspaceAccessSettings | null>(null);
  let wsError = $state('');
  $effect(() => {
    admin
      .act((t) => backend.adminWorkspaceSettings(t), [])
      .then((v) => (wsSettings = v))
      .catch((e) => (wsError = friendlyError(e)));
  });
  async function saveWorkspaceAccess(change: (s: WorkspaceAccessSettings) => void, input: HTMLInputElement) {
    if (!wsSettings) return;
    const next = $state.snapshot(wsSettings) as WorkspaceAccessSettings;
    change(next);
    wsError = '';
    try {
      await admin.act((t) => backend.adminSetWorkspaceSettings(t, next), []);
      wsSettings = next;
    } catch (err) {
      wsError = friendlyError(err);
      input.checked = !input.checked;
    }
  }
  // Editable unlock thresholds: whole percentages 0 to 100, saved together with Save.
  let beginnerPct = $state('');
  let intermediatePct = $state('');
  let thresholdsSaved = $state(false);
  $effect(() => {
    if (wsSettings && beginnerPct === '' && intermediatePct === '') {
      beginnerPct = String(wsSettings.beginnerLessonsPercent);
      intermediatePct = String(wsSettings.intermediateLessonsPercent);
    }
  });
  const pctValid = isWholePercent;
  const thresholdsValid = $derived(pctValid(beginnerPct) && pctValid(intermediatePct));
  const thresholdsChanged = $derived(
    !!wsSettings && thresholdsValid && (Number(beginnerPct) !== wsSettings.beginnerLessonsPercent || Number(intermediatePct) !== wsSettings.intermediateLessonsPercent),
  );
  async function saveThresholds(e: SubmitEvent) {
    e.preventDefault();
    if (!wsSettings || !thresholdsValid) return;
    const next = { ...($state.snapshot(wsSettings) as WorkspaceAccessSettings), beginnerLessonsPercent: Number(beginnerPct), intermediateLessonsPercent: Number(intermediatePct) };
    wsError = '';
    thresholdsSaved = false;
    try {
      await admin.act((t) => backend.adminSetWorkspaceSettings(t, next), []);
      wsSettings = next;
      thresholdsSaved = true;
    } catch (err) {
      wsError = friendlyError(err);
    }
  }
  function resetThresholds() {
    beginnerPct = '80';
    intermediatePct = '50';
    thresholdsSaved = false;
  }

  function toggleNewProfile(id: string, on: boolean) {
    return (s: WorkspaceAccessSettings) => {
      s.newProfileWorkspaces = on ? [...s.newProfileWorkspaces.filter((x) => x !== id), id] : s.newProfileWorkspaces.filter((x) => x !== id);
    };
  }

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

<section class="glow-card reg">
  <h2><UserPlus size={22} /> Student Profiles</h2>
  <label class="toggle">
    <input type="checkbox" checked={selfRegistration} onchange={setSelfRegistration} />
    <span><b>Let students create their own profiles</b><br /><span class="muted">Shows "Create Student Profile" on the profile screen. Students choose their own name, picture and password, and always get a student account, never administrator access. You can still add, rename, reset, archive and delete students here as usual.</span></span>
  </label>
  {#if regError}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{regError}</span></div>{/if}
</section>

<section class="glow-card reg">
  <h2><LayoutGrid size={22} /> Workspace Access</h2>
  <p class="muted">Decides which workspaces students can open. These settings never change XP, lessons, mastery or any learning record, and never give a student administrator access. Workspaces that aren't built yet stay unavailable whatever is set here.</p>
  {#if wsSettings}
    {@const ws = wsSettings}
    <div class="wsa">
      <div>
        <h3>All students</h3>
        <label class="toggle"><input type="checkbox" checked={ws.unlockAll} onchange={(e) => saveWorkspaceAccess((s) => (s.unlockAll = e.currentTarget.checked), e.currentTarget)} /><span><b>Unlock All Workspaces for Students</b><br /><span class="muted">Opens every finished workspace for every student now.</span></span></label>
        <label class="toggle"><input type="checkbox" checked={ws.automaticLearningUnlock} onchange={(e) => saveWorkspaceAccess((s) => (s.automaticLearningUnlock = e.currentTarget.checked), e.currentTarget)} /><span><b>Automatic Learning Unlock</b><br /><span class="muted">Opens the other workspaces for a student who has covered {ws.beginnerLessonsPercent}% of Beginner lessons and {ws.intermediateLessonsPercent}% of Intermediate lessons, by completing them or through placement.</span></span></label>
        <form class="thr" onsubmit={saveThresholds} aria-labelledby="thr-h">
          <h4 id="thr-h">Unlock thresholds</h4>
          <div class="thr-row">
            <label for="thr-b">Beginner lessons covered</label>
            <span class="pct"><input id="thr-b" type="number" inputmode="numeric" min="0" max="100" step="1" value={beginnerPct} oninput={(e) => ((beginnerPct = e.currentTarget.value), (thresholdsSaved = false))} aria-invalid={!pctValid(beginnerPct)} aria-describedby="thr-help" />%</span>
          </div>
          <div class="thr-row">
            <label for="thr-i">Intermediate lessons covered</label>
            <span class="pct"><input id="thr-i" type="number" inputmode="numeric" min="0" max="100" step="1" value={intermediatePct} oninput={(e) => ((intermediatePct = e.currentTarget.value), (thresholdsSaved = false))} aria-invalid={!pctValid(intermediatePct)} aria-describedby="thr-help" />%</span>
          </div>
          <p id="thr-help" class="muted small">Whole numbers from 0 to 100. Defaults: 80% and 50%. Changes apply to every student at once, counted from the lessons each has covered. They never change lessons, placement, XP or mastery. Until the lesson system arrives with Phase 2, no student can reach these thresholds, so changing them has no effect yet.</p>
          {#if !thresholdsValid}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>Enter a whole number from 0 to 100 for each threshold.</span></div>{/if}
          {#if thresholdsSaved && !thresholdsChanged}<div class="pw-note ok" role="status"><CircleCheck size={18} /> <span>Thresholds saved. The change is in the Audit Log.</span></div>{/if}
          <div class="thr-actions">
            <button type="button" class="pw-btn" onclick={resetThresholds}>Use Defaults</button>
            <button type="submit" class="pw-btn primary" disabled={!thresholdsChanged}>Save Thresholds</button>
          </div>
        </form>
      </div>
      <div>
        <h3>New student profiles start with</h3>
        <ul class="wsl">
          {#each WORKSPACES as w (w.id)}
            {#if w.id === DEFAULT_WORKSPACE}
              <li><span><b>{w.name}</b><small>Always available</small></span><input type="checkbox" checked disabled aria-label="{w.name}, always available" /></li>
            {:else if w.implemented}
              <li><span><b>{w.name}</b><small>Unlocked from the start</small></span><input type="checkbox" checked={ws.newProfileWorkspaces.includes(w.id)} aria-label="{w.name} unlocked for new profiles" onchange={(e) => saveWorkspaceAccess(toggleNewProfile(w.id, e.currentTarget.checked), e.currentTarget)} /></li>
            {:else}
              <li class="na"><span><b>{w.name}</b><small>Not available yet</small></span></li>
            {/if}
          {/each}
        </ul>
        <p class="muted small">Applies to profiles created after you change it. To open a workspace for one student, use Student Management.</p>
      </div>
    </div>
  {/if}
  {#if wsError}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{wsError}</span></div>{/if}
</section>

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
        {#if platform.print !== 'none'}<button class="pw-btn" onclick={printPage}><Printer size={16} /> Print</button>{/if}
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
  .maint, .reg { margin-top: 18px; }
  .toggle { display: flex; gap: 12px; align-items: flex-start; cursor: pointer; }
  .toggle input { width: 20px; height: 20px; margin-top: 2px; accent-color: var(--pw-primary); flex: none; }
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
  @media (max-width: 839.98px) { .grid { grid-template-columns: 1fr; } }
  .wsa { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 10px; }
  .wsa h3 { font-size: 1.02rem; margin: 0 0 8px; }
  .wsa .toggle { margin-bottom: 10px; }
  .wsl { list-style: none; padding: 0; margin: 0 0 10px; display: flex; flex-direction: column; gap: 8px; }
  .wsl li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border: 1px solid var(--pw-border-strong); border-radius: 12px; background: var(--pw-bg-raised); }
  .wsl li span { display: flex; flex-direction: column; gap: 2px; }
  .wsl small { color: var(--pw-text-muted); font-size: 0.85rem; }
  .wsl li.na { opacity: 0.7; border-style: dashed; }
  .wsl input { width: 22px; height: 22px; accent-color: var(--pw-primary); }
  .thr { margin: 6px 0 0 32px; padding: 14px 16px; border: 1px solid var(--pw-border-strong); border-radius: 12px; background: var(--pw-bg-raised); }
  .thr h4 { margin: 0 0 8px; font-size: 0.98rem; }
  .thr-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 6px 0; }
  .pct { display: inline-flex; align-items: center; gap: 6px; }
  .pct input { width: 76px; padding: 8px 10px; border-radius: var(--pw-radius-sm); border: 1px solid var(--pw-border-strong); background: var(--pw-surface); color: var(--pw-text); font: inherit; text-align: right; }
  .pct input[aria-invalid='true'] { border-color: var(--pw-amber); }
  .thr-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
  @media (max-width: 839.98px) { .thr { margin-left: 0; } .wsa { grid-template-columns: 1fr; } }
</style>

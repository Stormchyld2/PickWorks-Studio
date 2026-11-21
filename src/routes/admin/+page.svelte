<script lang="ts">
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Users from '@lucide/svelte/icons/users';
  import DatabaseBackup from '@lucide/svelte/icons/database-backup';
  import ScrollText from '@lucide/svelte/icons/scroll-text';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import PageHead from '$lib/components/admin/PageHead.svelte';
  import { friendlyError } from '$lib/components/account/errors';
  import { describeAction, formatWhen } from '$lib/components/admin/format';
  import { admin } from '$lib/stores/admin.svelte';

  let error = $state('');
  $effect(() => {
    Promise.all([admin.loadStudents(), admin.loadBackups(), admin.loadAudit(8)]).catch((e) => (error = friendlyError(e)));
  });

  const active = $derived(admin.students.filter((s) => s.status === 'active').length);
  const needsHelp = $derived(admin.students.filter((s) => s.status === 'active' && (s.lockedForSecs > 0 || s.mustChangePassword)).length);
  const lastFull = $derived(admin.backups.find((b) => b.kind === 'installation' && b.reason === 'manual'));
  const names = $derived(Object.fromEntries(admin.students.map((s) => [s.id, s.displayName])));
</script>

<PageHead title="Administration" subtitle="Manage students, passwords, backups and records for this computer." icon={ShieldCheck} />

{#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}

<div class="stats">
  <a class="glow-card stat" href="/admin/students">
    <span class="label"><Users size={18} /> Students</span>
    <strong>{active} active</strong>
    <span class="muted">{admin.students.length - active} archived or deactivated{needsHelp ? ` · ${needsHelp} need attention` : ''}</span>
  </a>
  <a class="glow-card stat" href="/admin/backups">
    <span class="label"><DatabaseBackup size={18} /> Last full backup</span>
    <strong class:warn={!lastFull}>{lastFull ? formatWhen(lastFull.createdMs) : 'None yet'}</strong>
    <span class="muted">{admin.backups.length} backups saved</span>
  </a>
</div>

<section class="glow-card">
  <div class="sec-head"><h2><ScrollText size={20} /> Recent Activity</h2><a href="/admin/audit">Full audit log</a></div>
  {#if admin.audit.length}
    <ul>
      {#each admin.audit as e, i (i)}
        <li><span>{describeAction(e.action)}{e.studentId && names[e.studentId] ? ` · ${names[e.studentId]}` : ''}</span><span class="muted">{formatWhen(e.atMs)}</span></li>
      {/each}
    </ul>
  {:else}
    <p class="muted">Nothing recorded yet.</p>
  {/if}
</section>

<style>
  .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; margin-bottom: 18px; }
  .stat { display: flex; flex-direction: column; gap: 4px; color: var(--pw-text); text-decoration: none; }
  .stat:hover { border-color: var(--pw-primary-hover); }
  .label { display: flex; align-items: center; gap: 8px; color: var(--pw-text-muted); }
  .label :global(svg) { color: var(--pw-primary); }
  strong { font-size: 1.4rem; }
  strong.warn { color: var(--pw-amber); }
  .sec-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  h2 { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; }
  h2 :global(svg) { color: var(--pw-primary); }
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-top: 1px solid var(--pw-border); }
  .pw-note { margin-bottom: 16px; }
</style>

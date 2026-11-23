<script lang="ts">
  import ScrollText from '@lucide/svelte/icons/scroll-text';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import PageHead from '$lib/components/admin/PageHead.svelte';
  import { friendlyError } from '$lib/components/account/errors';
  import { describeAction, formatWhen } from '$lib/components/admin/format';
  import { admin } from '$lib/stores/admin.svelte';

  let error = $state('');
  $effect(() => {
    Promise.all([admin.loadAudit(), admin.loadStudents()]).catch((e) => (error = friendlyError(e)));
  });
  const names = $derived(Object.fromEntries(admin.students.map((s) => [s.id, s.displayName])));
  const actor = (a: string) => (a === 'admin' ? 'Administrator' : a === 'windows-admin' ? 'Windows administrator' : a === 'recovery-key' ? 'Recovery key' : a);
</script>

<PageHead title="Audit Log" subtitle="Every administrator action on this computer, newest first. Entries can't be edited or removed." icon={ScrollText} />

<section class="glow-card">
  {#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}
  {#if admin.audit.length}
    <table>
      <thead><tr><th>When</th><th>Who</th><th>What</th><th>Student</th></tr></thead>
      <tbody>
        {#each admin.audit as e, i (i)}
          <tr>
            <td class="muted nowrap">{formatWhen(e.atMs)}</td>
            <td>{actor(e.actor)}</td>
            <td>{describeAction(e.action)}</td>
            <td class="muted">{e.studentId ? (names[e.studentId] ?? (e.action === 'student-deleted' ? e.detail : 'Removed student')) : ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if !error}
    <p class="muted">Nothing recorded yet.</p>
  {/if}
</section>

<style>
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--pw-text-muted); font-weight: 600; padding: 0 10px 10px; border-bottom: 1px solid var(--pw-border); }
  td { padding: 10px; border-bottom: 1px solid var(--pw-border); }
  .nowrap { white-space: nowrap; }
</style>

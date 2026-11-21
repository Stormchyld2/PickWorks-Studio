<!--
  Profile selection (approved design 2). Never signs anyone in by itself:
  every profile needs its password.
-->
<script lang="ts">
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Lock from '@lucide/svelte/icons/lock';
  import Plus from '@lucide/svelte/icons/plus';
  import Clock from '@lucide/svelte/icons/clock';
  import Avatar from './Avatar.svelte';
  import { auth } from '$lib/stores/auth.svelte';

  const notice = $derived.by(() => {
    const r = auth.lastSignOut;
    if (!r) return '';
    const base = r.reason === 'idle' ? 'You were signed out after a period of inactivity.' : 'You were signed out.';
    return r.unsaved.length ? `${base} Some work could not be saved: ${r.unsaved.join(', ')}.` : `${base} Your work was saved.`;
  });
</script>

<main class="fx">
  <img class="logo" src="/branding/pickworks-logo.png" alt="PickWorks Studio" />
  <div class="tag">Guitar Learning System</div>

  <h1 class="q">Select Your Profile</h1>
  <p class="muted sub">Choose your profile to sign in and continue your guitar journey.</p>

  {#if notice}
    <div class="pw-note notice" class:amber={auth.lastSignOut?.unsaved.length} role="status"><Clock size={18} /> <span>{notice}</span></div>
  {/if}

  <ul class="grid">
    {#each auth.profiles as p (p.id)}
      <li>
        <button class="glow-card prof" onclick={() => auth.choose(p)} aria-label="Sign in as {p.displayName}">
          <Avatar src={p.avatar} />
          <strong>{p.displayName}</strong>
          <span class="lock" aria-hidden="true"><Lock size={15} /></span>
        </button>
      </li>
    {/each}
    <li>
      <button class="prof add" onclick={() => auth.choose('admin')}>
        <span class="plus" aria-hidden="true"><Plus size={36} /></span>
        <strong>Add Student</strong>
        <span class="muted small">(Admin)</span>
      </button>
    </li>
  </ul>

  {#if !auth.profiles.length}
    <p class="muted empty">No students yet. Sign in as the administrator to add one.</p>
  {/if}

  <button class="pw-btn adm" onclick={() => auth.choose('admin')}><ShieldCheck size={18} color="var(--pw-amber)" /> Administrator Sign In</button>

  <div class="foot">Works fully offline · © PickWorks Studio, all rights reserved.</div>
</main>

<style>
  .fx {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(35, 139, 235, 0.14), transparent 60%),
      linear-gradient(180deg, rgba(11, 17, 25, 0.72), rgba(11, 17, 25, 0.9) 45%, var(--pw-bg) 75%),
      url('/images/dashboard-header.jpg') center top / cover no-repeat;
    background-color: var(--pw-bg);
  }
  .logo { width: 300px; max-width: 80vw; height: auto; margin-bottom: 6px; }
  .tag { font-size: 1.1rem; margin-bottom: 26px; }
  .q { font-size: 2.2rem; text-align: center; }
  .sub { margin: 6px 0 22px; font-size: 1.1rem; text-align: center; }
  .notice { margin-bottom: 20px; max-width: 640px; }
  .grid { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 18px; max-width: 1150px; }
  .prof { position: relative; width: 200px; min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px 14px 20px; color: var(--pw-text); cursor: pointer; font: inherit; transition: box-shadow var(--pw-transition), border-color var(--pw-transition); }
  .prof strong { font-size: 1.25rem; margin-top: 8px; }
  .prof:hover, .prof:focus-visible { border-color: var(--pw-primary-hover); box-shadow: 0 0 0 1px var(--pw-primary-hover), 0 0 28px rgba(35, 139, 235, 0.35); }
  .lock { position: absolute; top: 12px; right: 12px; color: var(--pw-text-faint); }
  .add { background: transparent; border: 2px dashed var(--pw-border-strong); border-radius: var(--pw-radius-lg); }
  .plus { width: 104px; height: 104px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--pw-border-strong); color: var(--pw-text-muted); }
  .small { font-size: 0.88rem; }
  .empty { margin-top: 18px; }
  .adm { margin-top: 28px; }
  .foot { margin-top: 26px; color: var(--pw-text-faint); font-size: 0.85rem; }
</style>

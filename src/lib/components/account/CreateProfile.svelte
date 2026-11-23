<!--
  "Create Student Profile": a student sets up their own profile from the
  profile selector (when the administrator allows it). It is always a student
  account with its own records; it never has administrator access.
-->
<script lang="ts">
  import UserPlus from '@lucide/svelte/icons/user-plus';
  import Camera from '@lucide/svelte/icons/camera';
  import Check from '@lucide/svelte/icons/check';
  import Info from '@lucide/svelte/icons/info';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import FocusSplit from './FocusSplit.svelte';
  import PasswordField from './PasswordField.svelte';
  import Avatar from './Avatar.svelte';
  import { friendlyError } from './errors';
  import { toAvatarDataUrl } from '$lib/components/admin/format';
  import { auth } from '$lib/stores/auth.svelte';

  let name = $state('');
  let password = $state('');
  let confirm = $state('');
  let picture = $state<string | null>(null);
  let error = $state('');
  let busy = $state(false);

  const longEnough = $derived(password.length >= 8);
  const matches = $derived(password.length > 0 && password === confirm);
  const ok = $derived(name.trim().length > 0 && longEnough && matches && !busy);

  async function choosePicture(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      picture = await toAvatarDataUrl(file);
    } catch {
      error = "That picture couldn't be used. Try a JPEG or PNG photo.";
    }
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!ok) return;
    busy = true;
    error = '';
    try {
      await auth.register(name, password, picture);
    } catch (err) {
      error = friendlyError(err);
      busy = false;
    }
  }
</script>

<FocusSplit>
  <h1 class="h">Create Student Profile</h1>
  <p class="muted lead">Set up your own profile. Your progress, settings and history are kept separate from everyone else's.</p>
  <form class="glow-card form" onsubmit={submit}>
    <h2><UserPlus size={22} /> Your Profile</h2>
    <div class="pic">
      <Avatar src={picture ?? undefined} size={96} />
      <div class="pic-actions">
        <label class="pw-btn"><Camera size={18} /> {picture ? 'Change Picture' : 'Choose Picture'}<input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onchange={choosePicture} /></label>
        {#if picture}<button class="pw-btn ghost" type="button" onclick={() => (picture = null)}>Remove</button>{/if}
        <span class="muted small">Optional</span>
      </div>
    </div>
    <div class="pw-field">
      <label for="reg-name">Your name</label>
      <div class="pw-input"><input id="reg-name" bind:value={name} maxlength="60" autocomplete="off" /></div>
    </div>
    <PasswordField id="reg-pw" label="Password" hint="(minimum 8 characters)" autocomplete="new-password" bind:value={password} />
    <PasswordField id="reg-pw2" label="Confirm password" autocomplete="new-password" bind:value={confirm} />
    <ul class="rules">
      <li class:ok={longEnough}><Check size={16} /> At least 8 characters</li>
      <li class:ok={matches}><Check size={16} /> Both match</li>
    </ul>
    {#if error}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{error}</span></div>{/if}
    <div class="pw-note"><Info size={18} color="var(--pw-primary-hover)" /> <span>Remember your password. If you forget it, your administrator can reset it without losing your progress.</span></div>
    <div class="actions">
      <button class="pw-btn ghost" type="button" onclick={() => auth.showProfiles()}>Back to Profiles</button>
      <button class="pw-btn primary" type="submit" disabled={!ok}>Create Profile</button>
    </div>
  </form>
</FocusSplit>

<style>
  .h { font-size: 2.3rem; }
  .lead { margin: 4px 0 20px; font-size: 1.1rem; max-width: 640px; }
  .form { max-width: 640px; display: flex; flex-direction: column; gap: 4px; }
  .form h2 { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; margin-bottom: 12px; }
  .form h2 :global(svg) { color: var(--pw-primary); }
  .pic { display: flex; align-items: center; gap: 18px; margin-bottom: 12px; }
  .pic-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .small { font-size: 0.88rem; }
  .rules { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-wrap: wrap; gap: 22px; color: var(--pw-text-muted); font-size: 0.9rem; }
  .rules li { display: flex; align-items: center; gap: 6px; }
  .rules li.ok { color: var(--pw-success); }
  .pw-note { margin-top: 8px; }
  .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
</style>

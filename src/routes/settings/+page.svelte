<!-- Student settings (approved design 5). Saved to the signed-in student's profile on every change. -->
<script lang="ts">
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import AudioWaveform from '@lucide/svelte/icons/audio-waveform';
  import Accessibility from '@lucide/svelte/icons/accessibility';
  import CircleUser from '@lucide/svelte/icons/circle-user';
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  import Info from '@lucide/svelte/icons/info';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import LogOut from '@lucide/svelte/icons/log-out';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import Lock from '@lucide/svelte/icons/lock';
  import type { Snippet } from 'svelte';
  import PasswordField from '$lib/components/account/PasswordField.svelte';
  import { friendlyError } from '$lib/components/account/errors';
  import { preferences } from '$lib/stores/preferences.svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { backend } from '$lib/services/backend';
  import { audioEngine, type AudioDevice } from '$lib/services/audio/audio-engine';
  import { PRACTICE_MINUTES, TEXT_SIZES, type Preferences } from '$lib/engines/student/records';
  import { A4_CHOICES } from '$lib/engines/audio/tuner/tuner';
  import { TUNING_PRESETS } from '$lib/engines/audio/tuner/presets';
  import { MAX_BPM, MIN_BPM, clampBpm } from '$lib/engines/audio/metronome';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { DEFAULT_WORKSPACE, WORKSPACES, workspaceById, type WorkspaceId } from '$lib/engines/workspaces/config';
  import { canHide, type WorkspaceAccess } from '$lib/engines/workspaces/access';

  const TABS = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'workspaces', label: 'Workspaces', icon: LayoutGrid },
    { id: 'audio', label: 'Audio', icon: Volume2 },
    { id: 'tuner', label: 'Tuner', icon: AudioWaveform },
    { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
    { id: 'account', label: 'Account', icon: CircleUser },
  ] as const;
  let tab = $state<(typeof TABS)[number]['id']>('general');

  const p = $derived(preferences.value);
  const set = (fn: (p: Preferences) => void) => preferences.update(fn);

  let inputs = $state<AudioDevice[]>([]);
  let outputs = $state<AudioDevice[]>([]);
  $effect(() => {
    if (tab !== 'audio') return;
    audioEngine.listInputs().then((d) => (inputs = d)).catch(() => (inputs = []));
    audioEngine.listOutputs().then((d) => (outputs = d)).catch(() => (outputs = []));
  });

  let current = $state('');
  let next = $state('');
  let confirm = $state('');
  let pwError = $state('');
  let pwDone = $state(false);
  let busy = $state(false);
  async function changePassword(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    pwError = '';
    try {
      await backend.changePassword(auth.info!.token, current, next);
      pwDone = true;
      current = next = confirm = '';
    } catch (err) {
      pwError = friendlyError(err);
    } finally {
      busy = false;
    }
  }
  // Workspaces tab (approved mockups 5 and 7).
  const wsAccess = $derived(workspace.access);
  const rememberLast = $derived(p.workspace.startup === 'last-used');
  const startIn = $derived<WorkspaceId>(p.workspace.startup === 'last-used' ? DEFAULT_WORKSPACE : p.workspace.startup);
  const onlyOne = $derived(workspace.visible.length <= 1);
  function wsState(id: WorkspaceId): WorkspaceAccess | undefined {
    return wsAccess?.find((a) => a.id === id);
  }
  function wsHint(id: WorkspaceId, a: WorkspaceAccess | undefined): string {
    if (!a || a.state === 'not-implemented') return 'Not available yet';
    if (a.state === 'locked') return 'Locked. Your administrator decides when it opens';
    if (id === DEFAULT_WORKSPACE) return onlyOne ? 'Always available. Your only workspace, so it stays visible' : 'Always available. Hiding it only removes it from the dropdown';
    if (a.unlockedBy === 'student-grant' || a.unlockedBy === 'unlock-all') return 'Available (opened by your administrator)';
    return 'Available';
  }
  function setShown(id: WorkspaceId, show: boolean) {
    void set((x) => (x.workspace.shown = { ...x.workspace.shown, [id]: show }));
  }

  const textSizeLabel = { normal: 'Normal', large: 'Large', larger: 'Larger' } as const;
</script>

{#snippet toggle(label: string, checked: boolean, onchange: (v: boolean) => void, hint?: string)}
  <label class="toggle-row">
    <input type="checkbox" {checked} onchange={(e) => onchange(e.currentTarget.checked)} />
    <span class="t"><span>{label}</span>{#if hint}<small>{hint}</small>{/if}</span>
  </label>
{/snippet}

{#snippet row(label: string, control: Snippet, id?: string)}
  <div class="row"><label class="row-l" for={id}>{label}</label>{@render control()}</div>
{/snippet}

<header class="head">
  <span class="ic" aria-hidden="true"><SettingsIcon size={48} /></span>
  <div>
    <h1>Settings</h1>
    <p>Saved to your profile and applied on every screen.</p>
  </div>
</header>

<div class="tabs" role="tablist" aria-label="Settings sections">
  {#each TABS as t}
    <button role="tab" id="tab-{t.id}" aria-selected={tab === t.id} aria-controls="panel" class:on={tab === t.id} onclick={() => (tab = t.id)}>
      <t.icon size={18} /> {t.label}
    </button>
  {/each}
</div>

<div class="card panel" id="panel" role="tabpanel" aria-labelledby="tab-{tab}">
  {#if tab === 'general'}
    <div class="cols">
      <div>
        <h2>Application</h2>
        {@render toggle('Highlight my profile first on the sign-in screen', p.practice.highlightOnSignIn, (v) => set((x) => (x.practice.highlightOnSignIn = v)), 'A password is always required')}
        {@render toggle('Practice reminders', p.practice.reminders, (v) => set((x) => (x.practice.reminders = v)))}
        {@render toggle('Ask before signing out', p.practice.askBeforeSignOut, (v) => set((x) => (x.practice.askBeforeSignOut = v)))}
        <h2 class="gap">Rewards display</h2>
        {@render toggle('Show XP and level', p.rewards.showXp, (v) => set((x) => (x.rewards.showXp = v)))}
        {@render toggle('Show badges and challenges', p.rewards.showBadges, (v) => set((x) => (x.rewards.showBadges = v)))}
        {@render toggle('Show practice streak', p.rewards.showStreak, (v) => set((x) => (x.rewards.showStreak = v)), 'Missed days never remove XP, badges or mastery')}
        <p class="muted small">Hiding rewards never deletes them. XP and badges arrive with Phase 2.</p>
      </div>
      <div class="divider">
        <h2>Practice</h2>
        {#snippet tempo()}
          <span class="stepper">
            <button onclick={() => set((x) => (x.practice.metronomeBpm = clampBpm(x.practice.metronomeBpm - 1)))} aria-label="Slower" disabled={p.practice.metronomeBpm <= MIN_BPM}><Minus size={18} /></button>
            <output id="bpm">{p.practice.metronomeBpm} BPM</output>
            <button onclick={() => set((x) => (x.practice.metronomeBpm = clampBpm(x.practice.metronomeBpm + 1)))} aria-label="Faster" disabled={p.practice.metronomeBpm >= MAX_BPM}><Plus size={18} /></button>
          </span>
        {/snippet}
        {@render row('Default metronome tempo', tempo, 'bpm')}
        {#snippet session()}
          <select id="session" value={p.practice.sessionMinutes} onchange={(e) => set((x) => (x.practice.sessionMinutes = Number(e.currentTarget.value)))}>
            {#each PRACTICE_MINUTES as m}<option value={m}>{m} minutes</option>{/each}
          </select>
        {/snippet}
        {@render row('Default practice session', session, 'session')}
        <div class="pw-note"><Info size={18} color="var(--pw-primary-hover)" /> <span>Progress saves automatically after every exercise and lesson. It can't be turned off.</span></div>
      </div>
    </div>
  {:else if tab === 'audio'}
    <h2>Audio</h2>
    {#snippet vol()}
      <input id="vol" class="range" type="range" min="0" max="1" step="0.01" value={p.audio.masterVolume} onchange={(e) => set((x) => (x.audio.masterVolume = Number(e.currentTarget.value)))} />
    {/snippet}
    {@render row('Master volume', vol, 'vol')}
    {#snippet input()}
      <select id="in" value={p.audio.inputDeviceId ?? ''} onchange={(e) => set((x) => (x.audio.inputDeviceId = e.currentTarget.value || null))}>
        <option value="">System default</option>
        {#each inputs as d}<option value={d.deviceId}>{d.label}</option>{/each}
      </select>
    {/snippet}
    {@render row('Input (microphone or audio interface)', input, 'in')}
    {#if audioEngine.canChooseOutput}
      {#snippet output()}
        <select id="out" value={p.audio.outputDeviceId ?? ''} onchange={(e) => set((x) => (x.audio.outputDeviceId = e.currentTarget.value || null))}>
          <option value="">System default</option>
          {#each outputs as d}<option value={d.deviceId}>{d.label}</option>{/each}
        </select>
      {/snippet}
      {@render row('Output (speakers or headphones)', output, 'out')}
    {/if}
    <p class="muted small">Device names appear after you allow microphone access, for example by starting the tuner once.</p>
  {:else if tab === 'tuner'}
    <h2>Tuner (this profile)</h2>
    {#snippet a4()}
      <select id="a4" value={p.tuner.a4} onchange={(e) => set((x) => (x.tuner.a4 = Number(e.currentTarget.value)))}>
        {#each A4_CHOICES as f}<option value={f}>{f} Hz</option>{/each}
      </select>
    {/snippet}
    {@render row('Reference pitch (A4)', a4, 'a4')}
    {#snippet tuning()}
      <select id="tuning" value={p.tuner.presetId} onchange={(e) => set((x) => (x.tuner.presetId = e.currentTarget.value))}>
        {#each TUNING_PRESETS.filter((t) => t.inPicker) as t}<option value={t.id}>{t.name} ({t.notes})</option>{/each}
      </select>
    {/snippet}
    {@render row('Default tuning', tuning, 'tuning')}
    {#snippet mode()}
      <select id="mode" value={p.tuner.mode} onchange={(e) => set((x) => (x.tuner.mode = e.currentTarget.value as 'guided' | 'chromatic'))}>
        <option value="guided">Guided</option>
        <option value="chromatic">Chromatic</option>
      </select>
    {/snippet}
    {@render row('Mode', mode, 'mode')}
    {@render toggle('Precise mode (±2 cents)', p.tuner.precise, (v) => set((x) => (x.tuner.precise = v)))}
    {@render toggle('Play a chime when a string is in tune', p.tuner.chime, (v) => set((x) => (x.tuner.chime = v)))}
  {:else if tab === 'workspaces'}
    <div class="cols">
      <div>
        <h2>Start-up</h2>
        {#snippet startSel()}
          <select id="wsstart" value={startIn} disabled={rememberLast} onchange={(e) => set((x) => (x.workspace.startup = e.currentTarget.value as WorkspaceId))}>
            {#each workspace.visible as id (id)}<option value={id}>{workspaceById(id).name}</option>{/each}
          </select>
        {/snippet}
        {@render row('Start in', startSel, 'wsstart')}
        {@render toggle('Remember the last workspace I used', rememberLast, (v) => set((x) => (x.workspace.startup = v ? 'last-used' : startIn)), 'Overrides "Start in" when on')}
        {@render toggle('Keep the sidebar collapsed', p.workspace.sidebarCollapsed, (v) => set((x) => (x.workspace.sidebarCollapsed = v)), 'Remembered for this profile')}
        <h2 class="gap">Workspace access</h2>
        <div class="pw-note"><Lock size={18} color="var(--pw-primary-hover)" /> <span>Your administrator decides which workspaces you can open. New workspaces appear here as they're ready. Access never changes your lessons, XP, mastery or progress.</span></div>
      </div>
      <div class="divider">
        <h2>Show in Workspace Dropdown</h2>
        <ul class="wsl">
          {#each WORKSPACES as w (w.id)}
            {@const a = wsState(w.id)}
            {@const available = a?.state === 'visible' || a?.state === 'hidden'}
            {#if available}
              <li>
                <span><b>{w.name}</b><small>{wsHint(w.id, a)}</small></span>
                <input
                  type="checkbox"
                  checked={a?.state === 'visible'}
                  disabled={a?.state === 'visible' && !canHide(wsAccess ?? [], w.id)}
                  aria-label="Show {w.name} in the workspace dropdown"
                  onchange={(e) => setShown(w.id, e.currentTarget.checked)}
                />
              </li>
            {:else}
              <li class="na" class:locked={a?.state === 'locked'}>
                <span><b>{w.name}</b><small class:lock={a?.state === 'locked'}>{#if a?.state === 'locked'}<Lock size={13} aria-hidden="true" />{/if}{wsHint(w.id, a)}</small></span>
              </li>
            {/if}
          {/each}
        </ul>
        <div class="pw-note"><Info size={18} color="var(--pw-primary-hover)" /> <span>Hiding a workspace only removes it from the dropdown. Your songs, recordings, notes and progress are kept. At least one workspace always stays visible, and you can show a hidden workspace again here at any time.</span></div>
      </div>
    </div>
  {:else if tab === 'accessibility'}
    <h2>Display</h2>
    {@render toggle('Left-handed fretboard', p.display.leftHanded, (v) => set((x) => (x.display.leftHanded = v)), 'Mirrors fretboards and chord diagrams. Notes and answers stay the same.')}
    <div class="row">
      <span class="row-l" id="ts">Text size</span>
      <div class="seg" role="radiogroup" aria-labelledby="ts">
        {#each TEXT_SIZES as s}
          <button role="radio" aria-checked={p.display.textSize === s} class:on={p.display.textSize === s} onclick={() => set((x) => (x.display.textSize = s))}>{textSizeLabel[s]}</button>
        {/each}
      </div>
    </div>
    {@render toggle('High contrast', p.display.highContrast, (v) => set((x) => (x.display.highContrast = v)), 'Brighter secondary text and borders')}
    {@render toggle('Reduce motion', p.display.reducedMotion, (v) => set((x) => (x.display.reducedMotion = v)), 'Turns off animations and transitions')}
  {:else}
    <h2>Account</h2>
    <p>Signed in as <b>{auth.info?.displayName}</b>. You're signed out after 20 minutes without activity, and your work is saved first.</p>
    <form class="pwform" onsubmit={changePassword}>
      <h3>Change password</h3>
      <PasswordField id="s-cur" label="Current password" bind:value={current} />
      <PasswordField id="s-new" label="New password" hint="(minimum 8 characters)" autocomplete="new-password" bind:value={next} />
      <PasswordField id="s-new2" label="Confirm new password" autocomplete="new-password" bind:value={confirm} />
      {#if pwError}<div class="pw-note error" role="alert"><CircleAlert size={18} /> <span>{pwError}</span></div>{/if}
      {#if pwDone}<div class="pw-note ok" role="status"><CircleCheck size={18} /> <span>Your password was changed.</span></div>{/if}
      <div class="actions">
        <button class="pw-btn warn" type="button" onclick={() => auth.requestSignOut()}><LogOut size={18} /> Sign out</button>
        <button class="pw-btn primary" type="submit" disabled={busy || !current || next.length < 8 || next !== confirm}>Change Password</button>
      </div>
    </form>
    <p class="muted small">Forgot your password? Your administrator can reset it. Your progress is always kept.</p>
  {/if}
</div>

<style>
  .head { display: flex; gap: 18px; align-items: center; margin: 0 0 22px; }
  .ic { color: var(--pw-primary); display: grid; }
  h1 { font-size: 2.4rem; }
  .head p { margin: 2px 0 0; color: var(--pw-text-muted); font-size: 1.1rem; }
  .tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 18px; padding: 5px; border-radius: var(--pw-radius); background: rgba(11, 17, 25, 0.55); border: 1px solid var(--pw-border); width: fit-content; }
  .tabs button { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: var(--pw-radius-sm); color: var(--pw-text-muted); background: none; border: 0; cursor: pointer; font-size: 1.02rem; }
  .tabs button:hover { color: var(--pw-text); }
  .tabs button.on { background: var(--pw-primary); color: #fff; font-weight: 600; box-shadow: 0 0 0 1px var(--pw-primary-hover), 0 4px 16px rgba(35, 139, 235, 0.35); }
  .panel { max-width: 1200px; padding: 26px 30px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .cols > div { padding-right: 30px; }
  .divider { border-left: 1px solid var(--pw-border); padding-left: 30px; }
  h2 { font-size: 1.2rem; margin-bottom: 12px; }
  h2.gap { margin-top: 26px; }
  h3 { font-size: 1.05rem; margin-bottom: 10px; }
  .wsl { list-style: none; padding: 0; margin: 0 0 14px; display: flex; flex-direction: column; gap: 8px; }
  .wsl li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid var(--pw-border-strong); border-radius: 12px; background: var(--pw-bg-raised); }
  .wsl li span { display: flex; flex-direction: column; gap: 2px; }
  .wsl small { color: var(--pw-text-muted); font-size: 0.85rem; }
  .wsl small.lock { color: var(--pw-amber); display: inline-flex; flex-direction: row; gap: 6px; align-items: center; }
  .wsl li.na { opacity: 0.7; border-style: dashed; }
  .wsl li.na.locked { opacity: 1; border-style: solid; }
  .wsl input { width: 22px; height: 22px; accent-color: var(--pw-primary); }
  select:disabled { opacity: 0.6; }
  .toggle-row { display: flex; gap: 12px; align-items: flex-start; padding: 8px 0; cursor: pointer; }
  .toggle-row input { width: 20px; height: 20px; margin-top: 2px; accent-color: var(--pw-primary); flex-shrink: 0; }
  .toggle-row .t { display: flex; flex-direction: column; }
  .toggle-row small { color: var(--pw-text-muted); font-size: 0.88rem; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 0; }
  .row-l { font-size: 1.02rem; }
  select { min-width: 260px; background: var(--pw-bg-raised); color: var(--pw-text); border: 1px solid var(--pw-border-strong); border-radius: var(--pw-radius-sm); padding: 10px 12px; font: inherit; }
  .range { width: 260px; accent-color: var(--pw-primary); }
  .stepper { display: inline-flex; align-items: center; border: 1px solid var(--pw-border-strong); border-radius: var(--pw-radius-sm); background: var(--pw-bg-raised); }
  .stepper button { background: none; border: 0; color: var(--pw-text); padding: 10px 14px; cursor: pointer; display: grid; }
  .stepper button:disabled { opacity: 0.4; cursor: not-allowed; }
  .stepper output { min-width: 90px; text-align: center; font-weight: 600; }
  .seg { display: flex; gap: 8px; }
  .seg button { padding: 9px 16px; border-radius: var(--pw-radius-sm); border: 1px solid var(--pw-border-strong); background: var(--pw-surface-2); color: var(--pw-text); cursor: pointer; }
  .seg button.on { background: var(--pw-primary); border-color: var(--pw-primary-hover); font-weight: 600; }
  .pw-note { margin-top: 18px; }
  .pw-note.ok { background: rgba(63, 178, 127, 0.12); border-color: rgba(63, 178, 127, 0.5); }
  .small { font-size: 0.9rem; margin-top: 12px; }
  .pwform { max-width: 560px; margin-top: 18px; }
  .actions { display: flex; justify-content: space-between; margin-top: 16px; }
  @media (max-width: 839.98px) { .cols { grid-template-columns: 1fr; } .divider { border-left: 0; padding-left: 0; margin-top: 24px; } }
</style>

<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import SetupWizard from './SetupWizard.svelte';
  import ProfileSelect from './ProfileSelect.svelte';
  import PasswordSignIn from './PasswordSignIn.svelte';
  import ChangePassword from './ChangePassword.svelte';
  import RecoverAdmin from './RecoverAdmin.svelte';
  import FocusSplit from './FocusSplit.svelte';
</script>

{#if auth.screen.name === 'setup'}
  <SetupWizard />
{:else if auth.screen.name === 'profiles'}
  <ProfileSelect />
{:else if auth.screen.name === 'sign-in'}
  {#key auth.screen.profile}
    <PasswordSignIn profile={auth.screen.profile} />
  {/key}
{:else if auth.screen.name === 'change-password'}
  <ChangePassword />
{:else if auth.screen.name === 'recover'}
  <RecoverAdmin />
{:else if auth.screen.name === 'unavailable'}
  <FocusSplit>
    <h1>PickWorks Studio</h1>
    <p class="muted">{auth.screen.message}</p>
  </FocusSplit>
{:else}
  <div class="loading" aria-busy="true"><img src="/branding/pickworks-logo.png" alt="PickWorks Studio" /></div>
{/if}

<style>
  .loading { min-height: 100vh; display: grid; place-items: center; }
  .loading img { width: 260px; opacity: 0.8; }
</style>

<script lang="ts">
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Lock from '@lucide/svelte/icons/lock';

  let {
    value = $bindable(''),
    id,
    label,
    hint,
    placeholder = '',
    autocomplete = 'current-password',
    invalid = false,
    autofocus = false,
  }: {
    value?: string;
    id: string;
    label?: string;
    hint?: string;
    placeholder?: string;
    autocomplete?: 'current-password' | 'new-password' | 'off';
    invalid?: boolean;
    autofocus?: boolean;
  } = $props();

  let shown = $state(false);
  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (autofocus) input?.focus();
  });
</script>

<div class="pw-field">
  {#if label}<label for={id}>{label} {#if hint}<span class="hint">{hint}</span>{/if}</label>{/if}
  <div class="pw-input" class:invalid>
    <Lock size={18} aria-hidden="true" />
    <input bind:this={input} {id} type={shown ? 'text' : 'password'} bind:value {placeholder} {autocomplete} spellcheck="false" aria-invalid={invalid} />
    <button type="button" onclick={() => (shown = !shown)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
      {#if shown}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
    </button>
  </div>
</div>

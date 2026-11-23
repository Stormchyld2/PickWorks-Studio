<script lang="ts">
  /**
   * Workspace selector (Workspace Navigation Stage B, approved mockups 1-4).
   * A button that opens a list. The list works with the arrow keys, Home,
   * End, Enter, Space and Escape, closes on an outside click or when focus
   * leaves, and stays inside the window. It floats over the page, so opening
   * it never moves the dashboard layout.
   */
  import { tick } from 'svelte';
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
  import Check from '@lucide/svelte/icons/check';
  import { workspaceById, type WorkspaceId } from '$lib/engines/workspaces/config';
  import { workspace } from '$lib/stores/workspace.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import { WORKSPACE_ICONS } from './workspace-icons';
  import { popoverPosition } from './popover';
  import { listboxKey } from './listbox';

  let { collapsed = false }: { collapsed?: boolean } = $props();

  let open = $state(false);
  let activeIndex = $state(0);
  let trigger = $state<HTMLButtonElement>();
  let list = $state<HTMLUListElement>();
  let pos = $state<{ top: number; left: number; width: number } | null>(null);
  let unsaved = $state<{ id: WorkspaceId; items: string[] } | null>(null);
  const uid = `ws-${Math.random().toString(36).slice(2, 8)}`;

  const current = $derived(workspaceById(workspace.current));
  const options = $derived(workspace.visible.map((id) => workspaceById(id)));
  const CurrentIcon = $derived(WORKSPACE_ICONS[workspace.current]);

  function place() {
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    pos = popoverPosition(r, { width: window.innerWidth, height: window.innerHeight }, collapsed, list?.offsetHeight ?? 0);
  }

  async function show(focusIndex?: number) {
    open = true;
    activeIndex = focusIndex ?? Math.max(0, options.findIndex((o) => o.id === workspace.current));
    await tick();
    place();
    await tick();
    place(); // again now the list has its real height
    list?.focus();
  }

  function hide(returnFocus = true) {
    open = false;
    if (returnFocus) trigger?.focus();
  }

  async function choose(id: WorkspaceId, force = false) {
    hide(false);
    const r = await workspace.switchTo(id, force);
    if (!r.switched && r.unsaved.length) {
      unsaved = { id, items: r.unsaved };
      return;
    }
    await tick();
    // Focus moves to the page heading after a switch.
    const h = document.querySelector<HTMLElement>('main h1');
    if (h) {
      h.tabIndex = -1;
      h.focus();
    } else trigger?.focus();
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      void show(e.key === 'ArrowUp' ? options.length - 1 : undefined);
    }
  }

  function onListKey(e: KeyboardEvent) {
    const a = listboxKey(e.key, activeIndex, options.length);
    if (!a) return;
    if (e.key !== 'Tab') e.preventDefault(); // Tab still moves focus on
    if (a.kind === 'move') activeIndex = a.index;
    else if (a.kind === 'choose') void choose(options[a.index].id);
    else hide(a.returnFocus);
  }

  /**
   * Moves the list to the end of <body> while it is open, so no sidebar
   * scroll area, stacking order or effect can clip it or put it behind the page.
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  function onWindowPointer(e: PointerEvent) {
    if (!open) return;
    const t = e.target as Node;
    if (!list?.contains(t) && !trigger?.contains(t)) hide(false);
  }

  function onFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (open && next && !list?.contains(next) && !trigger?.contains(next)) hide(false);
  }
</script>

<svelte:window onpointerdown={onWindowPointer} onresize={() => open && place()} />

<div class="ws" class:collapsed>
  <button
    bind:this={trigger}
    class="trigger"
    type="button"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={open ? `${uid}-list` : undefined}
    aria-label="Workspace: {current.name}"
    title={collapsed ? `Workspace: ${current.name}` : undefined}
    onclick={() => (open ? hide() : void show())}
    onkeydown={onTriggerKey}
  >
    <span class="tile" aria-hidden="true"><CurrentIcon size={22} /></span>
    {#if !collapsed}
      <span class="txt"><span class="eb">Workspace</span><b>{current.name}</b></span>
      <ChevronsUpDown size={18} aria-hidden="true" />
    {/if}
  </button>

  {#if open}
    <ul
      bind:this={list}
      use:portal
      id="{uid}-list"
      class="menu"
      role="listbox"
      tabindex="-1"
      aria-label="Choose a workspace"
      aria-activedescendant="{uid}-{options[activeIndex]?.id}"
      style:top={pos ? `${pos.top}px` : undefined}
      style:left={pos ? `${pos.left}px` : undefined}
      style:width={pos ? `${pos.width}px` : undefined}
      style:visibility={pos ? 'visible' : 'hidden'}
      onkeydown={onListKey}
      onfocusout={onFocusOut}
    >
      {#each options as w, i (w.id)}
        {@const Icon = WORKSPACE_ICONS[w.id]}
        <!-- Keyboard use goes through the listbox (arrow keys, Enter); a click picks directly. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          id="{uid}-{w.id}"
          role="option"
          aria-selected={w.id === workspace.current}
          class:sel={w.id === workspace.current}
          class:active={i === activeIndex}
          onclick={() => void choose(w.id)}
          onpointermove={() => (activeIndex = i)}
        >
          <span class="tile" aria-hidden="true"><Icon size={20} /></span>
          <span class="txt"><b>{w.name}</b><span>{w.description}</span></span>
          {#if w.id === workspace.current}<Check size={18} aria-hidden="true" />{/if}
        </li>
      {/each}
      {#if options.length === 1}
        <li class="more" role="presentation">More workspaces will appear here as they're ready.</li>
      {/if}
    </ul>
  {/if}
</div>

{#if unsaved}
  <Dialog title="Some work isn't saved yet" onclose={() => (unsaved = null)} width={460}>
    <p>These couldn't be saved: {unsaved.items.join(', ')}. You can stay here and try again, or switch anyway.</p>
    <div class="dlg-actions">
      <button class="pw-btn" onclick={() => (unsaved = null)}>Stay Here</button>
      <button
        class="pw-btn primary"
        onclick={() => {
          const id = unsaved!.id;
          unsaved = null;
          void choose(id, true);
        }}>Switch Anyway</button
      >
    </div>
  </Dialog>
{/if}

<style>
  .ws {
    position: relative;
    margin: -4px 0 10px;
  }
  .trigger {
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px 8px 8px;
    border-radius: 12px;
    border: 1px solid var(--pw-border-strong);
    background: var(--pw-surface);
    color: var(--pw-text);
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .trigger:hover,
  .trigger[aria-expanded='true'] {
    border-color: var(--pw-primary-hover);
  }
  .collapsed .trigger {
    padding: 6px;
    justify-content: center;
  }
  .tile {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: linear-gradient(160deg, #2a8ff0, #1765b8);
    color: #fff;
    flex: none;
  }
  .txt {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    line-height: 1.2;
  }
  .eb {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--pw-primary-hover);
  }
  .txt b {
    font-size: 1.05rem;
  }
  /* Fixed so it floats over the page and the collapsed rail without moving anything. */
  .menu {
    position: fixed;
    z-index: 1000;
    box-sizing: border-box;
    list-style: none;
    margin: 0;
    padding: 6px;
    border-radius: 14px;
    border: 1px solid var(--pw-primary);
    background: var(--pw-surface);
    box-shadow: 0 0 0 1px rgba(67, 169, 255, 0.25), 0 12px 32px rgba(0, 0, 0, 0.5);
    max-height: calc(100vh - 16px);
    overflow-y: auto;
  }
  .menu:focus {
    outline: none;
  }
  .menu:focus-visible li.active {
    outline: 2px solid var(--pw-primary-hover);
    outline-offset: -2px;
  }
  .menu li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 10px;
    border-radius: 10px;
    cursor: pointer;
  }
  .menu li.active,
  .menu li.sel {
    background: var(--pw-surface-2);
  }
  .menu li .txt span {
    font-size: 0.85rem;
    color: var(--pw-text-muted);
  }
  .menu li :global(svg:last-child) {
    color: var(--pw-primary-hover);
  }
  .menu li.more {
    display: block;
    min-height: 0;
    cursor: default;
    font-size: 0.85rem;
    color: var(--pw-text-muted);
    border-top: 1px solid var(--pw-border);
    border-radius: 0;
    margin-top: 4px;
    padding: 10px 10px 6px;
    background: none;
  }
  .dlg-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 16px;
  }
  @media (prefers-reduced-motion: no-preference) {
    .trigger {
      transition: border-color var(--pw-transition);
    }
  }
</style>

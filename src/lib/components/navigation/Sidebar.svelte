<script lang="ts">
  import { page } from '$app/state';
  import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
  import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
  import LogOut from '@lucide/svelte/icons/log-out';
  import { PRIMARY_NAV, SECONDARY_NAV, activeHref, type NavItem } from './nav-items';
  import WorkspaceSelector from './WorkspaceSelector.svelte';

  let {
    collapsed = $bindable(false),
    primary = PRIMARY_NAV,
    secondary = SECONDARY_NAV,
    tools = [],
    workspaces = false,
    oncollapse,
    onsignout,
  }: {
    collapsed?: boolean;
    primary?: NavItem[];
    secondary?: NavItem[];
    /** The shared Tools group (Tuner, Metronome), shown in every workspace. */
    tools?: NavItem[];
    /** Shows the workspace selector (students only; the administrator never sees it). */
    workspaces?: boolean;
    /** Told when the student collapses or expands the sidebar, so it can be remembered. */
    oncollapse?: (collapsed: boolean) => void;
    onsignout?: () => void;
  } = $props();

  // Exactly one item is highlighted: the most specific match.
  const current = $derived(activeHref([...primary, ...tools, ...secondary].map((i) => i.href), page.url.pathname));
</script>

{#snippet link(item: NavItem)}
  {@const active = item.href === current}
  <a
    href={item.href}
    class="nav-link"
    class:active
    aria-current={active ? 'page' : undefined}
    title={collapsed ? item.label : undefined}
  >
    <item.icon size={24} aria-hidden="true" />
    {#if !collapsed}<span>{item.label}</span>{/if}
  </a>
{/snippet}

<nav class="sidebar" class:collapsed aria-label="Main">
  <div class="brand">
    {#if collapsed}
      <!-- The pick icon is reserved for the app icon, taskbar and launcher, so collapsed navigation shows no logo. -->
      <span class="sr-only">PickWorks Studio</span>
    {:else}
      <!-- Expanded navigation uses the approved logo only, never the icon beside it. -->
      <img src="/branding/pickworks-logo.png" alt="PickWorks Studio" class="logo" />
      <div class="tagline">Guitar Learning System</div>
    {/if}
  </div>

  {#if workspaces}<WorkspaceSelector {collapsed} />{/if}

  <ul>
    {#each primary as item (item.href)}<li>{@render link(item)}</li>{/each}
  </ul>

  {#if tools.length}
    {#if collapsed}
      <div class="grpline" role="separator"></div>
    {:else}
      <div class="grp" id="nav-tools">Tools</div>
    {/if}
    <ul aria-labelledby={collapsed ? undefined : 'nav-tools'} aria-label={collapsed ? 'Tools' : undefined}>
      {#each tools as item (item.href)}<li>{@render link(item)}</li>{/each}
    </ul>
  {/if}

  <div class="spacer"></div>

  <ul class="secondary">
    {#each secondary as item (item.href)}<li>{@render link(item)}</li>{/each}
    {#if onsignout}
      <li>
        <button class="nav-link signout" onclick={onsignout} title={collapsed ? 'Sign Out' : undefined}>
          <LogOut size={24} aria-hidden="true" />
          {#if !collapsed}<span>Sign Out</span>{/if}
        </button>
      </li>
    {/if}
  </ul>

  <button
    class="collapse"
    onclick={() => {
      collapsed = !collapsed;
      oncollapse?.(collapsed);
    }}
    aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
    aria-expanded={!collapsed}
  >
    {#if collapsed}<PanelLeftOpen size={20} />{:else}<PanelLeftClose size={20} />{/if}
  </button>
</nav>

<style>
  .sidebar {
    width: var(--pw-sidebar-width);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 18px 12px 12px;
    background: var(--pw-bg-raised);
    border-right: 1px solid var(--pw-border);
    height: 100vh;
    position: sticky;
    top: 0;
    overflow-y: auto;
  }
  .sidebar.collapsed {
    width: var(--pw-sidebar-collapsed);
  }
  .brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 4px 18px;
    border-bottom: 1px solid var(--pw-border);
    margin-bottom: 12px;
  }
  .logo {
    width: 100%;
    max-width: 232px;
    height: auto;
  }
  .collapsed .brand {
    min-height: 44px;
  }
  .signout {
    width: 100%;
    background: none;
    border: 0;
    cursor: pointer;
    text-align: left;
  }
  .grp {
    margin: 10px 16px 2px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--pw-text-muted);
  }
  .grpline {
    border-top: 1px solid var(--pw-border);
    margin: 8px 6px;
  }
  .tagline {
    margin-top: 2px;
    color: var(--pw-text);
    font-size: 1.05rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .secondary {
    border-top: 1px solid var(--pw-border);
    padding-top: 12px;
  }
  .nav-link {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 48px;
    padding: 6px 16px;
    line-height: 1.2;
    border-radius: var(--pw-radius-sm);
    color: var(--pw-text);
    text-decoration: none;
    font-size: 1.1rem;
    transition: background var(--pw-transition);
  }
  .collapsed .nav-link {
    justify-content: center;
    padding: 0;
  }
  .nav-link:hover {
    background: var(--pw-surface);
  }
  .nav-link.active {
    background: var(--pw-primary);
    box-shadow: 0 0 0 1px var(--pw-primary-hover), 0 4px 18px rgba(35, 139, 235, 0.35);
    font-weight: 600;
  }
  .secondary .nav-link {
    min-height: 40px;
    font-size: 1rem;
  }
  .spacer {
    flex: 1;
  }
  .collapse {
    align-self: flex-end;
    margin-top: 8px;
    background: none;
    border: 1px solid var(--pw-border);
    border-radius: var(--pw-radius-sm);
    color: var(--pw-text-muted);
    padding: 6px;
    cursor: pointer;
  }
  .collapsed .collapse {
    align-self: center;
  }
  .collapse:hover {
    color: var(--pw-text);
    border-color: var(--pw-border-strong);
  }
</style>

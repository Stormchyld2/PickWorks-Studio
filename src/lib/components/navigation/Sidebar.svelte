<script lang="ts">
  import { page } from '$app/state';
  import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
  import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
  import { PRIMARY_NAV, SECONDARY_NAV, isActive, type NavItem } from './nav-items';

  let { collapsed = $bindable(false) }: { collapsed?: boolean } = $props();
</script>

{#snippet link(item: NavItem)}
  {@const active = isActive(item.href, page.url.pathname)}
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
      <!-- Collapsed navigation uses the approved pick icon only. -->
      <img src="/branding/pickworks-icon.png" alt="PickWorks Studio" class="icon" />
    {:else}
      <!-- Expanded navigation uses the approved logo only, never the icon beside it. -->
      <img src="/branding/pickworks-logo.png" alt="PickWorks Studio" class="logo" />
      <div class="tagline">Guitar Learning System</div>
    {/if}
  </div>

  <ul>
    {#each PRIMARY_NAV as item (item.href)}<li>{@render link(item)}</li>{/each}
  </ul>

  <div class="spacer"></div>

  <ul class="secondary">
    {#each SECONDARY_NAV as item (item.href)}<li>{@render link(item)}</li>{/each}
  </ul>

  <button
    class="collapse"
    onclick={() => (collapsed = !collapsed)}
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
  .icon {
    width: 44px;
    height: 44px;
    object-fit: contain;
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
    padding: 0 16px;
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

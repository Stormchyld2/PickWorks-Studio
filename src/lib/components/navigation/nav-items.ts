import House from '@lucide/svelte/icons/house';
import GraduationCap from '@lucide/svelte/icons/graduation-cap';
import Target from '@lucide/svelte/icons/target';
import Grid3x3 from '@lucide/svelte/icons/grid-3x3';
import Printer from '@lucide/svelte/icons/printer';
import ChartNoAxesColumn from '@lucide/svelte/icons/chart-no-axes-column';
import Settings from '@lucide/svelte/icons/settings';
import CircleQuestionMark from '@lucide/svelte/icons/circle-question-mark';
import Info from '@lucide/svelte/icons/info';
import AudioWaveform from '@lucide/svelte/icons/audio-waveform';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import Users from '@lucide/svelte/icons/users';
import DatabaseBackup from '@lucide/svelte/icons/database-backup';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import Timer from '@lucide/svelte/icons/timer';
import type { Component } from 'svelte';
import type { WorkspaceId } from '$lib/engines/workspaces/config';

export interface NavItem {
  href: string;
  label: string;
  icon: Component<{ size?: number; 'aria-hidden'?: boolean | 'true' }>;
}

/**
 * Learning Studio's sidebar (Workspace Navigation Stage B, approved
 * 2026-11-23): renamed items, Print Materials stays here until Reference
 * opens, Achievements stays hidden until Phase 2 builds it.
 */
export const LEARNING_STUDIO_NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: House },
  { href: '/learn', label: 'My Courses', icon: GraduationCap },
  { href: '/practice', label: 'Practice', icon: Target },
  { href: '/fretboard', label: 'Fretboard Explorer', icon: Grid3x3 },
  { href: '/progress', label: 'My Progress', icon: ChartNoAxesColumn },
  { href: '/print', label: 'Print Materials', icon: Printer },
];

/** Kept for callers that predate workspaces: Learning Studio's list. */
export const PRIMARY_NAV = LEARNING_STUDIO_NAV;

/** Shared Tools group, shown in every workspace. Opening a tool never changes the workspace. */
export const TOOLS_NAV: NavItem[] = [
  { href: '/tuner', label: 'Tuner', icon: AudioWaveform },
  { href: '/practice/metronome', label: 'Metronome', icon: Timer },
];

/** A workspace's own sidebar items. Workspaces that aren't built have none (they are never shown). */
export function workspaceNav(id: WorkspaceId): NavItem[] {
  return id === 'learning-studio' ? LEARNING_STUDIO_NAV : [];
}

export const SECONDARY_NAV: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: CircleQuestionMark },
  { href: '/about', label: 'About', icon: Info },
];

/** Administrator sidebar (approved 2026-11-21). Sign Out is a button below these. */
export const ADMIN_PRIMARY_NAV: NavItem[] = [
  { href: '/admin', label: 'Administration Dashboard', icon: LayoutDashboard },
  { href: '/admin/students', label: 'Student Management', icon: Users },
  { href: '/admin/backups', label: 'Backups & Restore', icon: DatabaseBackup },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
];

export const ADMIN_SECONDARY_NAV: NavItem[] = [
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: CircleQuestionMark },
  { href: '/about', label: 'About', icon: Info },
];

/** Pages each kind of account may open. */
export function allowedFor(kind: 'student' | 'admin', pathname: string): boolean {
  const adminArea = pathname === '/admin' || pathname.startsWith('/admin/');
  if (kind === 'student') return !adminArea;
  return adminArea || pathname === '/help' || pathname === '/about';
}

export function isActive(href: string, pathname: string): boolean {
  if (href === '/' || href === '/admin') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * The one sidebar item to highlight: the most specific match, so the
 * Metronome (/practice/metronome) lights up instead of Practice.
 */
export function activeHref(hrefs: readonly string[], pathname: string): string | null {
  let best: string | null = null;
  for (const h of hrefs) if (isActive(h, pathname) && (!best || h.length > best.length)) best = h;
  return best;
}

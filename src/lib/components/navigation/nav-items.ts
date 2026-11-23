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
import type { Component } from 'svelte';

export interface NavItem {
  href: string;
  label: string;
  icon: Component<{ size?: number; 'aria-hidden'?: boolean | 'true' }>;
}

/** Order and labels follow the approved spec. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: House },
  { href: '/learn', label: 'Learn', icon: GraduationCap },
  { href: '/practice', label: 'Practice', icon: Target },
  { href: '/fretboard', label: 'Fretboard', icon: Grid3x3 },
  { href: '/print', label: 'Print Materials', icon: Printer },
  { href: '/tuner', label: 'Tuner', icon: AudioWaveform },
  { href: '/progress', label: 'Progress', icon: ChartNoAxesColumn },
];

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

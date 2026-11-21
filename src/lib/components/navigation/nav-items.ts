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
  { href: '/progress', label: 'Progress', icon: ChartNoAxesColumn },
  { href: '/tuner', label: 'Tuner', icon: AudioWaveform },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: CircleQuestionMark },
  { href: '/about', label: 'About', icon: Info },
];

export function isActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

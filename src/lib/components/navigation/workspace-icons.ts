import BookOpen from '@lucide/svelte/icons/book-open';
import EighthNote from '@lucide/svelte/icons/eighth-note';
import LibraryBig from '@lucide/svelte/icons/library-big';
import type { Component } from 'svelte';
import type { WorkspaceId } from '$lib/engines/workspaces/config';

type Icon = Component<{ size?: number; 'aria-hidden'?: boolean | 'true' }>;

/** One icon per workspace. Workspaces are told apart by icon and name, never by colour. */
export const WORKSPACE_ICONS: Record<WorkspaceId, Icon> = {
  'learning-studio': BookOpen,
  'play-create': EighthNote,
  reference: LibraryBig,
};

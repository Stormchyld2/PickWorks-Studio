/**
 * Workspace configuration (Workspace Navigation, Stage A — approved 2026-11-23).
 *
 * Workspaces are navigation modes over one app: they share accounts, engines,
 * storage, settings and the design system. This module only describes them
 * and decides which workspace owns an address. Nothing here is shown to a
 * student yet; the selector and the per-workspace sidebars arrive in Stage B,
 * which needs the Project Owner's separate approval after Windows hardware
 * verification.
 */

export const WORKSPACE_IDS = ['learning-studio', 'play-create', 'reference'] as const;
export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

export const DEFAULT_WORKSPACE: WorkspaceId = 'learning-studio';

export interface WorkspaceDefinition {
  id: WorkspaceId;
  name: string;
  /** Address the selector opens when the student switches to this workspace. */
  home: string;
  /**
   * Address prefixes the workspace owns. Learning Studio keeps the existing
   * top-level addresses; later workspaces get their own prefix so ownership
   * can be read from the address alone.
   */
  owns: string[];
  /**
   * True only once the workspace has at least one meaningful, working
   * feature. No administrator or student setting can override this.
   */
  implemented: boolean;
}

export const WORKSPACES: readonly WorkspaceDefinition[] = [
  {
    id: 'learning-studio',
    name: 'Learning Studio',
    home: '/',
    owns: ['/', '/learn', '/practice', '/fretboard', '/progress', '/achievements', '/print'],
    implemented: true,
  },
  { id: 'play-create', name: 'Play & Create', home: '/create', owns: ['/create'], implemented: false },
  { id: 'reference', name: 'Reference', home: '/reference', owns: ['/reference'], implemented: false },
];

/**
 * Shared tools appear in every workspace and never change the current
 * workspace. The metronome keeps its address under /practice.
 */
export const SHARED_TOOL_PATHS = ['/tuner', '/practice/metronome'] as const;

/** Global pages: available everywhere, independent of workspace visibility. */
export const GLOBAL_PATHS = ['/settings', '/help', '/about'] as const;

/**
 * Default Automatic Learning Unlock thresholds: the share of Beginner and of
 * Intermediate lessons a student must have *covered* (completed, or proven by
 * verified placement evidence). These move into the curriculum manifest when
 * it exists; administrators may configure them.
 */
export const DEFAULT_WORKSPACE_UNLOCK = { beginnerLessons: 0.8, intermediateLessons: 0.5 } as const;
export type WorkspaceUnlockThresholds = { beginnerLessons: number; intermediateLessons: number };

export function workspaceById(id: WorkspaceId): WorkspaceDefinition {
  const w = WORKSPACES.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown workspace ${id}`);
  return w;
}

export function isWorkspaceId(value: unknown): value is WorkspaceId {
  return typeof value === 'string' && (WORKSPACE_IDS as readonly string[]).includes(value);
}

function under(prefix: string, pathname: string): boolean {
  if (prefix === '/') return pathname === '/';
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

export type PathOwner =
  | { kind: 'workspace'; workspace: WorkspaceId }
  | { kind: 'tool' }
  | { kind: 'global' }
  | { kind: 'admin' }
  | { kind: 'unknown' };

/**
 * Who owns an address. Shared tools are checked before workspaces because the
 * metronome lives under /practice but belongs to every workspace.
 */
export function ownerOfPath(pathname: string): PathOwner {
  if (under('/admin', pathname)) return { kind: 'admin' };
  if (SHARED_TOOL_PATHS.some((p) => under(p, pathname))) return { kind: 'tool' };
  if (GLOBAL_PATHS.some((p) => under(p, pathname))) return { kind: 'global' };
  // Longest prefix wins so a future nested prefix can't be shadowed.
  let best: { id: WorkspaceId; len: number } | null = null;
  for (const w of WORKSPACES) {
    for (const p of w.owns) {
      if (under(p, pathname) && (!best || p.length > best.len)) best = { id: w.id, len: p.length };
    }
  }
  return best ? { kind: 'workspace', workspace: best.id } : { kind: 'unknown' };
}

/**
 * The workspace a page belongs to, or null for shared tools, global pages,
 * administrator pages and unknown addresses (those keep the current workspace).
 */
export function workspaceForPath(pathname: string): WorkspaceId | null {
  const o = ownerOfPath(pathname);
  return o.kind === 'workspace' ? o.workspace : null;
}

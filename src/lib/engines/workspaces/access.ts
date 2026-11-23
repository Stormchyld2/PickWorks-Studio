/**
 * Workspace access (Workspace Navigation, Stage A — approved 2026-11-23).
 *
 * One pure function decides, for every platform, whether a workspace appears
 * in a student's workspace dropdown. No screen hardcodes these rules. Three
 * independent checks, in order:
 *
 *   1. Implemented? From the workspace configuration. Nothing overrides it.
 *   2. Unlocked?    From administrator settings and the student's lesson
 *                   coverage only. Learning Studio is always unlocked.
 *   3. Shown?       The student's own "Show in Workspace Dropdown" switch.
 *
 * Access never writes anything. In particular it never creates lesson
 * completions, mastery records or XP: unlocking or opening a workspace is a
 * navigation decision only.
 */
import {
  DEFAULT_WORKSPACE,
  DEFAULT_WORKSPACE_UNLOCK,
  WORKSPACES,
  type WorkspaceDefinition,
  type WorkspaceId,
  type WorkspaceUnlockThresholds,
} from './config';

/** Administrator access settings (installation-wide). Students can't change these. */
export interface AdminWorkspaceSettings {
  /** "Unlock All Workspaces for Students". */
  unlockAll: boolean;
  /** "Automatic Learning Unlock". */
  automaticLearningUnlock: boolean;
  thresholds: WorkspaceUnlockThresholds;
}

export const DEFAULT_ADMIN_WORKSPACE_SETTINGS: AdminWorkspaceSettings = {
  unlockAll: false,
  automaticLearningUnlock: true,
  thresholds: { ...DEFAULT_WORKSPACE_UNLOCK },
};

/**
 * Lessons covered at one level. A lesson is covered when the student completed
 * it, or when their verified placement evidence covers every skill it teaches.
 * Lessons opened only through Open All Lessons are not covered. Coverage is
 * derived by the curriculum engine and never saved as a completion.
 */
export interface LevelCoverage {
  covered: number;
  total: number;
}

export interface WorkspaceAccessInput {
  admin: AdminWorkspaceSettings;
  /** Per-student overrides the administrator set (directly or via new-profile defaults). */
  studentGrants: readonly WorkspaceId[];
  coverage: { beginner: LevelCoverage; intermediate: LevelCoverage };
  /** The student's dropdown switches. A missing entry means shown. */
  shown: Partial<Record<WorkspaceId, boolean>>;
  /** Overridable for tests; defaults to the real configuration. */
  workspaces?: readonly WorkspaceDefinition[];
}

export type WorkspaceState = 'not-implemented' | 'locked' | 'hidden' | 'visible';
export type UnlockReason = 'always' | 'unlock-all' | 'student-grant' | 'learning-progress';

export interface WorkspaceAccess {
  id: WorkspaceId;
  state: WorkspaceState;
  /** Why the workspace is unlocked, or null when it isn't (or isn't implemented). */
  unlockedBy: UnlockReason | null;
  /**
   * True when Learning Studio is listed only because nothing else would be
   * visible. A student is never left without a workspace.
   */
  fallback: boolean;
}

/** Share covered at a level; a level with no lessons can't satisfy a threshold. */
export function coverageShare(c: LevelCoverage): number {
  if (c.total <= 0) return 0;
  return Math.min(1, Math.max(0, c.covered) / c.total);
}

export function meetsLearningThresholds(
  coverage: WorkspaceAccessInput['coverage'],
  thresholds: WorkspaceUnlockThresholds,
): boolean {
  return (
    coverage.beginner.total > 0 &&
    coverage.intermediate.total > 0 &&
    coverageShare(coverage.beginner) >= thresholds.beginnerLessons &&
    coverageShare(coverage.intermediate) >= thresholds.intermediateLessons
  );
}

function unlockReason(id: WorkspaceId, input: WorkspaceAccessInput): UnlockReason | null {
  if (id === DEFAULT_WORKSPACE) return 'always';
  if (input.admin.unlockAll) return 'unlock-all';
  if (input.studentGrants.includes(id)) return 'student-grant';
  if (input.admin.automaticLearningUnlock && meetsLearningThresholds(input.coverage, input.admin.thresholds)) {
    return 'learning-progress';
  }
  return null;
}

/** The state of every configured workspace for one student, in configuration order. */
export function workspaceAccess(input: WorkspaceAccessInput): WorkspaceAccess[] {
  const list = (input.workspaces ?? WORKSPACES).map((w): WorkspaceAccess => {
    if (!w.implemented) return { id: w.id, state: 'not-implemented', unlockedBy: null, fallback: false };
    const unlockedBy = unlockReason(w.id, input);
    if (!unlockedBy) return { id: w.id, state: 'locked', unlockedBy: null, fallback: false };
    const shown = input.shown[w.id] ?? true;
    return { id: w.id, state: shown ? 'visible' : 'hidden', unlockedBy, fallback: false };
  });
  if (!list.some((a) => a.state === 'visible')) {
    // Learning Studio can be hidden but never locked: if nothing else is
    // visible (for example Unlock All was turned off), it reappears.
    const ls = list.find((a) => a.id === DEFAULT_WORKSPACE);
    if (ls && ls.state === 'hidden') {
      ls.state = 'visible';
      ls.fallback = true;
    }
  }
  return list;
}

/** Workspaces listed in the dropdown, in configuration order. */
export function visibleWorkspaces(access: readonly WorkspaceAccess[]): WorkspaceId[] {
  return access.filter((a) => a.state === 'visible').map((a) => a.id);
}

/** Implemented and unlocked, whether shown or hidden. */
export function isAvailable(access: readonly WorkspaceAccess[], id: WorkspaceId): boolean {
  const a = access.find((x) => x.id === id);
  return !!a && (a.state === 'visible' || a.state === 'hidden');
}

/**
 * Whether the student may turn off the dropdown switch for a workspace. The
 * last visible workspace can't be hidden. Fallback visibility doesn't count as
 * the student's own choice, so hiding is checked against the real switches.
 */
export function canHide(access: readonly WorkspaceAccess[], id: WorkspaceId): boolean {
  const target = access.find((a) => a.id === id);
  if (!target || target.state !== 'visible' || target.fallback) return false;
  return access.some((a) => a.id !== id && a.state === 'visible');
}

/**
 * Where to go when the current workspace stops being visible (hidden by the
 * student, or no longer unlocked): Learning Studio if it's visible, otherwise
 * the next visible workspace in configuration order.
 */
export function fallbackWorkspace(access: readonly WorkspaceAccess[], from?: WorkspaceId): WorkspaceId {
  const visible = visibleWorkspaces(access);
  if (visible.includes(DEFAULT_WORKSPACE)) return DEFAULT_WORKSPACE;
  if (from) {
    const order = access.map((a) => a.id);
    const start = order.indexOf(from);
    for (let i = 1; i <= order.length; i++) {
      const id = order[(start + i) % order.length];
      if (visible.includes(id)) return id;
    }
  }
  return visible[0] ?? DEFAULT_WORKSPACE;
}

/**
 * The workspace to open after sign-in: the start-up choice (a workspace, or the
 * last one used), as long as it is visible; otherwise the fallback.
 */
export function startupWorkspace(
  access: readonly WorkspaceAccess[],
  prefs: { startup: WorkspaceId | 'last-used'; lastUsed: WorkspaceId | null },
): WorkspaceId {
  const wanted = prefs.startup === 'last-used' ? prefs.lastUsed : prefs.startup;
  if (wanted && visibleWorkspaces(access).includes(wanted)) return wanted;
  return fallbackWorkspace(access, wanted ?? undefined);
}

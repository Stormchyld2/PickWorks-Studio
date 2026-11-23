/**
 * Workspace access enforcement on navigation (Workspace Navigation, Stage B).
 *
 * Hiding a sidebar item is not access control. Every address a student opens
 * (typed or pasted, a link, back and forward, the start-up page) is checked
 * here before the page is shown. Pure and tested; the layout calls it.
 */
import { DEFAULT_WORKSPACE, ownerOfPath, workspaceById, type WorkspaceId } from './config';
import { fallbackWorkspace, isAvailable, type WorkspaceAccess } from './access';

export type GuardResult =
  | { allow: true; workspace: WorkspaceId | null }
  | { allow: false; workspace: WorkspaceId; redirect: string; message: string };

/**
 * Whether a signed-in student may open `pathname`.
 *
 * - Learning Studio pages, shared tools and global pages are always allowed.
 * - A page in another workspace is allowed only when that workspace is
 *   implemented and unlocked for this student (hidden-but-unlocked is fine:
 *   hiding is a navigation preference, not a lock).
 * - Until the student's access has loaded, other workspaces are refused
 *   (fail closed), never shown "just for a moment".
 *
 * `workspace` on an allowed result is the workspace the page belongs to, or
 * null for pages that keep the current workspace.
 */
export function guardPath(pathname: string, access: readonly WorkspaceAccess[] | null, current: WorkspaceId = DEFAULT_WORKSPACE): GuardResult {
  const owner = ownerOfPath(pathname);
  if (owner.kind !== 'workspace') return { allow: true, workspace: null };
  const id = owner.workspace;
  if (id === DEFAULT_WORKSPACE) return { allow: true, workspace: id };
  if (access && isAvailable(access, id)) return { allow: true, workspace: id };
  const to = access ? fallbackWorkspace(access, current === id ? undefined : current) : DEFAULT_WORKSPACE;
  const target = to === id ? DEFAULT_WORKSPACE : to;
  const name = workspaceById(id).name;
  const state = access?.find((a) => a.id === id)?.state;
  const message =
    state === 'not-implemented' || !access
      ? `${name} isn't available yet.`
      : `${name} isn't open for your profile yet. Your administrator decides which workspaces you can use.`;
  return { allow: false, workspace: target, redirect: workspaceById(target).home, message };
}

/**
 * The workspaces listed in the selector. Normally the visible ones. When the
 * student is in a workspace they have hidden but may still use (they followed
 * a link into it), it is listed too while they are there, so the selector
 * shows where they are. Their hide setting is not changed.
 */
export function selectorWorkspaces(access: readonly WorkspaceAccess[] | null, current: WorkspaceId): WorkspaceId[] {
  if (!access) return [DEFAULT_WORKSPACE];
  const visible = access.filter((a) => a.state === 'visible').map((a) => a.id);
  if (visible.includes(current) || !isAvailable(access, current)) return visible;
  return access.map((a) => a.id).filter((id) => id === current || visible.includes(id));
}

/**
 * Whether the student must leave the current workspace: it is no longer open
 * to them, or they have just hidden it (it was visible before this change).
 * Being in a workspace that was already hidden (reached by a link) is fine.
 */
export function mustLeaveWorkspace(access: readonly WorkspaceAccess[] | null, current: WorkspaceId, previouslyVisible: readonly WorkspaceId[]): boolean {
  if (!access || current === DEFAULT_WORKSPACE) return false;
  if (!isAvailable(access, current)) return true;
  const nowVisible = access.some((a) => a.id === current && a.state === 'visible');
  return !nowVisible && previouslyVisible.includes(current);
}

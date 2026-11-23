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

/**
 * The signed-in student's workspaces (Workspace Navigation, Stage B).
 *
 * Access comes only from the administrator's settings and the student's own
 * grants (read from the native core) plus lesson coverage. The student's
 * preferences only show or hide an available workspace and choose where to
 * start. Nothing here ever writes a lesson completion, mastery record or XP.
 */
import { goto } from '$app/navigation';
import { backend } from '$lib/services/backend';
import type { StudentWorkspaceAccess } from '$lib/services/core-client';
import { session } from '$lib/services/session';
import { DEFAULT_WORKSPACE, workspaceById, type WorkspaceId } from '$lib/engines/workspaces/config';
import { fallbackWorkspace, startupWorkspace, visibleWorkspaces, type WorkspaceAccess } from '$lib/engines/workspaces/access';
import { accessFrom } from '$lib/engines/workspaces/facts';
import { guardPath, mustLeaveWorkspace, selectorWorkspaces } from '$lib/engines/workspaces/navigation';
import { auth } from './auth.svelte';
import { preferences } from './preferences.svelte';

export { accessFrom };

class WorkspaceStore {
  current = $state<WorkspaceId>(DEFAULT_WORKSPACE);
  facts = $state<StudentWorkspaceAccess | null>(null);
  /** Set when the access facts couldn't be read: only Learning Studio is open. */
  loadError = $state<string | null>(null);
  /** Polite announcement for screen readers ("Switched to …"). */
  announcement = $state('');
  /** Shown when an address was refused. */
  notice = $state<string | null>(null);

  /** Access for every workspace, or null until loaded (other workspaces then stay closed). */
  get access(): WorkspaceAccess[] | null {
    try {
      return accessFrom(this.facts, preferences.value.workspace.shown);
    } catch {
      return null; // invalid settings: fail closed, Learning Studio only
    }
  }

  /** Workspaces in the selector, in order. Learning Studio when nothing is loaded. */
  get visible(): WorkspaceId[] {
    const a = this.access;
    return a ? visibleWorkspaces(a) : [DEFAULT_WORKSPACE];
  }

  /** Workspaces in the selector: the visible ones, plus the current one while the student is in a hidden one. */
  get listed(): WorkspaceId[] {
    return selectorWorkspaces(this.access, this.current);
  }

  /** Called after a student signs in (and preferences have loaded). Returns the start-up address. */
  async load(): Promise<string> {
    const token = auth.info?.token;
    this.facts = null;
    this.loadError = null;
    if (!token) return '/';
    try {
      this.facts = await backend.studentWorkspaceAccess(token);
    } catch (e) {
      this.loadError = e instanceof Error ? e.message : String(e);
    }
    const a = this.access;
    const w = preferences.value.workspace;
    this.current = a ? startupWorkspace(a, { startup: w.startup, lastUsed: w.lastUsed }) : DEFAULT_WORKSPACE;
    return workspaceById(this.current).home;
  }

  reset(): void {
    this.facts = null;
    this.loadError = null;
    this.current = DEFAULT_WORKSPACE;
    this.notice = null;
    this.announcement = '';
  }

  /** The guard every navigation goes through. */
  guard(pathname: string) {
    return guardPath(pathname, this.access, this.current);
  }

  /**
   * Keeps `current` in step with the page: opening a page that belongs to a
   * workspace makes it current and remembers it as last used. Shared tools and
   * global pages keep the current workspace.
   */
  follow(pathname: string): void {
    const g = this.guard(pathname);
    if (g.allow && g.workspace && g.workspace !== this.current) {
      this.current = g.workspace;
      void this.rememberLastUsed(g.workspace);
    }
  }

  private async rememberLastUsed(id: WorkspaceId): Promise<void> {
    if (!preferences.loaded || preferences.value.workspace.lastUsed === id) return;
    await preferences.update((p) => (p.workspace.lastUsed = id));
  }

  /**
   * Switches workspace from the selector: saves pending work first (the same
   * checkpoint used when the app goes to the background), then opens the new
   * workspace's home page. Returns the unsaved items if saving failed and the
   * student hasn't chosen to switch anyway.
   */
  async switchTo(id: WorkspaceId, force = false): Promise<{ switched: boolean; unsaved: string[] }> {
    if (!this.listed.includes(id)) return { switched: false, unsaved: [] };
    session.activity();
    if (id === this.current) {
      await goto(workspaceById(id).home);
      return { switched: true, unsaved: [] };
    }
    const report = await session.checkpoint();
    if (report.unsaved.length && !force) return { switched: false, unsaved: report.unsaved };
    this.current = id;
    void this.rememberLastUsed(id);
    await goto(workspaceById(id).home);
    this.announcement = `Switched to ${workspaceById(id).name}`;
    return { switched: true, unsaved: [] };
  }

  /**
   * After the student hides workspaces or access changes: if the current
   * workspace is no longer open, or the student has just hidden it, move to
   * Learning Studio (or the next visible workspace). A workspace that was
   * already hidden and reached by a link stays current. Returns the new home
   * address when a move is needed.
   */
  settle(previouslyVisible: readonly WorkspaceId[]): string | null {
    const a = this.access;
    if (!a || !mustLeaveWorkspace(a, this.current, previouslyVisible)) return null;
    this.current = fallbackWorkspace(a, this.current);
    void this.rememberLastUsed(this.current);
    return workspaceById(this.current).home;
  }
}

export const workspace = new WorkspaceStore();

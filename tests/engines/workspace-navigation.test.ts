/**
 * Workspace Navigation Stage B: access enforcement on every navigation path,
 * the sidebar and Tools group, the selector's keyboard handling and position,
 * and the administrator/student permission split in the browser preview core.
 */
import { describe, expect, it } from 'vitest';
import { WORKSPACES, type WorkspaceDefinition } from '$lib/engines/workspaces/config';
import { DEFAULT_ADMIN_WORKSPACE_SETTINGS, workspaceAccess, type WorkspaceAccessInput } from '$lib/engines/workspaces/access';
import { guardPath } from '$lib/engines/workspaces/navigation';
import { accessFrom, NO_LESSONS } from '$lib/engines/workspaces/facts';
import { LEARNING_STUDIO_NAV, SECONDARY_NAV, TOOLS_NAV, activeHref, allowedFor, workspaceNav } from '$lib/components/navigation/nav-items';
import { COLLAPSED_POPOVER_WIDTH, POPOVER_MARGIN, popoverPosition } from '$lib/components/navigation/popover';
import { listboxKey } from '$lib/components/navigation/listbox';
import { createPreviewCore } from '$lib/services/preview-core';
import type { StudentWorkspaceAccess } from '$lib/services/core-client';

const ALL_BUILT: WorkspaceDefinition[] = WORKSPACES.map((w) => ({ ...w, implemented: true }));
const facts = (over: Partial<StudentWorkspaceAccess> = {}): StudentWorkspaceAccess => ({
  unlockAll: false,
  automaticLearningUnlock: true,
  beginnerLessonsPercent: 80,
  intermediateLessonsPercent: 50,
  grants: [],
  ...over,
});
function built(over: Partial<WorkspaceAccessInput> = {}) {
  return workspaceAccess({
    admin: { ...DEFAULT_ADMIN_WORKSPACE_SETTINGS },
    studentGrants: [],
    coverage: { beginner: { covered: 0, total: 10 }, intermediate: { covered: 0, total: 10 } },
    shown: {},
    workspaces: ALL_BUILT,
    ...over,
  });
}

describe('access enforcement on navigation', () => {
  const real = accessFrom(facts({ unlockAll: true, grants: ['play-create', 'reference'] }), {});

  it('always allows Learning Studio pages, shared tools and global pages', () => {
    for (const p of ['/', '/learn', '/practice', '/fretboard', '/progress', '/print', '/tuner', '/practice/metronome', '/settings', '/help', '/about']) {
      expect(guardPath(p, real).allow, p).toBe(true);
      expect(guardPath(p, null).allow, `${p} before access loads`).toBe(true);
    }
  });

  it('refuses typed or linked addresses in workspaces that are not built, whatever the administrator set', () => {
    for (const p of ['/create', '/create/songbook', '/reference', '/reference/maintenance']) {
      const g = guardPath(p, real);
      expect(g.allow, p).toBe(false);
      if (!g.allow) {
        expect(g.redirect).toBe('/');
        expect(g.message).toMatch(/isn't available yet/);
      }
    }
  });

  it('fails closed until access has loaded (start-up, history restored before facts arrive)', () => {
    const g = guardPath('/create/songbook', null, 'learning-studio');
    expect(g).toMatchObject({ allow: false, redirect: '/', workspace: 'learning-studio' });
  });

  it('refuses a locked workspace with a message that the administrator decides', () => {
    const g = guardPath('/create', built());
    expect(g.allow).toBe(false);
    if (!g.allow) expect(g.message).toMatch(/administrator decides/);
  });

  it('allows an unlocked workspace, including one the student has hidden', () => {
    const granted = built({ studentGrants: ['play-create'] });
    expect(guardPath('/create/songbook', granted)).toEqual({ allow: true, workspace: 'play-create' });
    const hidden = built({ studentGrants: ['play-create'], shown: { 'play-create': false } });
    expect(guardPath('/create', hidden).allow).toBe(true);
  });

  it('sends a refused address to the current workspace if it is still open, otherwise Learning Studio', () => {
    const a = built({ studentGrants: ['reference'], shown: { 'learning-studio': false } });
    const g = guardPath('/create', a, 'reference');
    expect(g).toMatchObject({ allow: false, workspace: 'reference', redirect: '/reference' });
    const back = guardPath('/create', built(), 'learning-studio');
    expect(back).toMatchObject({ allow: false, redirect: '/' });
  });

  it('never lets a student into the administration area, and the administrator has no student pages', () => {
    expect(allowedFor('student', '/admin')).toBe(false);
    expect(allowedFor('student', '/admin/settings')).toBe(false);
    expect(allowedFor('admin', '/learn')).toBe(false);
    expect(allowedFor('admin', '/admin/students')).toBe(true);
  });
});

describe('access facts from the native core', () => {
  it('keeps only Learning Studio open with the shipped configuration', () => {
    const a = accessFrom(facts({ unlockAll: true, grants: ['play-create'] }), {})!;
    expect(a.map((x) => x.state)).toEqual(['visible', 'not-implemented', 'not-implemented']);
  });

  it('is null until loaded and refuses out-of-range thresholds instead of guessing', () => {
    expect(accessFrom(null, {})).toBeNull();
    expect(() => accessFrom(facts({ beginnerLessonsPercent: 101 }), {})).toThrow();
    expect(() => accessFrom(facts({ intermediateLessonsPercent: -1 }), {})).toThrow();
  });

  it('ignores grant ids this build does not know', () => {
    expect(() => accessFrom(facts({ grants: ['from-the-future'] }), {})).not.toThrow();
  });

  it('cannot unlock by learning before the curriculum reports lessons', () => {
    expect(NO_LESSONS.beginner.total).toBe(0);
    expect(NO_LESSONS.intermediate.total).toBe(0);
  });
});

describe('sidebar', () => {
  it('uses the approved Learning Studio names and order', () => {
    expect(LEARNING_STUDIO_NAV.map((n) => n.label)).toEqual(['Dashboard', 'My Courses', 'Practice', 'Fretboard Explorer', 'My Progress', 'Print Materials']);
    expect(LEARNING_STUDIO_NAV.map((n) => n.href)).toEqual(['/', '/learn', '/practice', '/fretboard', '/progress', '/print']);
    expect(workspaceNav('learning-studio')).toBe(LEARNING_STUDIO_NAV);
  });

  it('keeps the existing addresses, so saved links and history still work', () => {
    const hrefs = [...LEARNING_STUDIO_NAV, ...TOOLS_NAV, ...SECONDARY_NAV].map((n) => n.href);
    for (const h of ['/', '/learn', '/practice', '/fretboard', '/progress', '/print', '/tuner', '/practice/metronome', '/settings', '/help', '/about']) {
      expect(hrefs).toContain(h);
    }
  });

  it('puts Tuner and Metronome in the Tools group, not the workspace list', () => {
    expect(TOOLS_NAV.map((n) => n.label)).toEqual(['Tuner', 'Metronome']);
    expect(LEARNING_STUDIO_NAV.some((n) => n.href === '/tuner')).toBe(false);
  });

  it('hides Achievements until Phase 2, and has no items for workspaces that are not built', () => {
    expect([...LEARNING_STUDIO_NAV, ...TOOLS_NAV, ...SECONDARY_NAV].some((n) => /achievement/i.test(n.label))).toBe(false);
    expect(workspaceNav('play-create')).toEqual([]);
    expect(workspaceNav('reference')).toEqual([]);
  });

  it('highlights exactly one item, the most specific match', () => {
    const hrefs = [...LEARNING_STUDIO_NAV, ...TOOLS_NAV, ...SECONDARY_NAV].map((n) => n.href);
    expect(activeHref(hrefs, '/practice/metronome')).toBe('/practice/metronome');
    expect(activeHref(hrefs, '/practice')).toBe('/practice');
    expect(activeHref(hrefs, '/practice/session/3')).toBe('/practice');
    expect(activeHref(hrefs, '/')).toBe('/');
    expect(activeHref(hrefs, '/learn/lesson-1')).toBe('/learn');
    expect(activeHref(hrefs, '/nowhere')).toBeNull();
  });
});

describe('workspace selector keyboard', () => {
  it('moves with the arrow keys, wrapping at both ends, and jumps with Home and End', () => {
    expect(listboxKey('ArrowDown', 0, 3)).toEqual({ kind: 'move', index: 1 });
    expect(listboxKey('ArrowDown', 2, 3)).toEqual({ kind: 'move', index: 0 });
    expect(listboxKey('ArrowUp', 0, 3)).toEqual({ kind: 'move', index: 2 });
    expect(listboxKey('Home', 2, 3)).toEqual({ kind: 'move', index: 0 });
    expect(listboxKey('End', 0, 3)).toEqual({ kind: 'move', index: 2 });
  });

  it('chooses with Enter or Space and closes with Escape (focus back) or Tab (focus moves on)', () => {
    expect(listboxKey('Enter', 1, 3)).toEqual({ kind: 'choose', index: 1 });
    expect(listboxKey(' ', 0, 1)).toEqual({ kind: 'choose', index: 0 });
    expect(listboxKey('Escape', 0, 1)).toEqual({ kind: 'close', returnFocus: true });
    expect(listboxKey('Tab', 0, 1)).toEqual({ kind: 'close', returnFocus: false });
    expect(listboxKey('a', 0, 3)).toBeNull();
  });

  it('works with one workspace, as today', () => {
    expect(listboxKey('ArrowDown', 0, 1)).toEqual({ kind: 'move', index: 0 });
    expect(listboxKey('ArrowUp', 0, 1)).toEqual({ kind: 'move', index: 0 });
  });
});

describe('workspace selector position', () => {
  const rect = (top: number, left: number, width: number, height: number) => ({ top, left, width, right: left + width, bottom: top + height });
  const vp = { width: 1280, height: 800 };

  it('opens under the selector at its width in the expanded sidebar', () => {
    expect(popoverPosition(rect(90, 16, 248, 56), vp, false, 120)).toEqual({ top: 152, left: 16, width: 248 });
  });

  it('opens beside the collapsed rail, level with the button', () => {
    expect(popoverPosition(rect(90, 12, 56, 56), vp, true, 120)).toEqual({ top: 90, left: 80, width: COLLAPSED_POPOVER_WIDTH });
  });

  it('opens above when there is no room below, and stays inside a short window', () => {
    const p = popoverPosition(rect(700, 16, 248, 56), vp, false, 200);
    expect(p.top).toBe(700 - 6 - 200);
    const tiny = popoverPosition(rect(90, 12, 56, 56), { width: 320, height: 240 }, true, 400);
    expect(tiny.top).toBe(POPOVER_MARGIN);
    expect(tiny.left + tiny.width).toBeLessThanOrEqual(320 - POPOVER_MARGIN);
    expect(tiny.left).toBeGreaterThanOrEqual(POPOVER_MARGIN);
  });

  it('never goes past the window edges at any size', () => {
    for (const w of [300, 480, 800, 1920]) {
      for (const h of [200, 500, 1080]) {
        for (const collapsed of [true, false]) {
          const p = popoverPosition(rect(Math.min(90, h - 60), 12, collapsed ? 56 : 248, 56), { width: w, height: h }, collapsed, 150);
          expect(p.left).toBeGreaterThanOrEqual(POPOVER_MARGIN);
          expect(p.left + p.width).toBeLessThanOrEqual(w - POPOVER_MARGIN);
          expect(p.top).toBeGreaterThanOrEqual(POPOVER_MARGIN);
        }
      }
    }
  });
});

describe('administrator and student permissions (preview core)', () => {
  async function setup() {
    const core = createPreviewCore();
    await core.setupAdmin('Admin', 'admin-pass-1');
    const admin = await core.signInAdmin('admin-pass-1');
    const a = await core.adminCreateStudent(admin.token, 'Avery', 'temporary1');
    const b = await core.adminCreateStudent(admin.token, 'Blake', 'temporary1');
    return { core, admin, a, b };
  }

  it('starts with the safe defaults', async () => {
    const { core, admin } = await setup();
    expect(await core.adminWorkspaceSettings(admin.token)).toEqual({ unlockAll: false, automaticLearningUnlock: true, beginnerLessonsPercent: 80, intermediateLessonsPercent: 50, newProfileWorkspaces: [] });
  });

  it('refuses thresholds above 100%, Learning Studio as a grant, unknown ids and duplicates', async () => {
    const { core, admin, a } = await setup();
    const base = await core.adminWorkspaceSettings(admin.token);
    await expect(core.adminSetWorkspaceSettings(admin.token, { ...base, beginnerLessonsPercent: 101 })).rejects.toThrow();
    await expect(core.adminSetWorkspaceSettings(admin.token, { ...base, newProfileWorkspaces: ['learning-studio'] })).rejects.toThrow();
    await expect(core.adminSetStudentWorkspaces(admin.token, a, ['nope'])).rejects.toThrow();
    await expect(core.adminSetStudentWorkspaces(admin.token, a, ['reference', 'reference'])).rejects.toThrow();
  });

  it('gives a per-student grant to that student only, and audits it', async () => {
    const { core, admin, a, b } = await setup();
    await core.adminSetStudentWorkspaces(admin.token, a, ['reference']);
    const list = await core.adminListStudents(admin.token);
    expect(list.find((s) => s.id === a)?.workspaceGrants).toEqual(['reference']);
    expect(list.find((s) => s.id === b)?.workspaceGrants ?? []).toEqual([]);
    const audit = await core.adminRecentAudit(admin.token, 5);
    expect(audit[0]).toMatchObject({ action: 'student-workspaces-changed', studentId: a });
  });

  it('copies the new-profile workspaces only into profiles created afterwards', async () => {
    const { core, admin, a } = await setup();
    const base = await core.adminWorkspaceSettings(admin.token);
    await core.adminSetWorkspaceSettings(admin.token, { ...base, newProfileWorkspaces: ['play-create'] });
    const c = await core.adminCreateStudent(admin.token, 'Casey', 'temporary1');
    const list = await core.adminListStudents(admin.token);
    expect(list.find((s) => s.id === c)?.workspaceGrants).toEqual(['play-create']);
    expect(list.find((s) => s.id === a)?.workspaceGrants ?? []).toEqual([]);
  });

  it('lets a student read only their own access, and never change it', async () => {
    const { core, admin, a } = await setup();
    await core.adminSetStudentWorkspaces(admin.token, a, ['reference']);
    await core.signOut(admin.token);
    const s = await core.signInStudent(a, 'temporary1');
    await core.changePassword(s.token, 'temporary1', 'student-pass');
    const me = await core.studentWorkspaceAccess(s.token);
    expect(me.grants).toEqual(['reference']);
    expect(me).not.toHaveProperty('newProfileWorkspaces');
    await expect(core.adminWorkspaceSettings(s.token)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(core.adminSetWorkspaceSettings(s.token, { ...me, newProfileWorkspaces: [] })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(core.adminSetStudentWorkspaces(s.token, a, ['play-create'])).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('never writes student records when access changes', async () => {
    const { core, admin, a } = await setup();
    const base = await core.adminWorkspaceSettings(admin.token);
    await core.adminSetWorkspaceSettings(admin.token, { ...base, unlockAll: true });
    await core.adminSetStudentWorkspaces(admin.token, a, ['play-create', 'reference']);
    await core.signOut(admin.token);
    const s = await core.signInStudent(a, 'temporary1');
    await core.changePassword(s.token, 'temporary1', 'student-pass');
    expect(await core.readRecord(s.token, 'preferences')).toBeNull();
    expect(await core.readLog(s.token, 'attempts')).toEqual([]);
    expect(await core.readLog(s.token, 'mastery-events')).toEqual([]);
  });
});

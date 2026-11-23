import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKSPACE,
  WORKSPACES,
  ownerOfPath,
  workspaceForPath,
  type WorkspaceDefinition,
} from '$lib/engines/workspaces/config';
import {
  DEFAULT_ADMIN_WORKSPACE_SETTINGS,
  canHide,
  fallbackWorkspace,
  meetsLearningThresholds,
  startupWorkspace,
  visibleWorkspaces,
  workspaceAccess,
  type WorkspaceAccessInput,
} from '$lib/engines/workspaces/access';
import { ADMIN_PRIMARY_NAV, ADMIN_SECONDARY_NAV, PRIMARY_NAV, SECONDARY_NAV } from '$lib/components/navigation/nav-items';
import {
  PREFERENCES,
  PREFERENCES_VERSION,
  decodeRecord,
  defaultPreferences,
  migratePreferencesV1toV2,
} from '$lib/engines/student/records';

/** Every workspace implemented, for exercising the unlock rules before Phase 2 exists. */
const ALL_BUILT: WorkspaceDefinition[] = WORKSPACES.map((w) => ({ ...w, implemented: true }));
const none = { covered: 0, total: 10 };

function input(over: Partial<WorkspaceAccessInput> = {}): WorkspaceAccessInput {
  return {
    admin: { ...DEFAULT_ADMIN_WORKSPACE_SETTINGS, thresholds: { ...DEFAULT_ADMIN_WORKSPACE_SETTINGS.thresholds } },
    studentGrants: [],
    coverage: { beginner: none, intermediate: none },
    shown: {},
    workspaces: ALL_BUILT,
    ...over,
  };
}
const states = (i: WorkspaceAccessInput) => Object.fromEntries(workspaceAccess(i).map((a) => [a.id, a.state]));

describe('route ownership', () => {
  it('keeps every current address in Learning Studio, a shared tool, global or admin', () => {
    expect(workspaceForPath('/')).toBe('learning-studio');
    expect(workspaceForPath('/learn')).toBe('learning-studio');
    expect(workspaceForPath('/practice')).toBe('learning-studio');
    expect(workspaceForPath('/fretboard')).toBe('learning-studio');
    expect(workspaceForPath('/progress')).toBe('learning-studio');
    expect(workspaceForPath('/print')).toBe('learning-studio'); // until Reference opens (decision 3)
    expect(ownerOfPath('/tuner')).toEqual({ kind: 'tool' });
    expect(ownerOfPath('/practice/metronome')).toEqual({ kind: 'tool' });
    expect(ownerOfPath('/settings')).toEqual({ kind: 'global' });
    expect(ownerOfPath('/admin/students')).toEqual({ kind: 'admin' });
    expect(workspaceForPath('/create/songbook')).toBe('play-create');
    expect(workspaceForPath('/reference/maintenance')).toBe('reference');
  });

  it('does not treat look-alike prefixes as owned', () => {
    expect(ownerOfPath('/learning')).toEqual({ kind: 'unknown' });
    expect(ownerOfPath('/administration')).toEqual({ kind: 'unknown' });
  });

  it('gives every sidebar item and every route folder an owner', () => {
    for (const item of [...PRIMARY_NAV, ...SECONDARY_NAV, ...ADMIN_PRIMARY_NAV, ...ADMIN_SECONDARY_NAV]) {
      expect(ownerOfPath(item.href).kind, item.href).not.toBe('unknown');
    }
    const pages = Object.keys(import.meta.glob('/src/routes/**/+page.svelte'));
    const routes = pages.map((f) => f.replace('/src/routes', '').replace(/\/\+page\.svelte$/, '') || '/');
    expect(routes.length).toBeGreaterThan(5);
    for (const r of routes) expect(ownerOfPath(r).kind, r).not.toBe('unknown');
  });

  it('ships only Learning Studio as implemented', () => {
    expect(WORKSPACES.filter((w) => w.implemented).map((w) => w.id)).toEqual(['learning-studio']);
  });
});

describe('workspace access', () => {
  it('shows only Learning Studio with the real configuration, whatever the administrator sets', () => {
    const real = input({ workspaces: undefined, admin: { ...DEFAULT_ADMIN_WORKSPACE_SETTINGS, unlockAll: true }, studentGrants: ['play-create', 'reference'] });
    expect(states(real)).toEqual({ 'learning-studio': 'visible', 'play-create': 'not-implemented', reference: 'not-implemented' });
  });

  it('always unlocks Learning Studio and locks the others by default', () => {
    expect(states(input())).toEqual({ 'learning-studio': 'visible', 'play-create': 'locked', reference: 'locked' });
  });

  it('unlocks through Unlock All, a per-student grant, or learning coverage', () => {
    const all = workspaceAccess(input({ admin: { ...DEFAULT_ADMIN_WORKSPACE_SETTINGS, unlockAll: true } }));
    expect(all.map((a) => a.unlockedBy)).toEqual(['always', 'unlock-all', 'unlock-all']);
    const grant = workspaceAccess(input({ studentGrants: ['reference'] }));
    expect(grant.map((a) => a.state)).toEqual(['visible', 'locked', 'visible']);
    expect(grant[2].unlockedBy).toBe('student-grant');
    const earned = workspaceAccess(input({ coverage: { beginner: { covered: 8, total: 10 }, intermediate: { covered: 5, total: 10 } } }));
    expect(earned.map((a) => a.unlockedBy)).toEqual(['always', 'learning-progress', 'learning-progress']);
  });

  it('needs both thresholds, and respects Automatic Learning Unlock being off', () => {
    const t = DEFAULT_ADMIN_WORKSPACE_SETTINGS.thresholds;
    expect(meetsLearningThresholds({ beginner: { covered: 8, total: 10 }, intermediate: { covered: 4, total: 10 } }, t)).toBe(false);
    expect(meetsLearningThresholds({ beginner: { covered: 7, total: 10 }, intermediate: { covered: 10, total: 10 } }, t)).toBe(false);
    expect(meetsLearningThresholds({ beginner: { covered: 0, total: 0 }, intermediate: { covered: 0, total: 0 } }, t)).toBe(false);
    const off = input({
      admin: { ...DEFAULT_ADMIN_WORKSPACE_SETTINGS, automaticLearningUnlock: false },
      coverage: { beginner: { covered: 10, total: 10 }, intermediate: { covered: 10, total: 10 } },
    });
    expect(states(off)['play-create']).toBe('locked');
  });

  it('uses configurable thresholds', () => {
    const custom = input({
      admin: { ...DEFAULT_ADMIN_WORKSPACE_SETTINGS, thresholds: { beginnerLessons: 0.5, intermediateLessons: 0 } },
      coverage: { beginner: { covered: 5, total: 10 }, intermediate: { covered: 0, total: 10 } },
    });
    expect(states(custom)['play-create']).toBe('visible');
  });

  it('lets a student hide an available workspace but never lock it', () => {
    const i = input({ admin: { ...DEFAULT_ADMIN_WORKSPACE_SETTINGS, unlockAll: true }, shown: { 'play-create': false } });
    const a = workspaceAccess(i);
    expect(a.find((x) => x.id === 'play-create')).toMatchObject({ state: 'hidden', unlockedBy: 'unlock-all' });
    // A hidden-but-locked workspace stays locked: the switch can't unlock it either.
    expect(states(input({ shown: { reference: true } })).reference).toBe('locked');
  });

  it('brings Learning Studio back when nothing else would be visible', () => {
    const a = workspaceAccess(input({ shown: { 'learning-studio': false } }));
    expect(a[0]).toMatchObject({ id: 'learning-studio', state: 'visible', fallback: true });
    expect(canHide(a, 'learning-studio')).toBe(false);
  });

  it('allows hiding Learning Studio while another workspace is visible', () => {
    const i = input({ studentGrants: ['play-create'], shown: { 'learning-studio': false } });
    const a = workspaceAccess(i);
    expect(visibleWorkspaces(a)).toEqual(['play-create']);
    expect(canHide(a, 'play-create')).toBe(false); // the last visible one
    const both = workspaceAccess(input({ studentGrants: ['play-create'] }));
    expect(canHide(both, 'learning-studio')).toBe(true);
  });

  it('never writes anything: the input is left exactly as it was', () => {
    const i = input({ studentGrants: ['play-create'], shown: { 'learning-studio': false } });
    const before = structuredClone({ ...i, workspaces: undefined });
    workspaceAccess(i);
    expect({ ...i, workspaces: undefined }).toEqual(before);
  });
});

describe('start-up and fallback', () => {
  const unlocked = input({ admin: { ...DEFAULT_ADMIN_WORKSPACE_SETTINGS, unlockAll: true } });

  it('opens the start-up choice or the last one used when visible', () => {
    const a = workspaceAccess(unlocked);
    expect(startupWorkspace(a, { startup: 'reference', lastUsed: null })).toBe('reference');
    expect(startupWorkspace(a, { startup: 'last-used', lastUsed: 'play-create' })).toBe('play-create');
    expect(startupWorkspace(a, { startup: 'last-used', lastUsed: null })).toBe(DEFAULT_WORKSPACE);
  });

  it('falls back to Learning Studio, or the next visible workspace when it is hidden', () => {
    const locked = workspaceAccess(input());
    expect(startupWorkspace(locked, { startup: 'play-create', lastUsed: null })).toBe('learning-studio');
    const lsHidden = workspaceAccess(input({ ...unlocked, shown: { 'learning-studio': false, 'play-create': false } }));
    expect(fallbackWorkspace(lsHidden, 'play-create')).toBe('reference');
  });
});

describe('preferences version 2', () => {
  it('upgrades version 1 preferences without changing any saved setting', () => {
    const v1 = { display: { leftHanded: true, textSize: 'large' }, practice: { metronomeBpm: 120 } };
    const p = decodeRecord(PREFERENCES, { schemaVersion: 1, data: v1 })!;
    expect(PREFERENCES_VERSION).toBe(2);
    expect(p.display.leftHanded).toBe(true);
    expect(p.display.textSize).toBe('large');
    expect(p.practice.metronomeBpm).toBe(120);
    expect(p.workspace).toEqual({ startup: 'learning-studio', lastUsed: null, sidebarCollapsed: false, shown: {} });
    expect(migratePreferencesV1toV2(null)).toEqual({ workspace: p.workspace });
  });

  it('keeps no access settings in the student preferences', () => {
    const keys = Object.keys(defaultPreferences().workspace).sort();
    expect(keys).toEqual(['lastUsed', 'shown', 'sidebarCollapsed', 'startup']);
    const sneaky = decodeRecord(PREFERENCES, {
      schemaVersion: 2,
      data: { workspace: { unlockAll: true, grants: ['play-create'], shown: { reference: true } } },
    })!;
    expect(sneaky.workspace).not.toHaveProperty('unlockAll');
    expect(sneaky.workspace).not.toHaveProperty('grants');
  });

  it('drops workspace ids a newer build may have saved instead of refusing the preferences', () => {
    const p = decodeRecord(PREFERENCES, {
      schemaVersion: 2,
      data: { workspace: { startup: 'future-space', lastUsed: 'future-space', shown: { 'future-space': false, reference: false, 'play-create': 'yes' } } },
    })!;
    expect(p.workspace.startup).toBe('learning-studio');
    expect(p.workspace.lastUsed).toBeNull();
    expect(p.workspace.shown).toEqual({ reference: false });
  });

  it('refuses preferences saved by a newer version', () => {
    expect(() => decodeRecord(PREFERENCES, { schemaVersion: 3, data: {} })).toThrow(/newer version/);
  });
});

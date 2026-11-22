import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fresh app state per test: the auth store, session and browser-preview core.
async function app() {
  vi.resetModules();
  const { auth } = await import('../../src/lib/stores/auth.svelte');
  const { preview } = await import('../../src/lib/services/backend');
  const { session } = await import('../../src/lib/services/session');
  return { auth, preview: preview!, session };
}

describe('account screens flow', () => {
  beforeEach(() => vi.useRealTimers());

  it('first run goes to setup, then the profile selector, never straight into a profile', async () => {
    const { auth } = await app();
    await auth.init();
    expect(auth.screen.name).toBe('setup');
    const key = await auth.setupAdmin('Jason', 'admin-pass-1');
    expect(key).toMatch(/^[A-Z0-9]{5}(-[A-Z0-9]{5}){4}$/);
    await auth.showProfiles();
    expect(auth.screen.name).toBe('profiles');
    expect(auth.info).toBeNull();
  });

  it('a temporary password must be changed before anything else opens', async () => {
    const { auth, preview } = await app();
    await preview.setupAdmin('Jason', 'admin-pass-1');
    const admin = await preview.signInAdmin('admin-pass-1');
    const id = await preview.adminCreateStudent(admin.token, 'Sam', 'temporary1');
    await preview.signOut(admin.token);
    await auth.init();
    auth.choose(auth.profiles.find((p) => p.id === id)!);
    await auth.signIn('temporary1');
    expect(auth.screen.name).toBe('change-password');
    await expect(auth.data!.preferences()).rejects.toMatchObject({ code: 'password-change-required' });
    await auth.changePassword('temporary1', 'sams-own-pass');
    expect(auth.screen.name).toBe('app');
    expect((await auth.data!.preferences()).tuner.a4).toBe(440);
  });

  it('wrong passwords are refused and the delay is reported to the screen', async () => {
    const { auth, preview } = await app();
    await preview.seed();
    await auth.init();
    auth.choose(auth.profiles[0]);
    await expect(auth.signIn('nope-nope')).rejects.toMatchObject({ code: 'wrong-password' });
    await expect(auth.signIn('nope-nope')).rejects.toMatchObject({ code: 'wrong-password' });
    await expect(auth.signIn('nope-nope')).rejects.toMatchObject({ code: 'throttled', retryAfterSecs: 30 });
    expect(auth.info).toBeNull();
  });

  it('the idle limit returns to the profile selector and ends the old token', async () => {
    vi.useFakeTimers({ now: 1_795_262_400_000 });
    const { auth, preview, session } = await app();
    await preview.seed();
    await auth.init();
    auth.choose('admin');
    await auth.signIn('admin-pass-1');
    const token = auth.info!.token;
    expect(auth.screen.name).toBe('app');
    vi.advanceTimersByTime(5 * 60_000);
    await session.tick();
    await vi.waitFor(() => expect(auth.screen.name).toBe('profiles'));
    expect(auth.lastSignOut?.reason).toBe('idle');
    await expect(preview.adminListStudents(token)).rejects.toMatchObject({ code: 'no-session' });
  });

  it('switching profile ends the previous student session first', async () => {
    const { auth, preview } = await app();
    await preview.seed();
    await auth.init();
    const [jamie, alex] = auth.profiles;
    auth.choose(jamie);
    await auth.signIn('student-pass');
    const old = auth.data!;
    await auth.signOut('manual');
    auth.choose(alex);
    await auth.signIn('student-pass');
    await expect(old.saveCheckpoint({ kind: 'lesson', refId: 'l1', state: {} })).rejects.toMatchObject({ code: 'no-session' });
    expect(auth.info?.displayName).toBe('Alex');
  });

  it("keeps each student's settings separate and applies them at sign-in", async () => {
    const { auth, preview } = await app();
    const { preferences } = await import('../../src/lib/stores/preferences.svelte');
    const { tuner } = await import('../../src/lib/stores/tuner.svelte');
    await preview.seed();
    await auth.init();
    const [jamie, alex] = auth.profiles;
    auth.choose(jamie);
    await auth.signIn('student-pass');
    await preferences.load();
    await preferences.update((p) => ((p.tuner.a4 = 442), (p.display.leftHanded = true)));
    expect(tuner.a4).toBe(442);
    await auth.signOut('manual', true);
    preferences.reset();
    auth.choose(alex);
    await auth.signIn('student-pass');
    await preferences.load();
    expect(preferences.value.display.leftHanded).toBe(false);
    expect(tuner.a4).toBe(440);
    await auth.signOut('manual', true);
    auth.choose(jamie);
    await auth.signIn('student-pass');
    await preferences.load();
    expect(preferences.value.tuner.a4).toBe(442);
    expect(auth.shouldConfirmSignOut()).toBe(true);
  });

  it('copying an Everything backup to USB needs the admin password; student copies do not', async () => {
    const { preview } = await app();
    await preview.setupAdmin('Jason', 'admin-pass-1');
    const t = (await preview.signInAdmin('admin-pass-1')).token;
    const id = await preview.adminCreateStudent(t, 'Sam', 'temporary1');
    const student = await preview.adminBackupStudent(t, id);
    const all = await preview.adminBackupInstallation(t);
    expect(await preview.adminExportBackup(t, student)).toContain(student);
    await expect(preview.adminExportBackup(t, all)).rejects.toMatchObject({ code: 'wrong-password' });
    expect(await preview.adminExportBackup(t, all, 'admin-pass-1')).toContain(all);
    const { friendlyError } = await import('../../src/lib/components/account/errors');
    const { CoreError } = await import('../../src/lib/services/core-client');
    expect(friendlyError(new CoreError('corrupt', 'damaged file: x'))).toMatch(/Nothing was changed/);
    expect(friendlyError(new CoreError('invalid-data', "invalid data: That folder isn't a PickWorks Studio backup."))).toBe("That folder isn't a PickWorks Studio backup.");
  });

  it('a student can create their own profile, unless the administrator turned it off', async () => {
    const { auth, preview } = await app();
    await preview.setupAdmin('Jason', 'admin-pass-1');
    await auth.init();
    expect(auth.screen.name).toBe('profiles');
    expect(auth.selfRegistration).toBe(true);
    auth.startRegistration();
    await expect(auth.register('Kai', 'short', null)).rejects.toMatchObject({ code: 'weak-password' });
    await auth.register('Kai', 'kai-pass-111', null);
    expect(auth.screen.name).toBe('app');
    expect(auth.info?.principal.kind).toBe('student');
    expect(auth.isAdmin).toBe(false);
    await auth.signOut('manual', true);
    const t = (await preview.signInAdmin('admin-pass-1')).token;
    await preview.adminSetSelfRegistration(t, false);
    await preview.signOut(t);
    await auth.showProfiles();
    expect(auth.selfRegistration).toBe(false);
    await expect(preview.registerStudent('Lee', 'lee-pass-111', null)).rejects.toMatchObject({ code: 'forbidden' });
  });
});

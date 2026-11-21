/**
 * Who is signed in and which account screen is showing.
 *
 * The app never opens on a student's data without their password: start-up
 * always lands on setup (first run) or the profile selector. Signing in
 * begins a session in the lifecycle; every sign-out (button, idle limit,
 * shutdown) comes back through `session.onSignedOut` to the selector.
 */
import { backend } from '$lib/services/backend';
import { CoreError, type LaunchMode, type ProfileCard, type SessionInfo } from '$lib/services/core-client';
import { session } from '$lib/services/session';
import type { SignOutReason, SignOutReport } from '$lib/services/session-lifecycle';
import { StudentData } from '$lib/services/student-data';

export type AuthScreen =
  | { name: 'loading' }
  | { name: 'unavailable'; message: string }
  | { name: 'setup' }
  | { name: 'profiles' }
  | { name: 'sign-in'; profile: ProfileCard | 'admin' }
  | { name: 'change-password' }
  | { name: 'recover' }
  | { name: 'app' };

class AuthStore {
  screen = $state<AuthScreen>({ name: 'loading' });
  profiles = $state<ProfileCard[]>([]);
  info = $state<SessionInfo | null>(null);
  launchMode = $state<LaunchMode>('normal');
  /** Shown on the profile selector after an automatic sign-out. */
  lastSignOut = $state<SignOutReport | null>(null);
  /** Set when a manual sign-out stopped because something couldn't be saved. */
  unsaved = $state<string[] | null>(null);
  /** Showing the "Sign out?" question (the student's "Ask before signing out" setting). */
  confirmingSignOut = $state(false);
  /** Set by the preferences store. */
  shouldConfirmSignOut: () => boolean = () => false;
  /** The signed-in student's data service (not reactive: it holds the token). */
  data: StudentData | null = null;

  constructor() {
    session.onSignedOut((report) => void this.afterSignOut(report));
  }

  get isAdmin(): boolean {
    return this.info?.principal.kind === 'admin';
  }

  async init(): Promise<void> {
    try {
      this.launchMode = await backend.launchMode();
      if (this.launchMode === 'recover-admin') {
        this.screen = { name: 'recover' };
        return;
      }
      this.screen = (await backend.needsSetup()) ? { name: 'setup' } : await this.toProfiles();
    } catch (e) {
      this.screen = { name: 'unavailable', message: e instanceof Error ? e.message : String(e) };
    }
  }

  private async toProfiles(): Promise<AuthScreen> {
    this.profiles = await backend.listProfiles();
    return { name: 'profiles' };
  }

  async showProfiles(): Promise<void> {
    this.screen = await this.toProfiles();
  }

  /** First run: creates the administrator and returns the recovery key to show once. */
  setupAdmin(name: string, password: string): Promise<string> {
    return backend.setupAdmin(name, password);
  }

  choose(profile: ProfileCard | 'admin'): void {
    this.lastSignOut = null;
    this.screen = { name: 'sign-in', profile };
  }

  /** Signs in the chosen profile. Errors (wrong password, delays) are thrown for the screen to show. */
  async signIn(password: string): Promise<void> {
    if (this.screen.name !== 'sign-in') return;
    const who = this.screen.profile;
    // A lingering session (e.g. after a crash in the preview) is ended first.
    if (session.session) await session.signOut('switch');
    const info = who === 'admin' ? await backend.signInAdmin(password) : await backend.signInStudent(who.id, password);
    const student = info.principal.kind === 'student' ? info.principal : null;
    this.data = student ? new StudentData(info.token, student.id, backend) : null;
    session.begin({ token: info.token, kind: info.principal.kind, data: this.data ?? undefined }, info.idleTimeoutSecs * 1000);
    this.info = info;
    this.screen = info.mustChangePassword ? { name: 'change-password' } : { name: 'app' };
  }

  async changePassword(current: string, next: string): Promise<void> {
    if (!this.info) throw new CoreError('no-session', 'Your session has ended. Sign in again.');
    await backend.changePassword(this.info.token, current, next);
    this.info = { ...this.info, mustChangePassword: false };
    this.screen = { name: 'app' };
  }

  /** The Sign Out buttons: asks first if the student chose that. */
  requestSignOut(): void {
    if (!this.isAdmin && this.shouldConfirmSignOut()) this.confirmingSignOut = true;
    else void this.signOut('manual');
  }

  /**
   * Signs out. A manual sign-out with unsaved work stops and sets `unsaved`
   * so the shell can ask; call again with `force` to sign out anyway.
   */
  async signOut(reason: SignOutReason = 'manual', force = false): Promise<SignOutReport> {
    this.confirmingSignOut = false;
    const report = await session.signOut(reason, { force: force || reason !== 'manual' });
    this.unsaved = report.signedOut ? null : report.unsaved;
    return report;
  }

  private async afterSignOut(report: SignOutReport): Promise<void> {
    this.info = null;
    this.data = null;
    this.unsaved = null;
    this.lastSignOut = report.reason === 'manual' && !report.unsaved.length ? null : report;
    try {
      this.screen = await this.toProfiles();
    } catch (e) {
      this.screen = { name: 'unavailable', message: e instanceof Error ? e.message : String(e) };
    }
  }
}

export const auth = new AuthStore();

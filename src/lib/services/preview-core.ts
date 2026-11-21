/**
 * In-memory stand-in for the native core, used only by the development
 * browser preview (`npm run dev` outside the desktop app) and screenshots.
 * It follows the same rules as the native core for the screens to exercise:
 * setup once, 8-character passwords, forced change after a temporary
 * password, one session at a time, growing delays after wrong passwords.
 * It keeps nothing on disk and never ships in the desktop build.
 */
import { CoreError, type AccountStatus, type AuditEntry, type CoreApi, type Envelope, type SessionInfo, type StudentAdminView } from './core-client';

interface Student {
  id: string;
  displayName: string;
  password: string;
  status: AccountStatus;
  createdMs: number;
  mustChangePassword: boolean;
  failures: number;
  lockedUntil: number;
  avatar?: string;
}

const DELAYS = [0, 0, 0, 30, 30, 60, 60, 300];

export function createPreviewCore(now: () => number = Date.now): CoreApi & { seed(): Promise<void> } {
  let admin: { name: string; password: string; recoveryKey: string } | null = null;
  const students = new Map<string, Student>();
  const records = new Map<string, unknown>();
  const logs = new Map<string, unknown[]>();
  const audit: AuditEntry[] = [];
  let session: { token: string; info: SessionInfo } | null = null;

  const fail = (code: ConstructorParameters<typeof CoreError>[0], message: string, retry: number | null = null): never => {
    throw new CoreError(code, message, retry);
  };
  const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
  const key = () => Array.from({ length: 5 }, () => hex(3).slice(0, 5).toUpperCase()).join('-');
  const policy = (pw: string) => pw.length < 8 && fail('weak-password', 'Use at least 8 characters.');
  const log = (action: string, studentId?: string) => audit.unshift({ atMs: now(), actor: 'admin', action, studentId });

  function start(info: Omit<SessionInfo, 'token'>): SessionInfo {
    const token = hex(32);
    session = { token, info: { ...info, token } };
    return session.info;
  }
  function need(token: string, kind?: 'admin' | 'student') {
    if (!session || session.token !== token) return fail('no-session', 'Your session has ended. Sign in again.');
    if (kind && session.info.principal.kind !== kind) return fail('forbidden', 'Only the administrator can do that.');
    return session.info;
  }
  function studentKey(token: string, name: string) {
    const info = need(token, 'student');
    if (info.mustChangePassword) fail('password-change-required', 'Choose a new password first.');
    if (!/^[a-z0-9][a-z0-9-]{0,79}(\/[a-z0-9][a-z0-9-]{0,79})?$/.test(name)) fail('invalid-name', 'Invalid record name.');
    return `${(info.principal as { id: string }).id}/${name}`;
  }
  function check(s: Student, pw: string) {
    const wait = Math.ceil((s.lockedUntil - now()) / 1000);
    if (wait > 0) fail('throttled', `Please wait ${wait} seconds and try again.`, wait);
    if (pw !== s.password) {
      s.failures++;
      const d = DELAYS[Math.min(s.failures, DELAYS.length - 1)];
      s.lockedUntil = now() + d * 1000;
      fail(d ? 'throttled' : 'wrong-password', d ? `Too many tries. Please wait ${d} seconds.` : 'That password is not right.', d || null);
    }
    s.failures = 0;
    s.lockedUntil = 0;
  }

  const api: CoreApi & { seed(): Promise<void> } = {
    async needsSetup() {
      return admin === null;
    },
    async setupAdmin(displayName, password) {
      if (admin) fail('already-set-up', 'Already set up.');
      policy(password);
      admin = { name: displayName.trim(), password, recoveryKey: key() };
      return admin.recoveryKey;
    },
    async listProfiles() {
      return [...students.values()].filter((s) => s.status === 'active').map(({ id, displayName, avatar }) => ({ id, displayName, avatar }));
    },
    async signInStudent(studentId, password) {
      const s = students.get(studentId) ?? fail('unknown-student', 'That profile no longer exists.');
      if (s.status !== 'active') fail('inactive', 'This profile is not active.');
      check(s, password);
      return start({ principal: { kind: 'student', id: s.id }, displayName: s.displayName, mustChangePassword: s.mustChangePassword, idleTimeoutSecs: 1200 });
    },
    async signInAdmin(password) {
      if (!admin) return fail('not-set-up', 'Not set up yet.');
      if (password !== admin.password) fail('wrong-password', 'That password is not right.');
      log('admin-signed-in');
      return start({ principal: { kind: 'admin' }, displayName: admin.name, mustChangePassword: false, idleTimeoutSecs: 300 });
    },
    async signOut(token) {
      if (session?.token === token) session = null;
    },
    async changePassword(token, current, next) {
      const info = need(token);
      policy(next);
      if (info.principal.kind === 'student') {
        const s = students.get(info.principal.id)!;
        if (s.password !== current) fail('wrong-password', 'Your current password is not right.');
        s.password = next;
        s.mustChangePassword = false;
      } else {
        if (admin!.password !== current) fail('wrong-password', 'Your current password is not right.');
        admin!.password = next;
      }
      info.mustChangePassword = false;
    },
    async recoverWithKey(recoveryKey, newPassword) {
      const norm = (k: string) => k.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!admin || norm(recoveryKey) !== norm(admin.recoveryKey)) fail('wrong-password', 'That recovery key is not right.');
      policy(newPassword);
      admin!.password = newPassword;
      admin!.recoveryKey = key();
      return admin!.recoveryKey;
    },
    async recoverWithWindowsAdmin() {
      return fail('elevation-required', 'Needs Windows administrator approval (desktop app only).');
    },
    async launchMode() {
      return 'normal';
    },
    async relaunchElevated() {
      fail('elevation-required', 'Administrator recovery with system approval is only available in the Windows app.');
    },
    async adminListStudents(token) {
      need(token, 'admin');
      return [...students.values()].map(
        (s): StudentAdminView => ({
          id: s.id,
          displayName: s.displayName,
          status: s.status,
          createdMs: s.createdMs,
          mustChangePassword: s.mustChangePassword,
          lockedForSecs: Math.max(0, Math.ceil((s.lockedUntil - now()) / 1000)),
          failedAttempts: s.failures,
        }),
      );
    },
    async adminCreateStudent(token, displayName, tempPassword) {
      need(token, 'admin');
      if (!displayName.trim()) fail('invalid-name', 'Enter a name.');
      policy(tempPassword);
      const id = hex(16);
      students.set(id, { id, displayName: displayName.trim(), password: tempPassword, status: 'active', createdMs: now(), mustChangePassword: true, failures: 0, lockedUntil: 0 });
      log('student-created', id);
      return id;
    },
    async adminRenameStudent(token, studentId, displayName) {
      need(token, 'admin');
      students.get(studentId)!.displayName = displayName.trim();
      log('student-renamed', studentId);
    },
    async adminResetPassword(token, studentId, tempPassword) {
      need(token, 'admin');
      policy(tempPassword);
      Object.assign(students.get(studentId)!, { password: tempPassword, mustChangePassword: true, failures: 0, lockedUntil: 0 });
      log('password-reset', studentId);
    },
    async adminUnlock(token, studentId) {
      need(token, 'admin');
      Object.assign(students.get(studentId)!, { failures: 0, lockedUntil: 0 });
      log('student-unlocked', studentId);
    },
    async adminSetStatus(token, studentId, status) {
      need(token, 'admin');
      students.get(studentId)!.status = status;
      log(`student-${status === 'active' ? 'restored' : status}`, studentId);
    },
    async adminRecentAudit(token, limit = 100) {
      need(token, 'admin');
      return audit.slice(0, limit);
    },
    async adminNewRecoveryKey(token, adminPassword) {
      need(token, 'admin');
      if (adminPassword !== admin!.password) fail('wrong-password', 'That password is not right.');
      admin!.recoveryKey = key();
      return admin!.recoveryKey;
    },
    async readRecord<T>(token: string, record: string) {
      return (records.get(studentKey(token, record)) as Envelope<T>) ?? null;
    },
    async writeRecord<T>(token: string, record: string, envelope: Envelope<T>) {
      records.set(studentKey(token, record), structuredClone(envelope));
    },
    async appendLog(token, name, entry) {
      const k = studentKey(token, name);
      logs.set(k, [...(logs.get(k) ?? []), structuredClone(entry)]);
    },
    async readLog<T>(token: string, name: string) {
      return (logs.get(studentKey(token, name)) ?? []) as T[];
    },

    /** Demo installation for screenshots: admin "admin-pass-1", students "student-pass". */
    async seed() {
      if (!admin) await api.setupAdmin('Jason', 'admin-pass-1');
      for (const name of ['Jamie', 'Alex', 'Sam', 'Riley']) {
        const id = hex(16);
        students.set(id, { id, displayName: name, password: 'student-pass', status: 'active', createdMs: now(), mustChangePassword: false, failures: 0, lockedUntil: 0 });
      }
    },
  };
  return api;
}

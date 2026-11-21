/**
 * Typed client for the native core (accounts, sessions, student data).
 *
 * The interface never sees password hashes or file paths. Every student-data
 * call carries the session token; the native side refuses it once the session
 * has ended, which stops late saves landing in another student's records.
 */
import { invoke } from '@tauri-apps/api/core';

export type Principal = { kind: 'student'; id: string } | { kind: 'admin' };

export interface SessionInfo {
  token: string;
  principal: Principal;
  displayName: string;
  mustChangePassword: boolean;
  idleTimeoutSecs: number;
}

export interface ProfileCard {
  id: string;
  displayName: string;
}

export type AccountStatus = 'active' | 'deactivated' | 'archived';

export interface StudentAdminView {
  id: string;
  displayName: string;
  status: AccountStatus;
  createdMs: number;
  mustChangePassword: boolean;
  lockedForSecs: number;
  failedAttempts: number;
}

export interface AuditEntry {
  atMs: number;
  actor: string;
  action: string;
  studentId?: string;
  detail?: string;
}

export type CoreErrorCode =
  | 'io'
  | 'invalid-name'
  | 'invalid-data'
  | 'corrupt'
  | 'newer-version'
  | 'already-set-up'
  | 'not-set-up'
  | 'weak-password'
  | 'wrong-password'
  | 'throttled'
  | 'inactive'
  | 'unknown-student'
  | 'no-session'
  | 'forbidden'
  | 'password-change-required'
  | 'elevation-required'
  | 'unavailable';

export class CoreError extends Error {
  constructor(
    public code: CoreErrorCode,
    message: string,
    public retryAfterSecs: number | null = null,
  ) {
    super(message);
    this.name = 'CoreError';
  }
}

/** Versioned envelope every saved record uses. */
export interface Envelope<T> {
  schemaVersion: number;
  data: T;
}

export function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function call<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!inTauri()) throw new CoreError('unavailable', 'This needs the PickWorks Studio desktop app.');
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    const p = e as { code?: CoreErrorCode; message?: string; retryAfterSecs?: number | null };
    throw new CoreError(p.code ?? 'io', p.message ?? String(e), p.retryAfterSecs ?? null);
  }
}

export const core = {
  needsSetup: () => call<boolean>('auth_needs_setup'),
  setupAdmin: (displayName: string, password: string) => call<string>('auth_setup_admin', { displayName, password }),
  listProfiles: () => call<ProfileCard[]>('auth_list_profiles'),
  signInStudent: (studentId: string, password: string) => call<SessionInfo>('auth_sign_in_student', { studentId, password }),
  signInAdmin: (password: string) => call<SessionInfo>('auth_sign_in_admin', { password }),
  signOut: (token: string) => call<void>('auth_sign_out', { token }),
  changePassword: (token: string, current: string, newPassword: string) => call<void>('auth_change_password', { token, current, newPassword }),
  recoverWithKey: (recoveryKey: string, newPassword: string) => call<string>('auth_recover_with_key', { recoveryKey, newPassword }),
  recoverWithWindowsAdmin: (newPassword: string) => call<string>('auth_recover_with_windows_admin', { newPassword }),

  adminListStudents: (token: string) => call<StudentAdminView[]>('admin_list_students', { token }),
  adminCreateStudent: (token: string, displayName: string, tempPassword: string) => call<string>('admin_create_student', { token, displayName, tempPassword }),
  adminRenameStudent: (token: string, studentId: string, displayName: string) => call<void>('admin_rename_student', { token, studentId, displayName }),
  adminResetPassword: (token: string, studentId: string, tempPassword: string) => call<void>('admin_reset_password', { token, studentId, tempPassword }),
  adminUnlock: (token: string, studentId: string) => call<void>('admin_unlock', { token, studentId }),
  adminSetStatus: (token: string, studentId: string, status: AccountStatus) => call<void>('admin_set_status', { token, studentId, status }),
  adminRecentAudit: (token: string, limit = 100) => call<AuditEntry[]>('admin_recent_audit', { token, limit }),
  adminNewRecoveryKey: (token: string, adminPassword: string) => call<string>('admin_new_recovery_key', { token, adminPassword }),

  readRecord: <T>(token: string, record: string) => call<Envelope<T> | null>('data_read', { token, record }),
  writeRecord: <T>(token: string, record: string, envelope: Envelope<T>) => call<void>('data_write', { token, record, envelope }),
  appendLog: (token: string, log: string, entry: unknown) => call<void>('data_append', { token, log, entry }),
  readLog: <T>(token: string, log: string) => call<T[]>('data_read_log', { token, log }),
};

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
  /** Profile picture as a data URL, when one has been set (added with the admin area). */
  avatar?: string;
}

/** "recover-admin" when the app was relaunched with Windows administrator approval. */
export type LaunchMode = 'normal' | 'recover-admin';

export type AccountStatus = 'active' | 'deactivated' | 'archived';

export interface StudentAdminView {
  id: string;
  displayName: string;
  status: AccountStatus;
  createdMs: number;
  mustChangePassword: boolean;
  lockedForSecs: number;
  failedAttempts: number;
  /** Workspaces the administrator opened for this student. Missing when none. */
  workspaceGrants?: string[];
}

/** Installation-wide workspace access, set by the administrator. Thresholds are whole percentages 0 to 100. */
export interface WorkspaceAccessSettings {
  unlockAll: boolean;
  automaticLearningUnlock: boolean;
  beginnerLessonsPercent: number;
  intermediateLessonsPercent: number;
  newProfileWorkspaces: string[];
}

/** What the signed-in student may know about their own access. */
export interface StudentWorkspaceAccess {
  unlockAll: boolean;
  automaticLearningUnlock: boolean;
  beginnerLessonsPercent: number;
  intermediateLessonsPercent: number;
  grants: string[];
}

export interface AuditEntry {
  atMs: number;
  actor: string;
  action: string;
  studentId?: string;
  detail?: string;
}

export interface BackupInfo {
  name: string;
  kind: 'student' | 'installation';
  reason: 'manual' | 'before-restore';
  createdMs: number;
  studentId?: string;
  studentName?: string;
  appVersion: string;
  sizeBytes: number;
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

export type CoreApi = typeof core;

export const core = {
  needsSetup: () => call<boolean>('auth_needs_setup'),
  setupAdmin: (displayName: string, password: string) => call<string>('auth_setup_admin', { displayName, password }),
  listProfiles: () => call<ProfileCard[]>('auth_list_profiles'),
  signInStudent: (studentId: string, password: string) => call<SessionInfo>('auth_sign_in_student', { studentId, password }),
  /** Whether the profile selector offers "Create Student Profile" (the administrator can turn it off). */
  selfRegistrationEnabled: () => call<boolean>('auth_self_registration_enabled'),
  /** A student creates their own profile and is signed in. Always a student account. */
  registerStudent: (displayName: string, password: string, avatar: string | null) => call<SessionInfo>('auth_register_student', { displayName, password, avatar }),
  adminSetSelfRegistration: (token: string, enabled: boolean) => call<void>('admin_set_self_registration', { token, enabled }),
  signInAdmin: (password: string) => call<SessionInfo>('auth_sign_in_admin', { password }),
  signOut: (token: string) => call<void>('auth_sign_out', { token }),
  changePassword: (token: string, current: string, newPassword: string) => call<void>('auth_change_password', { token, current, newPassword }),
  recoverWithKey: (recoveryKey: string, newPassword: string) => call<string>('auth_recover_with_key', { recoveryKey, newPassword }),
  recoverWithWindowsAdmin: (newPassword: string) => call<string>('auth_recover_with_windows_admin', { newPassword }),
  launchMode: () => call<LaunchMode>('auth_launch_mode'),
  relaunchElevated: () => call<void>('auth_relaunch_elevated'),

  adminListStudents: (token: string) => call<StudentAdminView[]>('admin_list_students', { token }),
  adminCreateStudent: (token: string, displayName: string, tempPassword: string) => call<string>('admin_create_student', { token, displayName, tempPassword }),
  adminRenameStudent: (token: string, studentId: string, displayName: string) => call<void>('admin_rename_student', { token, studentId, displayName }),
  adminResetPassword: (token: string, studentId: string, tempPassword: string) => call<void>('admin_reset_password', { token, studentId, tempPassword }),
  adminUnlock: (token: string, studentId: string) => call<void>('admin_unlock', { token, studentId }),
  adminSetStatus: (token: string, studentId: string, status: AccountStatus) => call<void>('admin_set_status', { token, studentId, status }),
  adminSetAvatar: (token: string, studentId: string, dataUrl: string | null) => call<void>('admin_set_avatar', { token, studentId, dataUrl }),
  adminDeleteStudent: (token: string, studentId: string, confirmName: string) => call<void>('admin_delete_student', { token, studentId, confirmName }),
  adminListBackups: (token: string) => call<BackupInfo[]>('admin_list_backups', { token }),
  adminBackupStudent: (token: string, studentId: string) => call<string>('admin_backup_student', { token, studentId }),
  adminBackupInstallation: (token: string) => call<string>('admin_backup_installation', { token }),
  adminRestoreStudent: (token: string, backupName: string, adminPassword: string) => call<string>('admin_restore_student', { token, backupName, adminPassword }),
  adminRestoreInstallation: (token: string, backupName: string, adminPassword: string) =>
    call<string>('admin_restore_installation', { token, backupName, adminPassword }),
  /** Checks a backup's files against the checksums saved with it. */
  adminVerifyBackup: (token: string, backupName: string) => call<void>('admin_verify_backup', { token, backupName }),
  /** Opens a folder picker and copies the backup there. Null if cancelled. Everything backups need the admin password. */
  adminExportBackup: (token: string, backupName: string, adminPassword?: string) =>
    call<string | null>('admin_export_backup', { token, backupName, adminPassword: adminPassword ?? null }),
  /** Opens a folder picker and adds a backup from it to the list. Null if cancelled. */
  adminImportBackup: (token: string) => call<string | null>('admin_import_backup', { token }),
  adminRecentAudit: (token: string, limit = 100) => call<AuditEntry[]>('admin_recent_audit', { token, limit }),
  adminNewRecoveryKey: (token: string, adminPassword: string) => call<string>('admin_new_recovery_key', { token, adminPassword }),
  adminWorkspaceSettings: (token: string) => call<WorkspaceAccessSettings>('admin_workspace_settings', { token }),
  adminSetWorkspaceSettings: (token: string, settings: WorkspaceAccessSettings) => call<void>('admin_set_workspace_settings', { token, settings }),
  adminSetStudentWorkspaces: (token: string, studentId: string, grants: string[]) => call<void>('admin_set_student_workspaces', { token, studentId, grants }),
  /** The signed-in student's own access facts (installation rules and their grants). */
  studentWorkspaceAccess: (token: string) => call<StudentWorkspaceAccess>('student_workspace_access', { token }),

  readRecord: <T>(token: string, record: string) => call<Envelope<T> | null>('data_read', { token, record }),
  writeRecord: <T>(token: string, record: string, envelope: Envelope<T>) => call<void>('data_write', { token, record, envelope }),
  appendLog: (token: string, log: string, entry: unknown) => call<void>('data_append', { token, log, entry }),
  readLog: <T>(token: string, log: string) => call<T[]>('data_read_log', { token, log }),
};

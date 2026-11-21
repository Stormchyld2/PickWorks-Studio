/** Data for the administrator pages, loaded with the admin session token. */
import { backend } from '$lib/services/backend';
import type { AuditEntry, BackupInfo, StudentAdminView } from '$lib/services/core-client';
import { auth } from './auth.svelte';

function token(): string {
  const t = auth.info?.principal.kind === 'admin' ? auth.info.token : null;
  if (!t) throw new Error('Sign in as the administrator first.');
  return t;
}

class AdminStore {
  students = $state<StudentAdminView[]>([]);
  avatars = $state<Record<string, string | undefined>>({});
  backups = $state<BackupInfo[]>([]);
  audit = $state<AuditEntry[]>([]);

  async loadStudents() {
    const [students, profiles] = await Promise.all([backend.adminListStudents(token()), backend.listProfiles()]);
    this.students = students;
    this.avatars = Object.fromEntries(profiles.map((p) => [p.id, p.avatar]));
  }
  async loadBackups() {
    this.backups = await backend.adminListBackups(token());
  }
  async loadAudit(limit = 200) {
    this.audit = await backend.adminRecentAudit(token(), limit);
  }

  /** Runs an admin action, then refreshes what it changed. */
  async act<T>(fn: (token: string) => Promise<T>, refresh: ('students' | 'backups' | 'audit')[] = ['students']): Promise<T> {
    const result = await fn(token());
    await Promise.all(refresh.map((r) => (r === 'students' ? this.loadStudents() : r === 'backups' ? this.loadBackups() : this.loadAudit())));
    return result;
  }
}

export const admin = new AdminStore();

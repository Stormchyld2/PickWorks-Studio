/** Dates and sizes for the admin screens, in the computer's local time. */
export function formatWhen(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const today = new Date(now);
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (ms >= startOfDay) return `Today, ${time}`;
  if (ms >= startOfDay - 86_400_000) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + `, ${time}`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ACTIONS: Record<string, string> = {
  'admin-signed-in': 'Administrator signed in',
  'student-created': 'Student added',
  'student-renamed': 'Student renamed',
  'password-reset': 'Password reset',
  'student-unlocked': 'Sign-in delay cleared',
  'student-deactivated': 'Student deactivated',
  'student-archived': 'Student archived',
  'student-reactivated': 'Student restored',
  'student-deleted': 'Student permanently deleted',
  'avatar-changed': 'Profile picture changed',
  'avatar-removed': 'Profile picture removed',
  'backup-student': 'Student backed up',
  'backup-installation': 'Everything backed up',
  'restore-student': 'Student restored from backup',
  'restore-installation': 'Everything restored from backup',
  'student-self-registered': 'Student created their own profile',
  'self-registration-on': 'Students can create their own profiles',
  'self-registration-off': 'Students can no longer create their own profiles',
  'export-backup': 'Backup copied to a folder or USB drive',
  'import-backup': 'Backup brought back from a folder or USB drive',
  'recovery-key-replaced': 'New recovery key created',
  'admin-recovered': 'Administrator password reset',
  'admin-password-changed': 'Administrator password changed',
};

export function describeAction(action: string): string {
  return ACTIONS[action] ?? action.replace(/-/g, ' ');
}

/** Resizes and re-encodes a picture to a 256x256 JPEG, dropping any embedded data. */
export async function toAvatarDataUrl(file: File, size = 256): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP picture.');
  if (file.size > 20 * 1024 * 1024) throw new Error('That picture is too large.');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

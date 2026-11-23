/**
 * Platform adapter: everything that differs between Windows, Android and the
 * browser preview goes through here, so screens ask "can this device do X?"
 * instead of checking for Windows. Android implementations are added when
 * Android development starts; today Android reports the safe defaults.
 */
import { inTauri } from './core-client';

export type PlatformKind = 'windows' | 'android' | 'desktop' | 'browser';

export interface PlatformCapabilities {
  kind: PlatformKind;
  /** Recover the administrator through the Windows administrator prompt (Windows only). */
  windowsAdminRecovery: boolean;
  /** How a backup is copied to a USB drive or folder: native folder picker (Windows), Android's file picker (later), or not available. */
  backupCopies: 'folder-picker' | 'android-files' | 'preview' | 'none';
  /** Printing the recovery key and worksheets. */
  print: 'dialog' | 'android-print' | 'none';
  /** The window can tell us it's closing, so we sign out first. Android apps get paused or closed by the system instead. */
  closeEvent: boolean;
}

export function detectPlatform(env: { tauri: boolean; userAgent: string }): PlatformCapabilities {
  const android = /Android/i.test(env.userAgent);
  if (env.tauri && android) return { kind: 'android', windowsAdminRecovery: false, backupCopies: 'none', print: 'none', closeEvent: false };
  if (env.tauri && /Windows/i.test(env.userAgent)) return { kind: 'windows', windowsAdminRecovery: true, backupCopies: 'folder-picker', print: 'dialog', closeEvent: true };
  if (env.tauri) return { kind: 'desktop', windowsAdminRecovery: false, backupCopies: 'folder-picker', print: 'dialog', closeEvent: true };
  return { kind: 'browser', windowsAdminRecovery: true, backupCopies: 'preview', print: 'dialog', closeEvent: false };
}

export const platform: PlatformCapabilities = detectPlatform({
  tauri: inTauri(),
  userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
});

/** Prints the current page (the recovery key, a worksheet). */
export function printPage(): void {
  if (platform.print === 'dialog') window.print();
}

/** Runs `fn` before the window closes, where the platform tells us. Returns a function that stops listening. */
export function onAppClosing(fn: () => Promise<void>): () => void {
  if (!platform.closeEvent || !inTauri()) return () => {};
  let unlisten: (() => void) | undefined;
  let stopped = false;
  void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
    const u = await getCurrentWindow().onCloseRequested(fn);
    if (stopped) u();
    else unlisten = u;
  });
  return () => {
    stopped = true;
    unlisten?.();
  };
}

/**
 * Runs `fn` when the app goes to the background (Android app switch, Windows
 * minimise or another window covering it). Used to save work, never to sign out.
 */
export function onAppHidden(doc: Document, fn: () => void): () => void {
  const handler = () => {
    if (doc.visibilityState === 'hidden') fn();
  };
  doc.addEventListener('visibilitychange', handler);
  return () => doc.removeEventListener('visibilitychange', handler);
}

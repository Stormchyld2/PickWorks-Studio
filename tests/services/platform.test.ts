import { describe, expect, it } from 'vitest';
import { layoutFor } from '../../src/lib/layout/breakpoints';
import { detectPlatform, onAppHidden } from '../../src/lib/services/platform';

describe('layout breakpoints', () => {
  it('picks the layout from window width, not the device', () => {
    expect(layoutFor(390)).toBe('compact');
    expect(layoutFor(599)).toBe('compact');
    expect(layoutFor(600)).toBe('medium');
    expect(layoutFor(839)).toBe('medium');
    expect(layoutFor(840)).toBe('expanded');
    // Windows' minimum window is 1280 px, so it always keeps today's layout.
    expect(layoutFor(1280)).toBe('expanded');
  });
});

describe('platform adapter', () => {
  it('keeps every Windows feature on Windows', () => {
    expect(detectPlatform({ tauri: true, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/131' })).toEqual({
      kind: 'windows', windowsAdminRecovery: true, backupCopies: 'folder-picker', print: 'dialog', closeEvent: true,
    });
  });

  it('never offers Windows-only features on Android', () => {
    const a = detectPlatform({ tauri: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131 Mobile' });
    expect(a.kind).toBe('android');
    expect(a.windowsAdminRecovery).toBe(false);
    expect(a.backupCopies).toBe('none');
    expect(a.closeEvent).toBe(false);
  });

  it('runs the background save only when the app is hidden', () => {
    let state: DocumentVisibilityState = 'visible';
    const listeners: (() => void)[] = [];
    const doc = { get visibilityState() { return state; }, addEventListener: (_: string, f: () => void) => listeners.push(f), removeEventListener: () => {} } as unknown as Document;
    let saves = 0;
    onAppHidden(doc, () => saves++);
    listeners.forEach((f) => f());
    state = 'hidden';
    listeners.forEach((f) => f());
    expect(saves).toBe(1);
  });
});

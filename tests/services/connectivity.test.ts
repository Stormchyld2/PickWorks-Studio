import { describe, expect, it, vi } from 'vitest';
import { canRequest, connectivityMode, OfflineError, policyFetch, setConnectivityMode } from '../../src/lib/services/connectivity';

describe('connectivity policy', () => {
  it('starts offline and refuses every purpose', () => {
    expect(connectivityMode()).toBe('offline');
    for (const p of ['content-pack-download', 'chord-images', 'update-check', 'sync', 'ai-assistant'] as const) {
      expect(canRequest(p)).toBe(false);
    }
  });

  it('never calls fetch while offline', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(policyFetch('update-check', 'https://example.com')).rejects.toBeInstanceOf(OfflineError);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('cannot be switched online in this version', () => {
    expect(() => setConnectivityMode('online')).toThrow();
    expect(connectivityMode()).toBe('offline');
  });
});

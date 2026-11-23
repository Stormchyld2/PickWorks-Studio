/**
 * Connectivity policy (Planning Update 02 and 03, principle 8).
 *
 * Every application-managed network request must ask this module first. In
 * Phase 1 nothing online exists and the Online/Offline toggle is deferred, so
 * the mode is always "offline" and every request is refused. The app's
 * content security policy also blocks network access at the WebView level,
 * so a missed check still cannot reach the internet.
 */

export type ConnectivityMode = 'offline' | 'online';

/** Purposes are declared up front so future online features are explicit. */
export type NetworkPurpose = 'content-pack-download' | 'chord-images' | 'update-check' | 'sync' | 'ai-assistant';

let mode: ConnectivityMode = 'offline';

export function connectivityMode(): ConnectivityMode {
  return mode;
}

/**
 * Phase 1 has no approved online features, so switching online is refused.
 * The future toggle will change this behind its own approval.
 */
export function setConnectivityMode(next: ConnectivityMode): void {
  if (next === 'online') throw new Error('Online features are not available in this version.');
  mode = next;
}

/** Whether a network request for this purpose may be made right now. */
export function canRequest(_purpose: NetworkPurpose): boolean {
  // No online purpose is approved in Phase 1, so this is false in every mode.
  return false;
}

export class OfflineError extends Error {
  constructor(public purpose: NetworkPurpose) {
    super(`Network access for "${purpose}" is turned off. PickWorks Studio works fully offline.`);
    this.name = 'OfflineError';
  }
}

/** The only sanctioned way to make a network request. Refuses while offline. */
export async function policyFetch(purpose: NetworkPurpose, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!canRequest(purpose)) throw new OfflineError(purpose);
  return fetch(input, init);
}

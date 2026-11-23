/**
 * The app's single session lifecycle. Screens use it to report activity,
 * keep the session awake during recordings, and register sign-out work.
 */
import { audioEngine } from './audio/audio-engine';
import { backend } from './backend';
import { SessionLifecycle } from './session-lifecycle';

export const session = new SessionLifecycle({
  endNativeSession: (token) => backend.signOut(token),
  stopAudio: () => audioEngine.stopAll(),
  now: () => Date.now(),
});

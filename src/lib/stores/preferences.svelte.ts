/**
 * The signed-in student's preferences: loaded at sign-in, applied across the
 * app, and saved to their profile on every change (Update 04: checkpoint on
 * settings change). A failed save is shown, never hidden.
 */
import { defaultPreferences, type Preferences } from '$lib/engines/student/records';
import { audioEngine } from '$lib/services/audio/audio-engine';
import { SaveError } from '$lib/services/student-data';
import { auth } from './auth.svelte';
import { tuner } from './tuner.svelte';

const HIGHLIGHT_KEY = 'pw.highlightProfile';

class PreferencesStore {
  value = $state<Preferences>(defaultPreferences());
  loaded = $state(false);
  saveError = $state<string | null>(null);

  constructor() {
    auth.shouldConfirmSignOut = () => this.loaded && this.value.practice.askBeforeSignOut;
  }

  /** Called after a student signs in. */
  async load(): Promise<void> {
    const data = auth.data;
    if (!data) return;
    this.value = await data.preferences();
    this.loaded = true;
    this.saveError = null;
    this.apply();
    this.rememberHighlight();
  }

  /** Back to defaults when nobody is signed in (the selector and admin use defaults). */
  reset(): void {
    this.value = defaultPreferences();
    this.loaded = false;
    this.saveError = null;
    this.apply();
  }

  async update(change: (p: Preferences) => void): Promise<void> {
    const next = structuredClone($state.snapshot(this.value)) as Preferences;
    change(next);
    this.value = next;
    this.apply();
    this.rememberHighlight();
    if (!auth.data) return;
    try {
      await auth.data.savePreferences(next);
      this.saveError = null;
    } catch (e) {
      this.saveError = e instanceof SaveError ? e.message : "Couldn't save your settings.";
    }
  }

  /** Applies display, audio and tuner settings. */
  apply(): void {
    const p = this.value;
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.dataset.textSize = p.display.textSize;
      root.toggleAttribute('data-high-contrast', p.display.highContrast);
      root.toggleAttribute('data-reduced-motion', p.display.reducedMotion);
    }
    try {
      if (this.loaded) audioEngine.setMasterVolume(p.audio.masterVolume);
    } catch {
      // No audio device yet; applied when audio starts.
    }
    if (this.loaded && p.audio.outputDeviceId && audioEngine.canChooseOutput && audioEngine.outputDeviceId !== p.audio.outputDeviceId) {
      audioEngine.setOutputDevice(p.audio.outputDeviceId).catch(() => {});
    }
    tuner.deviceId = p.audio.inputDeviceId;
    tuner.a4 = p.tuner.a4;
    tuner.presetId = p.tuner.presetId;
    tuner.precise = p.tuner.precise;
    tuner.chime = p.tuner.chime;
    tuner.mode = p.tuner.mode;
  }

  /** "Highlight my profile first": remembers only which profile to show first; a password is always needed. */
  private rememberHighlight(): void {
    const p = auth.info?.principal;
    if (p?.kind !== 'student') return;
    try {
      if (this.value.practice.highlightOnSignIn) localStorage.setItem(HIGHLIGHT_KEY, p.id);
      else if (localStorage.getItem(HIGHLIGHT_KEY) === p.id) localStorage.removeItem(HIGHLIGHT_KEY);
    } catch {
      // Storage unavailable: nothing is highlighted.
    }
  }
}

export function highlightedProfileId(): string | null {
  try {
    return localStorage.getItem(HIGHLIGHT_KEY);
  } catch {
    return null;
  }
}

export const preferences = new PreferencesStore();

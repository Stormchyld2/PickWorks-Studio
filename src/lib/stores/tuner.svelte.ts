import {
  DEFAULT_A4,
  DEFAULT_TOLERANCE_CENTS,
  DEFAULT_TUNING_ID,
  PRECISE_TOLERANCE_CENTS,
  advanceTuneAll,
  centsOff,
  chromaticReading,
  createPitchDetector,
  createStabilizer,
  getPreset,
  guidedAdvice,
  nearestString,
  startTuneAll,
  type ChromaticReading,
  type GuidedAdvice,
  type PitchDetector,
  type TuneAllState,
  type TuningPreset,
} from '$lib/engines/audio';
import { midiToFrequency, pitchName } from '$lib/engines/music-theory';
import type { GuitarString } from '$lib/engines/music-theory';
import {
  MicError,
  MicInput,
  listInputDevices,
  micSupported,
  type ChannelChoice,
  type InputDevice,
} from '$lib/services/audio/mic-input';
import { playInTuneChime, playReferenceTone } from '$lib/services/audio/tones';

export type TunerMode = 'guided' | 'chromatic';
const FRAME_MS = 50;

/** Display text for a pitch: label with flat spelling where the tuning uses flats. */
export function stringPitchName(s: GuitarString): string {
  return pitchName(s.openMidi, s.label.includes('b') ? 'flat' : 'sharp');
}

class TunerStore {
  mode = $state<TunerMode>('guided');
  presetId = $state(DEFAULT_TUNING_ID);
  a4 = $state(DEFAULT_A4);
  precise = $state(false);
  autoString = $state(true);
  manualString = $state(5);
  chime = $state(false);

  devices = $state<InputDevice[]>([]);
  deviceId = $state<string | null>(null);
  channel = $state<ChannelChoice>('mix');
  channelCount = $state(1);

  listening = $state(false);
  starting = $state(false);
  error = $state<MicError | null>(null);
  level = $state(0);

  /** Smoothed measured frequency, or null when nothing reliable is heard. */
  frequency = $state<number | null>(null);
  stable = $state(false);
  clarity = $state(0);
  detectedString = $state<number | null>(null);

  tuneAll = $state<TuneAllState | null>(null);

  private mic = new MicInput();
  private detector: PitchDetector | null = null;
  private stabilizer = createStabilizer();
  private timer: ReturnType<typeof setInterval> | null = null;
  private wasInTune = false;

  readonly supported = micSupported();

  get preset(): TuningPreset {
    return getPreset(this.presetId);
  }

  get tolerance(): number {
    return this.precise ? PRECISE_TOLERANCE_CENTS : DEFAULT_TOLERANCE_CENTS;
  }

  /** String the guided tuner is aiming at. */
  get targetString(): GuitarString {
    const p = this.preset;
    const wanted = this.tuneAll && !this.tuneAll.finished
      ? this.tuneAll.order[this.tuneAll.currentIndex]
      : this.autoString
        ? (this.detectedString ?? this.manualString)
        : this.manualString;
    return p.strings.find((s) => s.number === wanted) ?? p.strings[0];
  }

  get cents(): number | null {
    if (this.frequency === null) return null;
    if (this.mode === 'chromatic') return chromaticReading(this.frequency, this.a4).cents;
    return centsOff(this.frequency, this.targetString.openMidi, this.a4);
  }

  get chromatic(): ChromaticReading | null {
    return this.frequency === null ? null : chromaticReading(this.frequency, this.a4);
  }

  get advice(): GuidedAdvice | null {
    const c = this.cents;
    return c === null || !this.stable ? null : guidedAdvice(c, this.tolerance);
  }

  get inTune(): boolean {
    const c = this.cents;
    return c !== null && this.stable && Math.abs(c) <= this.tolerance;
  }

  async refreshDevices() {
    try {
      this.devices = await listInputDevices();
    } catch {
      this.devices = [];
    }
  }

  async start() {
    if (this.starting) return;
    this.starting = true;
    this.error = null;
    try {
      await this.mic.start(this.deviceId, this.channel);
      this.channelCount = this.mic.channelCount;
      this.detector = createPitchDetector({ sampleRate: this.mic.sampleRate, minFrequency: 55 });
      this.stabilizer.reset();
      this.listening = true;
      await this.refreshDevices(); // labels become available after permission
      this.timer = setInterval(() => this.tick(), FRAME_MS);
    } catch (e) {
      this.error = e instanceof MicError ? e : new MicError('unknown', String(e));
      this.listening = false;
    } finally {
      this.starting = false;
    }
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.mic.stop();
    this.listening = false;
    this.frequency = null;
    this.stable = false;
    this.level = 0;
  }

  async restart() {
    if (this.listening) {
      await this.stop();
      await this.start();
    }
  }

  private tick() {
    const frame = this.mic.readFrame();
    if (!frame || !this.detector) return;
    const est = this.detector(frame);
    this.level = Math.min(1, est.rms * 6);
    const r = this.stabilizer.push(est);
    if (r.status === 'pitch') {
      this.frequency = r.frequency;
      this.stable = r.stable;
      this.clarity = r.clarity;
      if (r.stable) this.detectedString = nearestString(this.preset, r.frequency, this.a4).number;
    } else {
      this.frequency = null;
      this.stable = false;
    }

    if (this.tuneAll && !this.tuneAll.finished) {
      const before = this.tuneAll.done.length;
      this.tuneAll = advanceTuneAll(this.tuneAll, this.preset, {
        frequency: this.mode === 'guided' ? this.frequency : null,
        stable: this.stable,
        elapsedMs: FRAME_MS,
        a4: this.a4,
        toleranceCents: this.tolerance,
      });
      if (this.chime && this.tuneAll.done.length > before) playInTuneChime();
    } else {
      const now = this.inTune;
      if (now && !this.wasInTune && this.chime) playInTuneChime();
      this.wasInTune = now;
    }
  }

  playReference(stringNumber?: number) {
    const s = this.preset.strings.find((x) => x.number === (stringNumber ?? this.targetString.number));
    if (s) playReferenceTone(midiToFrequency(s.openMidi, this.a4));
  }

  selectString(n: number) {
    this.manualString = n;
    this.autoString = false;
  }

  startTuneAll() {
    this.mode = 'guided';
    this.tuneAll = startTuneAll(this.preset);
  }

  cancelTuneAll() {
    this.tuneAll = null;
  }
}

export const tuner = new TunerStore();

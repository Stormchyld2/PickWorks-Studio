/**
 * Shared audio system. One AudioContext for the whole app, so the tuner,
 * reference tones, metronome and future recording, effects, loop trainer and
 * backing tracks all share one clock, one output device and one latency.
 *
 * Inputs (microphones, USB microphones, audio interfaces) and the output
 * device are chosen here. MIDI is deliberately not handled here: MIDI
 * carries note events, not sound, and gets its own service.
 */

export interface AudioDevice {
  deviceId: string;
  label: string;
}

/** 'mix' averages all channels; a number picks one channel (0 = input 1). */
export type ChannelChoice = 'mix' | number;

export type AudioErrorCode = 'unsupported' | 'permission-denied' | 'no-device' | 'device-busy' | 'unknown';

export class AudioError extends Error {
  constructor(
    public code: AudioErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface InputHandle {
  /** Mono node carrying the chosen channel(s). Connect analysis or recording to it. */
  node: AudioNode;
  channelCount: number;
  deviceId: string | null;
  close(): void;
}

function toAudioError(e: unknown): AudioError {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return new AudioError('permission-denied', 'Microphone access was blocked. Allow it in your system privacy settings, then try again.');
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return new AudioError('no-device', 'No microphone or audio interface was found. Connect one to use the tuner, or use the reference tones.');
  if (name === 'NotReadableError') return new AudioError('device-busy', 'The audio input is in use by another app or could not be opened.');
  return new AudioError('unknown', e instanceof Error ? e.message : 'The audio input could not be started.');
}

type SinkContext = AudioContext & { setSinkId?: (id: string) => Promise<void> };

class AudioEngine {
  private ctx: SinkContext | null = null;
  private out: GainNode | null = null;
  private outputId = '';

  get inputSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  /** The shared context, created on first use and resumed if suspended. */
  context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' }) as SinkContext;
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Master output: every sound the app makes connects here. */
  output(): GainNode {
    this.context();
    return this.out as GainNode;
  }

  setMasterVolume(volume: number) {
    this.output().gain.value = Math.max(0, Math.min(1, volume));
  }

  get canChooseOutput(): boolean {
    return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    this.outputId = deviceId;
    const ctx = this.context() as SinkContext;
    if (ctx.setSinkId) await ctx.setSinkId(deviceId);
  }

  get outputDeviceId(): string {
    return this.outputId;
  }

  private async list(kind: MediaDeviceKind, fallback: string): Promise<AudioDevice[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === kind).map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${fallback} ${i + 1}` }));
  }

  listInputs(): Promise<AudioDevice[]> {
    return this.list('audioinput', 'Audio input');
  }

  listOutputs(): Promise<AudioDevice[]> {
    return this.list('audiooutput', 'Audio output');
  }

  /**
   * Opens an input with voice processing off (echo cancellation, noise
   * suppression and auto gain all distort pitch and recordings).
   */
  async openInput(deviceId: string | null, channel: ChannelChoice = 'mix'): Promise<InputHandle> {
    if (!this.inputSupported) throw new AudioError('unsupported', 'Audio input is not available on this system.');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 2 },
        },
      });
    } catch (e) {
      throw toAudioError(e);
    }
    const ctx = this.context();
    const source = ctx.createMediaStreamSource(stream);
    const channelCount = stream.getAudioTracks()[0]?.getSettings().channelCount ?? source.channelCount ?? 1;
    const mono = ctx.createGain();
    mono.channelCount = 1;
    mono.channelCountMode = 'explicit';
    mono.channelInterpretation = 'speakers';
    let splitter: ChannelSplitterNode | null = null;
    if (channel === 'mix' || channelCount < 2) {
      source.connect(mono);
    } else {
      splitter = ctx.createChannelSplitter(channelCount);
      source.connect(splitter);
      splitter.connect(mono, Math.min(channel, channelCount - 1));
    }
    return {
      node: mono,
      channelCount,
      deviceId,
      close() {
        stream.getTracks().forEach((t) => t.stop());
        source.disconnect();
        splitter?.disconnect();
        mono.disconnect();
      },
    };
  }
}

export const audioEngine = new AudioEngine();

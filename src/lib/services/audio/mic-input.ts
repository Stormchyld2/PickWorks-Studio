/**
 * Audio input adapter: the only tuner code that touches the browser audio
 * APIs. It delivers raw sample frames to the shared pitch engine.
 *
 * Works with built-in microphones, USB microphones and USB audio interfaces
 * (a guitar plugged in directly). Browser voice processing is switched off,
 * because echo cancellation, noise suppression and auto gain distort pitch.
 * Nothing is recorded or stored.
 */

export interface InputDevice {
  deviceId: string;
  label: string;
}

/** 'mix' averages all channels; a number picks one channel (0 = input 1). */
export type ChannelChoice = 'mix' | number;

export type MicErrorCode = 'unsupported' | 'permission-denied' | 'no-device' | 'device-busy' | 'unknown';

export class MicError extends Error {
  constructor(
    public code: MicErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const FRAME_SIZE = 2048;

function toMicError(e: unknown): MicError {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return new MicError('permission-denied', 'Microphone access was blocked. Allow it in your system privacy settings, then try again.');
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return new MicError('no-device', 'No microphone or audio interface was found. Connect one to use the tuner, or use the reference tones.');
  if (name === 'NotReadableError')
    return new MicError('device-busy', 'The audio input is in use by another app or could not be opened.');
  return new MicError('unknown', e instanceof Error ? e.message : 'The audio input could not be started.');
}

export function micSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export async function listInputDevices(): Promise<InputDevice[]> {
  if (!micSupported()) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Audio input ${i + 1}` }));
}

export class MicInput {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer = new Float32Array(FRAME_SIZE);
  channelCount = 1;

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  get running(): boolean {
    return this.ctx !== null;
  }

  async start(deviceId: string | null, channel: ChannelChoice = 'mix'): Promise<void> {
    if (!micSupported()) throw new MicError('unsupported', 'Audio input is not available on this system.');
    await this.stop();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 2 },
        },
      });
    } catch (e) {
      throw toMicError(e);
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const source = ctx.createMediaStreamSource(this.stream);
    this.channelCount = this.stream.getAudioTracks()[0]?.getSettings().channelCount ?? source.channelCount ?? 1;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    this.analyser = analyser;

    if (channel === 'mix' || this.channelCount < 2) {
      const mono = ctx.createGain();
      mono.channelCount = 1;
      mono.channelCountMode = 'explicit';
      mono.channelInterpretation = 'speakers';
      source.connect(mono).connect(analyser);
    } else {
      const splitter = ctx.createChannelSplitter(this.channelCount);
      source.connect(splitter);
      splitter.connect(analyser, Math.min(channel, this.channelCount - 1));
    }
    if (ctx.state === 'suspended') await ctx.resume();
  }

  /** Latest FRAME_SIZE samples, or null if not running. */
  readFrame(): Float32Array | null {
    if (!this.analyser) return null;
    const full = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(full);
    this.buffer.set(full.subarray(full.length - FRAME_SIZE));
    return this.buffer;
  }

  async stop(): Promise<void> {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    if (this.ctx) {
      const ctx = this.ctx;
      this.ctx = null;
      await ctx.close().catch(() => undefined);
    }
  }
}

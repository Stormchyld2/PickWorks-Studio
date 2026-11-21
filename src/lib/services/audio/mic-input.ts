/**
 * Pitch-analysis input for the tuner (and later note recognition). Opens an
 * input through the shared audio engine and hands raw sample frames to the
 * pitch engine. Nothing is recorded or stored.
 */
import { AudioError, audioEngine, type AudioDevice, type ChannelChoice, type InputHandle } from './audio-engine';

export { AudioError as MicError, type ChannelChoice };
export type InputDevice = AudioDevice;

export const FRAME_SIZE = 2048;

export function micSupported(): boolean {
  return audioEngine.inputSupported;
}

export function listInputDevices(): Promise<InputDevice[]> {
  return audioEngine.listInputs();
}

export class MicInput {
  private input: InputHandle | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer = new Float32Array(FRAME_SIZE);
  private full = new Float32Array(4096);
  private unhook: (() => void) | null = null;

  get channelCount(): number {
    return this.input?.channelCount ?? 1;
  }

  get sampleRate(): number {
    return audioEngine.context().sampleRate;
  }

  get running(): boolean {
    return this.input !== null;
  }

  async start(deviceId: string | null, channel: ChannelChoice = 'mix'): Promise<void> {
    await this.stop();
    this.input = await audioEngine.openInput(deviceId, channel);
    const analyser = audioEngine.context().createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    this.input.node.connect(analyser);
    this.analyser = analyser;
    this.unhook = audioEngine.onStopAll(() => void this.stop());
  }

  /** Latest FRAME_SIZE samples, or null if not running. */
  readFrame(): Float32Array | null {
    if (!this.analyser) return null;
    this.analyser.getFloatTimeDomainData(this.full);
    this.buffer.set(this.full.subarray(this.full.length - FRAME_SIZE));
    return this.buffer;
  }

  async stop(): Promise<void> {
    this.analyser?.disconnect();
    this.analyser = null;
    this.input?.close();
    this.input = null;
    this.unhook?.();
    this.unhook = null;
  }
}

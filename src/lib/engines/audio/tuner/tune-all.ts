import type { Tuning } from '../../music-theory/tuning';
import { centsOff } from './tuner';

/**
 * "Tune All Six Strings": walks the student from the 6th string to the 1st.
 * A string is marked done only after it has held a stable, in-tolerance
 * pitch for `holdMs`, never on a single reading.
 */
export interface TuneAllState {
  order: number[];
  currentIndex: number;
  done: number[];
  /** ms the current string has been held in tune. */
  heldMs: number;
  finished: boolean;
}

export function startTuneAll(tuning: Tuning): TuneAllState {
  const order = [...tuning.strings].sort((a, b) => b.number - a.number).map((s) => s.number);
  return { order, currentIndex: 0, done: [], heldMs: 0, finished: false };
}

export function currentString(state: TuneAllState): number | null {
  return state.finished ? null : state.order[state.currentIndex];
}

export interface TuneAllInput {
  frequency: number | null;
  stable: boolean;
  elapsedMs: number;
  a4: number;
  toleranceCents: number;
}

export function advanceTuneAll(state: TuneAllState, tuning: Tuning, input: TuneAllInput, holdMs = 1000): TuneAllState {
  if (state.finished) return state;
  const stringNumber = state.order[state.currentIndex];
  const target = tuning.strings.find((s) => s.number === stringNumber);
  if (!target) return state;
  const inTune =
    input.frequency !== null && input.stable && Math.abs(centsOff(input.frequency, target.openMidi, input.a4)) <= input.toleranceCents;
  const heldMs = inTune ? state.heldMs + input.elapsedMs : 0;
  if (heldMs < holdMs) return { ...state, heldMs };
  const done = [...state.done, stringNumber];
  const currentIndex = state.currentIndex + 1;
  return { ...state, done, currentIndex, heldMs: 0, finished: currentIndex >= state.order.length };
}

/** Lets the student skip a string they can't tune right now. */
export function skipString(state: TuneAllState): TuneAllState {
  if (state.finished) return state;
  const currentIndex = state.currentIndex + 1;
  return { ...state, currentIndex, heldMs: 0, finished: currentIndex >= state.order.length };
}

/**
 * Performance pipeline seams: Input -> Evaluation -> Coaching.
 *
 * Phase 1 has one input source (the student taps or clicks the on-screen
 * fretboard). The future Virtual Instructor adds microphone and camera
 * sources that produce the same Observation shape, so lessons, practice
 * and mastery never need to know where an observation came from.
 */
import type { FretPosition } from '../fretboard/fretboard';
import type { PitchClass } from '../music-theory/notes';

export type ObservationSource = 'fretboard-ui' | 'keyboard' | 'microphone' | 'camera';

/** 0..1. UI input is certain (1); detectors report their own confidence. */
export type Confidence = number;

interface ObservationBase {
  source: ObservationSource;
  confidence: Confidence;
  /** ms since the exercise step started. */
  atMs: number;
}

export type Observation =
  | (ObservationBase & { kind: 'position-selected'; position: FretPosition })
  | (ObservationBase & { kind: 'note-named'; pitchClass: PitchClass })
  | (ObservationBase & { kind: 'pitch-detected'; midi: number; cents: number })
  | (ObservationBase & { kind: 'onset'; })
  | (ObservationBase & { kind: 'hand-pose'; fretEstimate?: number; stringEstimate?: number });

/** Anything that produces observations: the fretboard UI now, a mic or camera later. */
export interface PerformanceInput {
  readonly source: ObservationSource;
  start(onObservation: (o: Observation) => void): void;
  stop(): void;
}

/** What a step expects the student to do. Lessons describe this as data. */
export type ExpectedPerformance =
  | { kind: 'select-position'; tuningId: string; accept: readonly FretPosition[] }
  | { kind: 'select-all-positions'; tuningId: string; accept: readonly FretPosition[] }
  | { kind: 'name-note'; pitchClass: PitchClass }
  | { kind: 'play-pitch'; midi: number; toleranceCents: number };

/**
 * How sure the evaluation is. The coach must never present a "probable" or
 * "insufficient" finding as a confirmed fact.
 */
export type Certainty = 'confirmed' | 'probable' | 'insufficient-evidence';

export interface Finding {
  code: string;
  certainty: Certainty;
  detail?: Record<string, unknown>;
}

export interface Evaluation {
  correct: boolean | null; // null = could not decide
  certainty: Certainty;
  findings: Finding[];
  responseMs?: number;
}

export interface PerformanceEvaluator {
  evaluate(expected: ExpectedPerformance, observations: Observation[]): Evaluation;
}

export type NextAction = 'retry' | 'show-answer' | 'simplify' | 'repeat' | 'advance' | 'schedule-review' | 'ask-to-replay';

export interface CoachingResult {
  message: string;
  nextAction: NextAction;
  /** Optional recommendation, e.g. a weak note to review. */
  recommendations?: string[];
}

export interface CoachingEngine {
  coach(evaluation: Evaluation, context: { attemptNumber: number }): CoachingResult;
}

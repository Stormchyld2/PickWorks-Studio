import { samePosition } from '../fretboard/fretboard';
import type { Evaluation, ExpectedPerformance, Observation, PerformanceEvaluator } from './types';

/** Below this, a detector's observation is not trusted enough to judge. */
export const MIN_CONFIDENCE = 0.8;

/** Rule-based evaluator for Phase 1 inputs (fretboard taps, note naming, detected pitch). */
export const ruleEvaluator: PerformanceEvaluator = {
  evaluate(expected: ExpectedPerformance, observations: Observation[]): Evaluation {
    const trusted = observations.filter((o) => o.confidence >= MIN_CONFIDENCE);
    if (trusted.length === 0) {
      return { correct: null, certainty: 'insufficient-evidence', findings: [{ code: 'no-reliable-input', certainty: 'insufficient-evidence' }] };
    }
    const last = trusted[trusted.length - 1];
    const responseMs = last.atMs;

    switch (expected.kind) {
      case 'select-position': {
        if (last.kind !== 'position-selected') break;
        const correct = expected.accept.some((p) => samePosition(p, last.position));
        return {
          correct,
          certainty: 'confirmed',
          responseMs,
          findings: correct ? [] : [{ code: 'wrong-position', certainty: 'confirmed', detail: { selected: last.position } }],
        };
      }
      case 'name-note': {
        if (last.kind !== 'note-named') break;
        const correct = last.pitchClass === expected.pitchClass;
        return {
          correct,
          certainty: 'confirmed',
          responseMs,
          findings: correct ? [] : [{ code: 'wrong-note', certainty: 'confirmed', detail: { named: last.pitchClass } }],
        };
      }
      case 'play-pitch': {
        if (last.kind !== 'pitch-detected') break;
        const offCents = (last.midi - expected.midi) * 100 + last.cents;
        const correct = Math.abs(offCents) <= expected.toleranceCents;
        return {
          correct,
          certainty: 'confirmed',
          responseMs,
          findings: correct ? [] : [{ code: offCents > 0 ? 'pitch-sharp' : 'pitch-flat', certainty: 'confirmed', detail: { offCents } }],
        };
      }
      case 'select-all-positions':
        // Implemented with the practice engine in Milestone 4.
        break;
    }
    return { correct: null, certainty: 'insufficient-evidence', findings: [{ code: 'unexpected-input', certainty: 'insufficient-evidence' }] };
  },
};

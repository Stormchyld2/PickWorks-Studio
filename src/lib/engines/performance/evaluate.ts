import { samePosition, type FretPosition } from '../fretboard/fretboard';
import type { Evaluation, ExpectedPerformance, Observation, PerformanceEvaluator } from './types';

/** Below this, a detector's observation is not trusted enough to judge. */
export const MIN_CONFIDENCE = 0.8;

/** Rule-based evaluator for Phase 1 inputs (fretboard taps and note naming). */
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
      case 'play-pitch':
        // Microphone evaluation is a Virtual Instructor feature; requirements not finalised.
        break;
      case 'select-all-positions': {
        const chosen = trusted.filter((o) => o.kind === 'position-selected').map((o) => (o as { position: FretPosition }).position);
        const unique = chosen.filter((p, i) => chosen.findIndex((q) => samePosition(p, q)) === i);
        const missed = expected.accept.filter((a) => !unique.some((u) => samePosition(u, a)));
        const extra = unique.filter((u) => !expected.accept.some((a) => samePosition(u, a)));
        const correct = missed.length === 0 && extra.length === 0;
        const findings = [
          ...(missed.length ? [{ code: 'missed-positions', certainty: 'confirmed' as const, detail: { missed } }] : []),
          ...(extra.length ? [{ code: 'wrong-position', certainty: 'confirmed' as const, detail: { extra } }] : []),
        ];
        return { correct, certainty: 'confirmed', responseMs, findings };
      }
    }
    return { correct: null, certainty: 'insufficient-evidence', findings: [{ code: 'unexpected-input', certainty: 'insufficient-evidence' }] };
  },
};

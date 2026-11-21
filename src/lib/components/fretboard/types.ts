import type { FretPosition } from '$lib/engines/fretboard';

export type HighlightVariant = 'note' | 'root' | 'focus' | 'correct' | 'incorrect' | 'muted';

export interface FretHighlight extends FretPosition {
  label?: string;
  variant?: HighlightVariant;
}

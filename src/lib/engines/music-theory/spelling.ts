import { LETTERS, LETTER_PITCH_CLASS, toPitchClass, type Accidental, type Spelling } from './notes';

/**
 * Spells the note `semitones` above `root` using the letter `degree` steps
 * above the root's letter (degree 0 = root, 2 = third, 4 = fifth...). This is
 * how chords and scales get correct names: the 3rd of Eb is G, the 3rd of
 * Ab minor is Cb. Returns null if it would need more than a double accidental.
 */
export function spellAbove(root: Spelling, semitones: number, degree: number): Spelling | null {
  const letter = LETTERS[(LETTERS.indexOf(root.letter) + degree) % 7];
  const target = toPitchClass(LETTER_PITCH_CLASS[root.letter] + root.accidental + semitones);
  let diff = target - LETTER_PITCH_CLASS[letter];
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  if (diff < -2 || diff > 2) return null;
  return { letter, accidental: diff as Accidental };
}

/**
 * Keyboard handling for the workspace list (WAI-ARIA listbox pattern). Pure,
 * so every key is tested without a browser.
 */
export type ListboxAction =
  | { kind: 'move'; index: number }
  | { kind: 'choose'; index: number }
  | { kind: 'close'; returnFocus: boolean }
  | null;

export function listboxKey(key: string, index: number, count: number): ListboxAction {
  if (count <= 0) return key === 'Escape' ? { kind: 'close', returnFocus: true } : null;
  switch (key) {
    case 'ArrowDown':
      return { kind: 'move', index: (index + 1) % count };
    case 'ArrowUp':
      return { kind: 'move', index: (index - 1 + count) % count };
    case 'Home':
      return { kind: 'move', index: 0 };
    case 'End':
      return { kind: 'move', index: count - 1 };
    case 'Enter':
    case ' ':
      return { kind: 'choose', index };
    case 'Escape':
      return { kind: 'close', returnFocus: true };
    case 'Tab':
      // Tab leaves the list and moves on; focus is not pulled back to the button.
      return { kind: 'close', returnFocus: false };
    default:
      return null;
  }
}

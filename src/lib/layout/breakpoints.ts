/**
 * Shared layout breakpoints (approved 2026-11-22) for Windows, Android tablets
 * and Android phones. Chosen by the app window's width, never by device type,
 * so resizing, rotation and split-screen switch layouts live.
 *
 * CSS can't read variables inside media queries, so stylesheets use these
 * exact numbers: `@media (max-width: 839.98px)` for "below expanded" and
 * `@media (max-width: 599.98px)` for compact. Windows has a 1280 px minimum
 * window, so it always gets the expanded (current) layout.
 */
export const COMPACT_BELOW = 600;
export const EXPANDED_FROM = 840;

/** compact: phone, single column, drawer or bottom nav. medium: overlay sidebar. expanded: desktop/tablet, persistent sidebar. */
export type LayoutClass = 'compact' | 'medium' | 'expanded';

export function layoutFor(width: number): LayoutClass {
  if (width < COMPACT_BELOW) return 'compact';
  if (width < EXPANDED_FROM) return 'medium';
  return 'expanded';
}

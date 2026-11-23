/**
 * Where the workspace list opens. Expanded sidebar: right under the selector,
 * the same width. Collapsed rail: beside the rail, level with the button.
 * Either way it is kept inside the window with an 8 px margin, so it is never
 * cut off at small window sizes or large text.
 */
export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
}

export const POPOVER_MARGIN = 8;
export const COLLAPSED_POPOVER_WIDTH = 300;

export function popoverPosition(
  trigger: Rect,
  viewport: { width: number; height: number },
  collapsed: boolean,
  listHeight: number,
): { top: number; left: number; width: number } {
  const m = POPOVER_MARGIN;
  const width = Math.min(collapsed ? COLLAPSED_POPOVER_WIDTH : trigger.width, viewport.width - 2 * m);
  let left = collapsed ? trigger.right + 12 : trigger.left;
  let top = collapsed ? trigger.top : trigger.bottom + 6;
  left = Math.max(m, Math.min(left, viewport.width - m - width));
  // Not enough room below: open above the selector instead (expanded), or slide up (collapsed).
  if (top + listHeight > viewport.height - m) {
    top = collapsed ? viewport.height - m - listHeight : trigger.top - 6 - listHeight;
  }
  top = Math.max(m, top);
  return { top, left, width };
}

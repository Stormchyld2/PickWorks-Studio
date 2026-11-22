/**
 * The current layout class, kept up to date as the window resizes or rotates.
 * Also mirrored as `data-layout` and `data-input` on <html> for stylesheets.
 */
import { layoutFor, type LayoutClass } from '$lib/layout/breakpoints';

class LayoutStore {
  width = $state(typeof window === 'undefined' ? 1600 : window.innerWidth);
  /** True when the main pointer is a finger (touch screens). */
  touch = $state(false);
  get layout(): LayoutClass {
    return layoutFor(this.width);
  }

  /** Starts listening. Returns a function that stops. */
  bind(win: Window): () => void {
    const coarse = win.matchMedia?.('(pointer: coarse)');
    const update = () => {
      this.width = win.innerWidth;
      this.touch = coarse?.matches ?? false;
      const html = win.document.documentElement;
      html.dataset.layout = this.layout;
      html.dataset.input = this.touch ? 'touch' : 'pointer';
    };
    update();
    win.addEventListener('resize', update);
    win.addEventListener('orientationchange', update);
    coarse?.addEventListener?.('change', update);
    return () => {
      win.removeEventListener('resize', update);
      win.removeEventListener('orientationchange', update);
      coarse?.removeEventListener?.('change', update);
    };
  }
}

export const layout = new LayoutStore();

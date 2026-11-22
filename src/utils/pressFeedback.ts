/**
 * Global press feedback for touch buttons.
 *
 * A quick tap lifts the finger after about 40 ms. Feedback that is tied to the
 * pointer events of one component ends before the kiosk has painted it. This
 * marks the touched button with `data-pressed` on pointerdown and keeps the
 * mark for a minimum time. The pressed look itself lives in `index.css`.
 */

const PRESSED_ATTRIBUTE = 'data-pressed';
const MIN_PRESS_MS = 120;

export function installPressFeedback(): () => void {
  let pressed: Element | null = null;
  let pressedAt = 0;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    clearTimeout(releaseTimer);
    releaseTimer = undefined;
    pressed?.removeAttribute(PRESSED_ATTRIBUTE);
    pressed = null;
  };

  const onDown = (event: Event) => {
    const button = (event.target as Element | null)?.closest?.('button');
    clear();
    if (!button || button.disabled) return;
    pressed = button;
    pressedAt = Date.now();
    button.setAttribute(PRESSED_ATTRIBUTE, '');
  };

  const onUp = () => {
    if (!pressed || releaseTimer !== undefined) return;
    const remaining = MIN_PRESS_MS - (Date.now() - pressedAt);
    if (remaining <= 0) {
      clear();
    } else {
      releaseTimer = setTimeout(clear, remaining);
    }
  };

  const options = { capture: true, passive: true } as const;
  document.addEventListener('pointerdown', onDown, options);
  document.addEventListener('pointerup', onUp, options);
  document.addEventListener('pointercancel', onUp, options);

  return () => {
    clear();
    document.removeEventListener('pointerdown', onDown, options);
    document.removeEventListener('pointerup', onUp, options);
    document.removeEventListener('pointercancel', onUp, options);
  };
}

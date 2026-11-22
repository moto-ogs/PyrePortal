/**
 * Global press feedback for touch buttons.
 *
 * A quick tap lifts the finger after about 40 ms. Feedback that is tied to the
 * pointer events of one component ends before the kiosk has painted it. This
 * marks the touched button with `data-pressed` on pointerdown and keeps the
 * mark for a minimum time. The pressed look itself lives in `index.css`.
 *
 * The minimum applies to buttons that stay mounted. A tap that changes the
 * route replaces the page at once; the new page is the feedback there.
 */

const PRESSED_ATTRIBUTE = 'data-pressed';
const MIN_PRESS_MS = 120;

export function installPressFeedback(): () => void {
  // Buttons currently held, by pointer, and pending releases, by button.
  const held = new Map<number, { button: Element; at: number }>();
  const releaseTimers = new Map<Element, ReturnType<typeof setTimeout>>();

  const release = (button: Element) => {
    clearTimeout(releaseTimers.get(button));
    releaseTimers.delete(button);
    button.removeAttribute(PRESSED_ATTRIBUTE);
  };

  const onDown = (event: Event) => {
    const button = (event.target as Element | null)?.closest?.('button');
    if (!button || button.disabled) return;
    // A new press on a button that is still in its minimum hold keeps it pressed.
    clearTimeout(releaseTimers.get(button));
    releaseTimers.delete(button);
    held.set((event as PointerEvent).pointerId, { button, at: Date.now() });
    button.setAttribute(PRESSED_ATTRIBUTE, '');
  };

  const onUp = (event: Event) => {
    const pointerId = (event as PointerEvent).pointerId;
    const press = held.get(pointerId);
    if (!press) return;
    held.delete(pointerId);
    const remaining = MIN_PRESS_MS - (Date.now() - press.at);
    if (remaining <= 0) {
      release(press.button);
    } else {
      releaseTimers.set(
        press.button,
        setTimeout(() => release(press.button), remaining)
      );
    }
  };

  const options = { capture: true, passive: true } as const;
  document.addEventListener('pointerdown', onDown, options);
  document.addEventListener('pointerup', onUp, options);
  document.addEventListener('pointercancel', onUp, options);

  return () => {
    for (const { button } of held.values()) release(button);
    for (const button of [...releaseTimers.keys()]) release(button);
    held.clear();
    document.removeEventListener('pointerdown', onDown, options);
    document.removeEventListener('pointerup', onUp, options);
    document.removeEventListener('pointercancel', onUp, options);
  };
}

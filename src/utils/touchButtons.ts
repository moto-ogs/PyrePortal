/**
 * Touch behaviour of every `<button>` in the kiosk, installed once at startup.
 *
 * 1. Pressed look. A quick tap lifts the finger after about 40 ms, before the
 *    kiosk has painted feedback tied to one component's pointer events. The
 *    touched button gets `data-pressed` on pointerdown and keeps it for a
 *    minimum time. The look itself lives in `index.css`. The minimum applies to
 *    buttons that stay mounted; a tap that changes the page replaces it at once.
 *
 * 2. Activation when the finger lands. Waiting for the click costs the time
 *    until the finger lifts, and the WebView sends no click at all when the
 *    next finger lands before the last one is up (fast typing on neighbouring
 *    keys). A touch therefore clicks the button on pointerdown, and the click
 *    the browser sends for the same touch afterwards is swallowed. That click
 *    is swallowed wherever it lands: the button may have opened a modal or
 *    changed the page, and the click would hit what is under the finger now.
 *    Inside a container that scrolls, a touch may start a scroll, so the button
 *    waits for the normal click there. Mouse and keyboard are untouched.
 */

const PRESSED_ATTRIBUTE = 'data-pressed';
const MIN_PRESS_MS = 120;
// A browser click follows its pointerup within a few milliseconds.
const CLICK_AFTER_TOUCH_MS = 500;

function isInsideScrollingContainer(button: Element): boolean {
  for (let el = button.parentElement; el; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1) {
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') return true;
    }
  }
  return false;
}

export function installTouchButtons(): () => void {
  // Buttons currently held, by pointer, and pending releases, by button.
  const held = new Map<number, { button: Element; at: number; activated: boolean }>();
  const releaseTimers = new Map<Element, ReturnType<typeof setTimeout>>();
  // Touches whose button was already clicked on pointerdown.
  const activatedPointers = new Set<number>();
  let lastActivatedUpAt = -Infinity;
  let activating = false;

  const release = (button: Element) => {
    clearTimeout(releaseTimers.get(button));
    releaseTimers.delete(button);
    button.removeAttribute(PRESSED_ATTRIBUTE);
  };

  const onDown = (event: Event) => {
    const { pointerId, pointerType } = event as PointerEvent;
    const button = (event.target as Element | null)?.closest?.('button');
    if (!button || button.disabled) return;
    // A new press on a button that is still in its minimum hold keeps it pressed.
    clearTimeout(releaseTimers.get(button));
    releaseTimers.delete(button);
    button.setAttribute(PRESSED_ATTRIBUTE, '');

    const activated = pointerType === 'touch' && !isInsideScrollingContainer(button);
    held.set(pointerId, { button, at: Date.now(), activated });
    if (activated) {
      activatedPointers.add(pointerId);
      activating = true;
      try {
        button.click();
      } finally {
        activating = false;
      }
    }
  };

  const onUp = (event: Event) => {
    const pointerId = (event as PointerEvent).pointerId;
    const press = held.get(pointerId);
    if (!press) return;
    held.delete(pointerId);
    if (press.activated) {
      lastActivatedUpAt = Date.now();
      // Overlapping touches get no click; forget the touch once it cannot come.
      setTimeout(() => activatedPointers.delete(pointerId), CLICK_AFTER_TOUCH_MS);
    }
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

  const onClick = (event: Event) => {
    if (activating) return;
    const { pointerId, pointerType } = event as PointerEvent;
    // Chrome sends the click of a touch as a touch with the same pointer id.
    // WebKit sends it as a mouse click, so there the first click right after
    // an activated touch counts as its own.
    const fromActivatedTouch =
      pointerType === 'touch'
        ? activatedPointers.delete(pointerId)
        : Date.now() - lastActivatedUpAt < CLICK_AFTER_TOUCH_MS;
    if (!fromActivatedTouch) return;
    lastActivatedUpAt = -Infinity;
    event.stopImmediatePropagation();
    event.preventDefault();
  };

  const options = { capture: true, passive: true } as const;
  document.addEventListener('pointerdown', onDown, options);
  document.addEventListener('pointerup', onUp, options);
  document.addEventListener('pointercancel', onUp, options);
  window.addEventListener('click', onClick, true);

  return () => {
    for (const { button } of held.values()) release(button);
    for (const button of [...releaseTimers.keys()]) release(button);
    held.clear();
    document.removeEventListener('pointerdown', onDown, options);
    document.removeEventListener('pointerup', onUp, options);
    document.removeEventListener('pointercancel', onUp, options);
    window.removeEventListener('click', onClick, true);
  };
}

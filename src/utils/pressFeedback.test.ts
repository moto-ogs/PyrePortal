import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installPressFeedback } from './pressFeedback';

const press = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
const release = (el: Element, type = 'pointerup') =>
  el.dispatchEvent(new Event(type, { bubbles: true }));

describe('installPressFeedback', () => {
  let uninstall: () => void;
  let button: HTMLButtonElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button><span>Weiter</span></button><p>Text</p>';
    button = document.querySelector('button')!;
    uninstall = installPressFeedback();
  });

  afterEach(() => {
    uninstall();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('marks a button as pressed as soon as the finger touches it', () => {
    press(button.querySelector('span')!);
    expect(button.hasAttribute('data-pressed')).toBe(true);
  });

  it('keeps a quick tap visibly pressed for 120 ms', () => {
    press(button);
    vi.advanceTimersByTime(30);
    release(button);

    vi.advanceTimersByTime(89);
    expect(button.hasAttribute('data-pressed')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(button.hasAttribute('data-pressed')).toBe(false);
  });

  it('releases a long press as soon as the finger lifts', () => {
    press(button);
    vi.advanceTimersByTime(500);
    release(button);
    expect(button.hasAttribute('data-pressed')).toBe(false);
  });

  it('releases when the touch is cancelled', () => {
    press(button);
    vi.advanceTimersByTime(500);
    release(button, 'pointercancel');
    expect(button.hasAttribute('data-pressed')).toBe(false);
  });

  it('stays pressed when a second tap follows before the first hold ends', () => {
    press(button);
    release(button);
    vi.advanceTimersByTime(100);
    press(button);
    vi.advanceTimersByTime(60);
    expect(button.hasAttribute('data-pressed')).toBe(true);
  });

  it('ignores disabled buttons and non-interactive elements', () => {
    button.disabled = true;
    press(button);
    press(document.querySelector('p')!);
    expect(document.querySelector('[data-pressed]')).toBeNull();
  });
});

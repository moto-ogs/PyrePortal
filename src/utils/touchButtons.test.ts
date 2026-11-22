import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installTouchButtons } from './touchButtons';

const press = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
const release = (el: Element, type = 'pointerup') =>
  el.dispatchEvent(new Event(type, { bubbles: true }));

describe('pressed look', () => {
  let uninstall: () => void;
  let button: HTMLButtonElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button><span>Weiter</span></button><p>Text</p>';
    button = document.querySelector('button')!;
    uninstall = installTouchButtons();
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

  it('keeps the first button pressed for its 120 ms when another is tapped right after', () => {
    document.body.insertAdjacentHTML('beforeend', '<button id="second">2</button>');
    const second = document.querySelector('#second')!;

    press(button);
    vi.advanceTimersByTime(30);
    release(button);
    vi.advanceTimersByTime(30);
    press(second);

    expect(button.hasAttribute('data-pressed')).toBe(true);
    expect(second.hasAttribute('data-pressed')).toBe(true);

    vi.advanceTimersByTime(60);
    expect(button.hasAttribute('data-pressed')).toBe(false);
  });

  it('ignores disabled buttons and non-interactive elements', () => {
    button.disabled = true;
    press(button);
    press(document.querySelector('p')!);
    expect(document.querySelector('[data-pressed]')).toBeNull();
  });
});

const pointer = (type: string, pointerId: number, pointerType = 'touch') =>
  Object.assign(new Event(type, { bubbles: true, cancelable: true }), { pointerId, pointerType });

describe('activation on touch', () => {
  let uninstall: () => void;
  let button: HTMLButtonElement;
  let onClick: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<button id="a">1</button><button id="b">2</button><div id="backdrop">x</div>';
    button = document.querySelector('#a')!;
    onClick = vi.fn<() => void>();
    button.addEventListener('click', onClick);
    uninstall = installTouchButtons();
  });

  afterEach(() => {
    uninstall();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('activates a button when the finger lands, before it lifts', () => {
    button.dispatchEvent(pointer('pointerdown', 7));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('activates it only once when the click of the same touch follows', () => {
    button.dispatchEvent(pointer('pointerdown', 7));
    button.dispatchEvent(pointer('pointerup', 7));
    button.dispatchEvent(pointer('click', 7));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // Fast typing: the next finger lands before the last one lifts, and the
  // WebView then sends no click for either touch.
  it('activates every button when touches overlap and no click is sent', () => {
    const second = document.querySelector<HTMLButtonElement>('#b')!;
    const onSecond = vi.fn<() => void>();
    second.addEventListener('click', onSecond);

    button.dispatchEvent(pointer('pointerdown', 7));
    second.dispatchEvent(pointer('pointerdown', 8));
    button.dispatchEvent(pointer('pointerup', 7));
    second.dispatchEvent(pointer('pointerup', 8));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSecond).toHaveBeenCalledTimes(1);
  });

  // The button may open a modal or change the page. The click of the same
  // touch then lands on whatever is under the finger now.
  it('swallows the click of that touch when it lands on another element', () => {
    const backdrop = document.querySelector('#backdrop')!;
    const onBackdrop = vi.fn<() => void>();
    backdrop.addEventListener('click', onBackdrop);

    button.dispatchEvent(pointer('pointerdown', 7));
    button.dispatchEvent(pointer('pointerup', 7));
    backdrop.dispatchEvent(pointer('click', 7));

    expect(onBackdrop).not.toHaveBeenCalled();
  });

  it('swallows the following click when the browser sends it as a mouse click', () => {
    button.dispatchEvent(pointer('pointerdown', 7));
    button.dispatchEvent(pointer('pointerup', 7));
    vi.advanceTimersByTime(20);
    button.dispatchEvent(pointer('click', 1, 'mouse'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('swallows the following click when the browser reports no pointer id for it', () => {
    button.dispatchEvent(pointer('pointerdown', 7));
    button.dispatchEvent(pointer('pointerup', 7));
    vi.advanceTimersByTime(20);
    button.dispatchEvent(new Event('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // Overlapping touches send no click. The next unrelated tap must still work.
  it('lets the click of a fresh touch through right after touches that sent no click', () => {
    const backdrop = document.querySelector('#backdrop')!;
    const onBackdrop = vi.fn<() => void>();
    backdrop.addEventListener('click', onBackdrop);

    button.dispatchEvent(pointer('pointerdown', 7));
    button.dispatchEvent(pointer('pointerup', 7));
    vi.advanceTimersByTime(50);
    backdrop.dispatchEvent(pointer('pointerdown', 8));
    backdrop.dispatchEvent(pointer('pointerup', 8));
    backdrop.dispatchEvent(pointer('click', 1, 'mouse'));

    expect(onBackdrop).toHaveBeenCalledTimes(1);
  });

  it('lets a mouse click through when its press began before a touch that sent no click', () => {
    const backdrop = document.querySelector('#backdrop')!;
    const onBackdrop = vi.fn<() => void>();
    backdrop.addEventListener('click', onBackdrop);

    backdrop.dispatchEvent(pointer('pointerdown', 1, 'mouse'));
    button.dispatchEvent(pointer('pointerdown', 7));
    button.dispatchEvent(pointer('pointerup', 7));
    backdrop.dispatchEvent(pointer('pointerup', 1, 'mouse'));
    backdrop.dispatchEvent(pointer('click', 1, 'mouse'));

    expect(onBackdrop).toHaveBeenCalledTimes(1);
  });

  it('lets a keyboard click through right after a touch', () => {
    const second = document.querySelector<HTMLButtonElement>('#b')!;
    const onSecond = vi.fn<() => void>();
    second.addEventListener('click', onSecond);

    button.dispatchEvent(pointer('pointerdown', 7));
    button.dispatchEvent(pointer('pointerup', 7));
    second.dispatchEvent(Object.assign(new Event('click', { bubbles: true }), { detail: 0 }));

    expect(onSecond).toHaveBeenCalledTimes(1);
  });

  it('does not wait for a click after a cancelled touch', () => {
    const second = document.querySelector<HTMLButtonElement>('#b')!;
    const onSecond = vi.fn<() => void>();
    second.addEventListener('click', onSecond);

    button.dispatchEvent(pointer('pointerdown', 7));
    button.dispatchEvent(pointer('pointercancel', 7));
    second.dispatchEvent(pointer('click', 1, 'mouse'));

    expect(onSecond).toHaveBeenCalledTimes(1);
  });

  it('lets a later click from another touch through', () => {
    const backdrop = document.querySelector('#backdrop')!;
    const onBackdrop = vi.fn<() => void>();
    backdrop.addEventListener('click', onBackdrop);

    button.dispatchEvent(pointer('pointerdown', 7));
    button.dispatchEvent(pointer('pointerup', 7));
    button.dispatchEvent(pointer('click', 7));
    vi.advanceTimersByTime(800);
    backdrop.dispatchEvent(pointer('click', 9));

    expect(onBackdrop).toHaveBeenCalledTimes(1);
  });

  it('leaves mouse and keyboard to the normal click', () => {
    button.dispatchEvent(pointer('pointerdown', 1, 'mouse'));
    expect(onClick).not.toHaveBeenCalled();
    button.dispatchEvent(pointer('click', 1, 'mouse'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not activate a disabled button', () => {
    button.disabled = true;
    button.dispatchEvent(pointer('pointerdown', 7));
    expect(onClick).not.toHaveBeenCalled();
  });

  // A touch inside a list that scrolls may be the start of a scroll.
  it('waits for the click inside a container that scrolls', () => {
    document.body.innerHTML =
      '<div id="list" style="overflow-y: auto"><button>Eintrag</button></div>';
    const list = document.querySelector('#list')!;
    Object.defineProperty(list, 'scrollHeight', { value: 900 });
    Object.defineProperty(list, 'clientHeight', { value: 300 });
    const entry = list.querySelector('button')!;
    const onEntry = vi.fn<() => void>();
    entry.addEventListener('click', onEntry);

    entry.dispatchEvent(pointer('pointerdown', 7));
    expect(onEntry).not.toHaveBeenCalled();

    entry.dispatchEvent(pointer('pointerup', 7));
    entry.dispatchEvent(pointer('click', 7));
    expect(onEntry).toHaveBeenCalledTimes(1);
  });
});

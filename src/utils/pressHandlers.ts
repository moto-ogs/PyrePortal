import type { PointerEvent, TouchEvent } from 'react';

/**
 * Returns onPointerDown/Up/Leave handlers that apply a scale(0.95) press effect.
 * Pass `disabled` to suppress the animation when the button is inactive.
 */
export const pressHandlers = (disabled?: boolean) => ({
  onPointerDown: (e: PointerEvent<HTMLElement>) => {
    if (!disabled) e.currentTarget.style.transform = 'scale(0.95)';
  },
  onPointerUp: (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.style.transform = '';
  },
  onPointerLeave: (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.style.transform = '';
  },
});

type PressStyle = Partial<Pick<CSSStyleDeclaration, 'transform' | 'backgroundColor' | 'boxShadow'>>;

/**
 * Returns touch handlers that write the pressed look onto the element itself.
 * A touch then costs no React render of the surrounding page.
 */
export const touchPressHandlers = (pressed: PressStyle, rest: PressStyle) => {
  const apply = (style: PressStyle) => (e: TouchEvent<HTMLElement>) => {
    Object.assign(e.currentTarget.style, style);
  };
  return { onTouchStart: apply(pressed), onTouchEnd: apply(rest), onTouchCancel: apply(rest) };
};

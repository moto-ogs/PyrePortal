import type { TouchEvent } from 'react';

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

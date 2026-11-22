import { readFileSync } from 'node:fs';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ModalBase } from './ModalBase';

// Vitest resolves CSS imports to an empty module, so read the shipped file.
const indexCss = readFileSync('src/index.css', 'utf8');

// Blur behind an open modal costs the kiosk GPU several frames per tap.
describe('ModalBase rendering cost', () => {
  it('dims the page behind a modal without blurring it', () => {
    expect(indexCss).toMatch(/dialog::backdrop\s*{[^}]*background-color:\s*rgba\(0, 0, 0, 0\.4\)/);
    expect(indexCss).not.toContain('backdrop-filter');
  });

  it('renders the modal surface without a backdrop filter', () => {
    render(
      <ModalBase isOpen onClose={() => undefined}>
        <p>Inhalt</p>
      </ModalBase>
    );
    const surface = document.querySelector<HTMLElement>('.moto-modal-container')!;
    expect(surface.style.backdropFilter).toBe('');
  });
});

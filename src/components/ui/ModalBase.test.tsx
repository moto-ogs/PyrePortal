import { readdirSync, readFileSync } from 'node:fs';

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

  it('uses no backdrop blur anywhere in the shipped source', () => {
    const offenders = readdirSync('src', { recursive: true, encoding: 'utf8' })
      .filter(file => /\.(tsx?|css)$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter(file => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths come from readdirSync('src')
        const source = readFileSync(`src/${file}`, 'utf8');
        return /backdrop-blur|backdropFilter|backdrop-filter/.test(source);
      });
    expect(offenders).toEqual([]);
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

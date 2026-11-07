import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Recompute WCAG contrast ratios from the CSS tokens so the approved palette is
// enforced in code (AC-A11Y-02.1, .2; design contrast table). At least 4.5:1
// for text pairs, at least 3:1 for borders and the focus ring.

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function readToken(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Token --${name} not found in tokens.css`);
  return match[1]!;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const bg = () => readToken('bg');
const surface = () => readToken('surface');

describe('palette contrast (AC-A11Y-02.1, .2)', () => {
  it('body text meets 4.5:1 on background and surface', () => {
    const text = readToken('text');
    expect(ratio(text, bg())).toBeGreaterThanOrEqual(4.5);
    expect(ratio(text, surface())).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text meets 4.5:1 on background and surface', () => {
    const muted = readToken('text-muted');
    expect(ratio(muted, bg())).toBeGreaterThanOrEqual(4.5);
    expect(ratio(muted, surface())).toBeGreaterThanOrEqual(4.5);
  });

  it('accent and danger meet 4.5:1 as text on background and surface', () => {
    for (const token of ['accent', 'danger']) {
      const c = readToken(token);
      expect(ratio(c, bg())).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c, surface())).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('dark text on accent and danger fills meets 4.5:1', () => {
    const onAccent = readToken('on-accent');
    expect(ratio(onAccent, readToken('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(onAccent, readToken('danger'))).toBeGreaterThanOrEqual(4.5);
  });

  it('focus ring and border meet at least 3:1 against adjacent colors', () => {
    const focus = readToken('focus');
    const border = readToken('border');
    expect(ratio(focus, bg())).toBeGreaterThanOrEqual(3);
    expect(ratio(focus, surface())).toBeGreaterThanOrEqual(3);
    expect(ratio(border, bg())).toBeGreaterThanOrEqual(3);
    expect(ratio(border, surface())).toBeGreaterThanOrEqual(3);
  });
});

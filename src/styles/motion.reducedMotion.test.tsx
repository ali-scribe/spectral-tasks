import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '../state/AppContext.tsx';
import { createInitialState } from '../state/initialState.ts';
import type { LoadResult } from '../storage/storageService.ts';
import { GhostCompanion } from '../components/dashboard/GhostCompanion.tsx';

// 13.2: reduced-motion safety (AC-A11Y-02.3, .4, EC-16).

const motionCss = readFileSync(join(process.cwd(), 'src/styles/motion.css'), 'utf8');

describe('motion.css reduced-motion block', () => {
  it('has a prefers-reduced-motion: reduce media query', () => {
    expect(motionCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it('disables animation and transition inside that block', () => {
    const match = motionCss.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\}\s*\}/);
    expect(match).not.toBeNull();
    const block = match![1]!;
    expect(block).toMatch(/animation:\s*none\s*!important/);
    expect(block).toMatch(/transition:\s*none\s*!important/);
  });
});

describe('GhostCompanion under reduced motion (EC-16)', () => {
  it('still renders its message text', () => {
    // jsdom defaults prefers-reduced-motion to reduce (no matchMedia match),
    // and the component renders message text regardless of motion preference.
    const load: LoadResult = {
      tasks: [],
      lastGoalCelebrationDate: null,
      storageMode: 'normal',
      notices: [],
    };
    const state = createInitialState(load, '2026-06-15');
    render(
      <AppProvider initialState={state}>
        <GhostCompanion />
      </AppProvider>,
    );
    // The idle message is present as visible text.
    expect(screen.getByText(/drifts quietly/i)).toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getManorStage, getNextStageInfo } from './manor.ts';

describe('getManorStage boundaries (AC-MANOR-01.2)', () => {
  it.each([
    [0, 0],
    [1, 1],
    [4, 1],
    [5, 2],
    [9, 2],
    [10, 3],
    [19, 3],
    [20, 4],
    [34, 4],
    [35, 5],
    [1000, 5],
  ])('count %i maps to stage %i', (count, stage) => {
    expect(getManorStage(count)).toBe(stage);
  });

  it('clamps negative counts to stage 0', () => {
    expect(getManorStage(-5)).toBe(0);
  });
});

describe('getNextStageInfo (AC-MANOR-01.7, .8)', () => {
  it('reports the next stage name and remaining count', () => {
    expect(getNextStageInfo(0)).toEqual({ name: 'Awakening', remaining: 1 });
    expect(getNextStageInfo(3)).toEqual({ name: 'Stirring', remaining: 2 });
    expect(getNextStageInfo(34)).toEqual({ name: 'Enchanted', remaining: 1 });
  });

  it('returns null at the top stage', () => {
    expect(getNextStageInfo(35)).toBeNull();
    expect(getNextStageInfo(100)).toBeNull();
  });
});

// Property 18: Manor stage is a monotonic function of the completed count
// Validates: Requirements 12.1, 12.2, 12.3, 12.5, 12.9, 12.12
describe('Property 18: manor stage monotonicity', () => {
  it('is non-decreasing in the completed count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 200 }),
        (a, b) => {
          const n = Math.min(a, b);
          const m = Math.max(a, b);
          return getManorStage(n) <= getManorStage(m);
        },
      ),
    );
  });

  it('matches the threshold definition', () => {
    const expected = (n: number) =>
      n >= 35 ? 5 : n >= 20 ? 4 : n >= 10 ? 3 : n >= 5 ? 2 : n >= 1 ? 1 : 0;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (n) => getManorStage(n) === expected(n)),
    );
  });
});

// Property 19: Next-stage remaining count
// Validates: Requirements 12.7, 12.8
describe('Property 19: next-stage remaining count', () => {
  it('remaining is positive and lands exactly on the next stage', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 34 }), (n) => {
        const info = getNextStageInfo(n);
        if (info === null) return false;
        return (
          info.remaining > 0 &&
          getManorStage(n + info.remaining) === getManorStage(n) + 1 &&
          getManorStage(n + info.remaining - 1) === getManorStage(n)
        );
      }),
    );
  });

  it('is null for counts at or above 35', () => {
    fc.assert(
      fc.property(fc.integer({ min: 35, max: 500 }), (n) => getNextStageInfo(n) === null),
    );
  });
});

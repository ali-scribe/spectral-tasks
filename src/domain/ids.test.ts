import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createId } from './ids.ts';

// Property 25: Unique ids
// Validates: Requirements 1.4, 13.2
describe('createId (Property 25: unique ids)', () => {
  it('produces non-empty strings', () => {
    const id = createId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('produces distinct ids across many calls', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), (count) => {
        const ids = new Set<string>();
        for (let i = 0; i < count; i += 1) {
          ids.add(createId());
        }
        return ids.size === count;
      }),
      { numRuns: 100 },
    );
  });

  it('matches the UUID v4 shape', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (let i = 0; i < 100; i += 1) {
      expect(createId()).toMatch(uuid);
    }
  });
});

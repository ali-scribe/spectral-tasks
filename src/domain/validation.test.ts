import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateTaskInput, type RawTaskInput } from './validation.ts';
import {
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MIN_ESTIMATED_MINUTES,
  MAX_ESTIMATED_MINUTES,
} from './constants.ts';

function raw(partial: Partial<RawTaskInput>): RawTaskInput {
  return {
    title: 'Sweep the hall',
    description: '',
    category: '',
    priority: '',
    dueDate: '',
    estimatedMinutes: '',
    ...partial,
  };
}

describe('validateTaskInput - title (AC-VAL-01.1, .2, AC-TASK-01.3)', () => {
  it('rejects a whitespace-only title', () => {
    const result = validateTaskInput(raw({ title: '   ' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.title).toBeDefined();
  });

  it('accepts a 100-character title and trims it', () => {
    const title = 'x'.repeat(MAX_TITLE_LENGTH);
    const result = validateTaskInput(raw({ title: `  ${title}  ` }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe(title);
  });

  it('rejects a 101-character title', () => {
    const result = validateTaskInput(raw({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.title).toBeDefined();
  });
});

describe('validateTaskInput - description (AC-VAL-01.3)', () => {
  it('accepts a 1000-character description', () => {
    const result = validateTaskInput(raw({ description: 'd'.repeat(MAX_DESCRIPTION_LENGTH) }));
    expect(result.ok).toBe(true);
  });

  it('rejects a 1001-character description', () => {
    const result = validateTaskInput(raw({ description: 'd'.repeat(MAX_DESCRIPTION_LENGTH + 1) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.description).toBeDefined();
  });
});

describe('validateTaskInput - due date (AC-VAL-01.4, .7, .8)', () => {
  it('stores an empty due date as null', () => {
    const result = validateTaskInput(raw({ dueDate: '' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.dueDate).toBeNull();
  });

  it('rejects Feb 30', () => {
    const result = validateTaskInput(raw({ dueDate: '2026-02-30' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.dueDate).toBeDefined();
  });

  it('accepts a past due date (overdue task)', () => {
    const result = validateTaskInput(raw({ dueDate: '2000-01-01' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.dueDate).toBe('2000-01-01');
  });
});

describe('validateTaskInput - estimated minutes (AC-VAL-01.5, .6)', () => {
  it('stores empty minutes as null', () => {
    const result = validateTaskInput(raw({ estimatedMinutes: '' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.estimatedMinutes).toBeNull();
  });

  it.each([
    ['0', false],
    ['1', true],
    ['1440', true],
    ['1441', false],
    ['30.5', false],
    ['-5', false],
    ['abc', false],
  ])('minutes "%s" ok=%s', (value, ok) => {
    const result = validateTaskInput(raw({ estimatedMinutes: value }));
    expect(result.ok).toBe(ok);
  });

  it('keeps boundary values', () => {
    const lo = validateTaskInput(raw({ estimatedMinutes: String(MIN_ESTIMATED_MINUTES) }));
    const hi = validateTaskInput(raw({ estimatedMinutes: String(MAX_ESTIMATED_MINUTES) }));
    if (lo.ok) expect(lo.value.estimatedMinutes).toBe(MIN_ESTIMATED_MINUTES);
    if (hi.ok) expect(hi.value.estimatedMinutes).toBe(MAX_ESTIMATED_MINUTES);
  });
});

describe('validateTaskInput - defaults (AC-TASK-01.5, .6)', () => {
  it('defaults missing category to Other and priority to Medium', () => {
    const result = validateTaskInput(raw({ category: '', priority: '' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.category).toBe('Other');
      expect(result.value.priority).toBe('Medium');
    }
  });

  it('keeps an explicit category and priority', () => {
    const result = validateTaskInput(raw({ category: 'Study', priority: 'High' }));
    if (result.ok) {
      expect(result.value.category).toBe('Study');
      expect(result.value.priority).toBe('High');
    }
  });
});

// Property 10: Form input validation and defaults
// Validates: Requirements 1.1, 1.3, 1.5, 1.6, 1.7, 1.9, 14.1, 14.2, 14.3, 14.4,
//            14.5, 14.6, 14.7, 14.8
describe('Property 10: form input validation and defaults', () => {
  it('succeeds iff all field rules hold, and normalizes on success', () => {
    const arbMinutes = fc.oneof(
      fc.constant(''),
      fc.integer({ min: -10, max: 1500 }).map(String),
      fc.constant('12.5'),
      fc.constant('abc'),
    );
    const arbDue = fc.oneof(
      fc.constant(''),
      fc.constant('2026-07-04'),
      fc.constant('2000-01-01'),
      fc.constant('2026-02-30'),
      fc.constant('bad'),
    );

    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        arbDue,
        arbMinutes,
        (title, description, dueDate, estimatedMinutes) => {
          const input = raw({ title, description, dueDate, estimatedMinutes });
          const result = validateTaskInput(input);

          const trimmed = title.trim();
          const titleOk = trimmed.length >= 1 && trimmed.length <= MAX_TITLE_LENGTH;
          const descOk = description.length <= MAX_DESCRIPTION_LENGTH;
          const dueOk =
            dueDate.trim() === '' ||
            (/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim()) && dueDate.trim() !== '2026-02-30');
          const minTrim = estimatedMinutes.trim();
          const minOk =
            minTrim === '' ||
            (/^\d+$/.test(minTrim) &&
              Number(minTrim) >= MIN_ESTIMATED_MINUTES &&
              Number(minTrim) <= MAX_ESTIMATED_MINUTES);

          const expectedOk = titleOk && descOk && dueOk && minOk;
          if (result.ok !== expectedOk) {
            return false;
          }

          if (result.ok) {
            return (
              result.value.title === trimmed &&
              (dueDate.trim() === ''
                ? result.value.dueDate === null
                : result.value.dueDate === dueDate.trim()) &&
              (minTrim === ''
                ? result.value.estimatedMinutes === null
                : result.value.estimatedMinutes === Number(minTrim)) &&
              result.value.category === 'Other' &&
              result.value.priority === 'Medium'
            );
          }
          return true;
        },
      ),
    );
  });
});

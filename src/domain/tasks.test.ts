import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createTask, updateTask, completeTask, reopenTask } from './tasks.ts';
import type { ValidTaskInput } from './validation.ts';
import type { TaskStatus, TaskSource } from './types.ts';
import { makeTask } from '../test/factories.ts';

const input: ValidTaskInput = {
  title: 'Sweep the hall',
  description: 'Thoroughly',
  category: 'Study',
  priority: 'High',
  dueDate: '2026-07-04',
  estimatedMinutes: 30,
};

describe('createTask (AC-TASK-01.1, .4, .7, .9)', () => {
  it('creates an active, uncompleted, user-sourced task from input', () => {
    const task = createTask(input, 'id-1', '2026-01-01T10:00:00.000Z');
    expect(task).toMatchObject({
      id: 'id-1',
      title: 'Sweep the hall',
      category: 'Study',
      priority: 'High',
      status: 'active',
      dueDate: '2026-07-04',
      estimatedMinutes: 30,
      source: 'user',
      createdAt: '2026-01-01T10:00:00.000Z',
      completedAt: null,
    });
  });
});

describe('updateTask (AC-TASK-02.2, .5, .6, AC-DATA-01.7)', () => {
  it('keeps a completed task completed and preserves immutable fields', () => {
    const original = makeTask({
      id: 'keep',
      status: 'completed',
      completedAt: '2026-02-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      source: 'demo',
    });
    const updated = updateTask(original, { ...input, title: 'Edited' });
    expect(updated.title).toBe('Edited');
    expect(updated.id).toBe('keep');
    expect(updated.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(updated.completedAt).toBe('2026-02-02T00:00:00.000Z');
    expect(updated.status).toBe('completed');
    expect(updated.source).toBe('demo');
  });
});

describe('completeTask / reopenTask (AC-TASK-04.1, .2, .4, AC-DATA-01.3)', () => {
  it('records a completion timestamp', () => {
    const task = makeTask();
    const done = completeTask(task, '2026-03-03T08:00:00.000Z');
    expect(done.status).toBe('completed');
    expect(done.completedAt).toBe('2026-03-03T08:00:00.000Z');
  });

  it('clears the completion timestamp on reopen', () => {
    const done = completeTask(makeTask(), '2026-03-03T08:00:00.000Z');
    const reopened = reopenTask(done);
    expect(reopened.status).toBe('active');
    expect(reopened.completedAt).toBeNull();
  });

  it('records a fresh timestamp when re-completed after reopen', () => {
    const done1 = completeTask(makeTask(), '2026-03-03T08:00:00.000Z');
    const reopened = reopenTask(done1);
    const done2 = completeTask(reopened, '2026-03-04T09:00:00.000Z');
    expect(done2.completedAt).toBe('2026-03-04T09:00:00.000Z');
    expect(done2.completedAt).not.toBe(done1.completedAt);
  });
});

// Property 9: Edit preserves immutable fields
// Validates: Requirements 2.2, 2.5, 2.6, 13.7
describe('Property 9: edit preserves immutable fields', () => {
  it('never changes id, createdAt, completedAt, status or source', () => {
    const arbInput: fc.Arbitrary<ValidTaskInput> = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      description: fc.string({ maxLength: 1000 }),
      category: fc.constantFrom('Study', 'Work', 'Personal', 'Health', 'Other'),
      priority: fc.constantFrom('Low', 'Medium', 'High'),
      dueDate: fc.oneof(fc.constant(null), fc.constant('2026-07-04')),
      estimatedMinutes: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 1440 })),
    });

    const arbMeta = fc.record({
      status: fc.constantFrom<TaskStatus>('active', 'completed'),
      source: fc.constantFrom<TaskSource>('user', 'demo'),
      completed: fc.boolean(),
    });

    fc.assert(
      fc.property(
        arbMeta,
        arbInput,
        (meta, editInput) => {
          const task = makeTask({
            status: meta.status,
            source: meta.source,
            completedAt: meta.status === 'completed' ? '2026-02-02T00:00:00.000Z' : null,
          });
          const updated = updateTask(task, editInput);
          return (
            updated.id === task.id &&
            updated.createdAt === task.createdAt &&
            updated.completedAt === task.completedAt &&
            updated.status === task.status &&
            updated.source === task.source
          );
        },
      ),
    );
  });
});

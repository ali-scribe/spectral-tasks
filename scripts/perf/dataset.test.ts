import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  mulberry32,
  buildInteractionTasks,
  buildColdLoadTasks,
  serializeInteractionDataset,
  serializeColdLoadDataset,
  consoleSnippet,
  datasetFiles,
  INTERACTION_REOPEN_ID,
} from './dataset.ts';
import { parseStoredValue } from '../../src/storage/envelope.ts';
import { STORAGE_KEY } from '../../src/domain/constants.ts';

// Requirement 20: AC-PERF-01.2, .3, .4. The generator is deterministic, so the
// data sets used for every measurement series are equivalent.

describe('seeded generator is deterministic (AC-PERF-01.4)', () => {
  it('mulberry32 repeats the same sequence for the same seed and differs across seeds', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
    const c = mulberry32(124);
    expect(Array.from({ length: 20 }, () => c())).not.toEqual(seqA);
  });

  it('two runs of data set A produce identical output', () => {
    expect(serializeInteractionDataset()).toBe(serializeInteractionDataset());
  });

  it('two runs of data set B produce identical output', () => {
    expect(serializeColdLoadDataset()).toBe(serializeColdLoadDataset());
  });

  it('two runs of the file list produce identical files', () => {
    expect(datasetFiles()).toEqual(datasetFiles());
  });

  it('the two data sets differ from each other', () => {
    expect(serializeInteractionDataset()).not.toBe(serializeColdLoadDataset());
  });
});

describe('data set A: 500 active tasks plus 1 completed task (AC-PERF-01.2)', () => {
  const tasks = buildInteractionTasks();

  it('has exactly 500 active tasks and one completed task to reopen', () => {
    expect(tasks).toHaveLength(501);
    expect(tasks.filter((t) => t.status === 'active')).toHaveLength(500);
    const completed = tasks.filter((t) => t.status === 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]!.id).toBe(INTERACTION_REOPEN_ID);
    expect(completed[0]!.completedAt).not.toBeNull();
  });

  it('has unique ids and a spread of categories and priorities', () => {
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
    expect(new Set(tasks.map((t) => t.category)).size).toBeGreaterThan(1);
    expect(new Set(tasks.map((t) => t.priority)).size).toBeGreaterThan(1);
  });

  it('is accepted by the app parser with nothing discarded', () => {
    const outcome = parseStoredValue(serializeInteractionDataset());
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') {
      expect(outcome.discarded).toBe(0);
      expect(outcome.tasks).toHaveLength(501);
      expect(outcome.lastGoalCelebrationDate).toBeNull();
    }
  });
});

describe('data set B: 500 representative mixed tasks (AC-PERF-01.3)', () => {
  const tasks = buildColdLoadTasks();

  it('has 500 tasks: 350 active and 150 completed', () => {
    expect(tasks).toHaveLength(500);
    expect(tasks.filter((t) => t.status === 'active')).toHaveLength(350);
    expect(tasks.filter((t) => t.status === 'completed')).toHaveLength(150);
  });

  it('has unique ids and completion timestamps only on completed tasks', () => {
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
    for (const t of tasks) {
      expect(t.completedAt !== null).toBe(t.status === 'completed');
    }
  });

  it('is accepted by the app parser with nothing discarded', () => {
    const outcome = parseStoredValue(serializeColdLoadDataset());
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') {
      expect(outcome.discarded).toBe(0);
      expect(outcome.tasks).toHaveLength(500);
    }
  });
});

describe('DevTools snippet', () => {
  it('stores exactly the envelope JSON under the app storage key', () => {
    const json = serializeColdLoadDataset();
    const snippet = consoleSnippet(json);

    const stored = new Map<string, string>();
    const fakeLocalStorage = { setItem: (k: string, v: string) => void stored.set(k, v) };
    // Run the generated script against a fake localStorage.
    new Function('localStorage', snippet)(fakeLocalStorage);

    expect([...stored.keys()]).toEqual([STORAGE_KEY]);
    expect(stored.get(STORAGE_KEY)).toBe(json);
  });
});

describe('tooling stays out of the app (AC-NFR-01.5, AC-NFR-01.6)', () => {
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it('no file under src/ imports anything from scripts/', () => {
    const importsScripts = /from\s+['"][^'"]*scripts\/|import\(\s*['"][^'"]*scripts\//;
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter((file) =>
      importsScripts.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

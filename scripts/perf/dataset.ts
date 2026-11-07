// Deterministic data sets for the Requirement 20 performance procedure
// (AC-PERF-01.2, .3, .4). Dev/test tooling only: nothing in src/ imports this
// file, so it never reaches the production bundle.
//
// Every value is derived from a fixed seed and fixed base dates, using UTC
// arithmetic only, so repeated runs produce byte-identical output on any
// machine and in any time zone.

import { CATEGORIES, PRIORITIES, type Task } from '../../src/domain/types.ts';
import { STORAGE_KEY } from '../../src/domain/constants.ts';
import { serializeEnvelope } from '../../src/storage/envelope.ts';

/** Seed for data set A (interaction series). */
export const INTERACTION_SEED = 20260101;
/** Seed for data set B (cold-load series). */
export const COLD_LOAD_SEED = 20260102;

/** Data set A: 500 Active_Tasks plus one Completed_Task to reopen (AC-PERF-01.2). */
export const INTERACTION_ACTIVE_COUNT = 500;
export const INTERACTION_REOPEN_ID = 'perf-a-reopen';

/** Data set B: 500 representative Tasks, 30% completed (AC-PERF-01.3). */
export const COLD_LOAD_TOTAL = 500;
export const COLD_LOAD_COMPLETED = 150;

const BASE_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** mulberry32: a small, well-known seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

const VERBS = [
  'Read', 'Write', 'Review', 'Plan', 'Call', 'Clean',
  'Practise', 'Submit', 'Prepare', 'Organise', 'Revise', 'Book',
] as const;

const OBJECTS = [
  'chapter notes', 'lab report', 'study group', 'budget sheet',
  'reading list', 'gym session', 'project outline', 'email backlog',
  'flashcards', 'travel plans', 'essay draft', 'grocery list',
] as const;

const DESCRIPTIONS = [
  'Set aside a quiet hour for this.',
  'Check the deadline before starting.',
  'Needs a few notes from last week.',
  'Ask for feedback when finished.',
] as const;

interface BuildOptions {
  rng: () => number;
  idPrefix: string;
  /** Zero-based position, used for ids, titles and creation times. */
  index: number;
  status: 'active' | 'completed';
}

/** Builds one valid Task. The call order of rng() is fixed, which keeps output stable. */
function buildTask({ rng, idPrefix, index, status }: BuildOptions): Task {
  const number = String(index + 1).padStart(4, '0');
  const createdMs = BASE_MS + index * MINUTE_MS;

  const verb = pick(rng, VERBS);
  const object = pick(rng, OBJECTS);
  const category = pick(rng, CATEGORIES);
  const priority = pick(rng, PRIORITIES);
  const hasDescription = rng() >= 0.4;
  const description = hasDescription ? pick(rng, DESCRIPTIONS) : '';
  const hasDueDate = rng() >= 0.25;
  const dueOffsetDays = Math.floor(rng() * 730);
  const hasEstimate = rng() >= 0.3;
  const estimateSteps = 1 + Math.floor(rng() * 36);
  const completionDelayMinutes = 1 + Math.floor(rng() * 14 * 24 * 60);

  return {
    id: `${idPrefix}-${number}`,
    title: `${verb} ${object} ${number}`,
    description,
    category,
    priority,
    status,
    // Fixed absolute dates (UTC arithmetic, no local time zone involved).
    dueDate: hasDueDate
      ? new Date(BASE_MS + dueOffsetDays * DAY_MS).toISOString().slice(0, 10)
      : null,
    estimatedMinutes: hasEstimate ? estimateSteps * 5 : null,
    source: 'user',
    createdAt: new Date(createdMs).toISOString(),
    completedAt:
      status === 'completed'
        ? new Date(createdMs + completionDelayMinutes * MINUTE_MS).toISOString()
        : null,
  };
}

/** Data set A: 500 Active_Tasks followed by the one Completed_Task to reopen. */
export function buildInteractionTasks(): Task[] {
  const rng = mulberry32(INTERACTION_SEED);
  const tasks: Task[] = [];
  for (let i = 0; i < INTERACTION_ACTIVE_COUNT; i += 1) {
    tasks.push(buildTask({ rng, idPrefix: 'perf-a', index: i, status: 'active' }));
  }
  const reopen = buildTask({
    rng,
    idPrefix: 'perf-a',
    index: INTERACTION_ACTIVE_COUNT,
    status: 'completed',
  });
  tasks.push({ ...reopen, id: INTERACTION_REOPEN_ID, dueDate: null });
  return tasks;
}

/** Data set B: 500 Tasks, every tenth block of three completed (exactly 150 completed). */
export function buildColdLoadTasks(): Task[] {
  const rng = mulberry32(COLD_LOAD_SEED);
  const tasks: Task[] = [];
  for (let i = 0; i < COLD_LOAD_TOTAL; i += 1) {
    const status = i % 10 < 3 ? 'completed' : 'active';
    tasks.push(buildTask({ rng, idPrefix: 'perf-b', index: i, status }));
  }
  return tasks;
}

/** The exact string the app stores under STORAGE_KEY for data set A. */
export function serializeInteractionDataset(): string {
  return serializeEnvelope(buildInteractionTasks(), null);
}

/** The exact string the app stores under STORAGE_KEY for data set B. */
export function serializeColdLoadDataset(): string {
  return serializeEnvelope(buildColdLoadTasks(), null);
}

/**
 * A one-statement script that stores the given envelope JSON in LocalStorage.
 * Pasting it into the DevTools console (or running it as a DevTools snippet)
 * avoids hand-escaping the JSON.
 */
export function consoleSnippet(envelopeJson: string): string {
  return `localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(envelopeJson)});\n`;
}

export interface DatasetFile {
  /** Envelope JSON file name. */
  json: string;
  /** DevTools snippet file name. */
  snippet: string;
  content: string;
  description: string;
}

/** The files the CLI writes. */
export function datasetFiles(): DatasetFile[] {
  return [
    {
      json: 'interaction-500-active-plus-1-completed.json',
      snippet: 'interaction-500-active-plus-1-completed.console.js',
      content: serializeInteractionDataset(),
      description: 'Data set A: 500 active tasks + 1 completed task (interaction series)',
    },
    {
      json: 'coldload-500-mixed.json',
      snippet: 'coldload-500-mixed.console.js',
      content: serializeColdLoadDataset(),
      description: 'Data set B: 500 mixed tasks, 350 active + 150 completed (cold-load series)',
    },
  ];
}

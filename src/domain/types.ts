// Shared domain types for Spectral Tasks.
//
// Category, Priority, TaskStatus and TaskSource are modelled as closed unions so
// the compiler rejects any value outside the allowed sets (AC-DATA-01.6).

export const CATEGORIES = ['Study', 'Work', 'Personal', 'Health', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ['Low', 'Medium', 'High'] as const;
export type Priority = (typeof PRIORITIES)[number];

export type TaskStatus = 'active' | 'completed';
export type TaskSource = 'user' | 'demo';
export type ViewId = 'today' | 'upcoming' | 'all' | 'completed';
export type ManorStageId = 0 | 1 | 2 | 3 | 4 | 5;

/** A single unit of work. See Requirement 13 (REQ-DATA-01) for the field rules. */
export interface Task {
  /** Non-empty string, unique within the Task_Store (AC-DATA-01.1/.2). */
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: TaskStatus;
  /** "YYYY-MM-DD" calendar date with no time or time zone, or null (AC-DATA-01.4). */
  dueDate: string | null;
  /** Whole number of minutes, or null (AC-VAL-01.5/.6). */
  estimatedMinutes: number | null;
  /** Origin of the Task; set once at creation and never changed (AC-TASK-01.9, AC-TASK-02.6). */
  source: TaskSource;
  /** ISO 8601 UTC timestamp (Date.toISOString) (AC-DATA-01.1). */
  createdAt: string;
  /** ISO 8601 UTC timestamp; non-null if and only if status is "completed" (AC-DATA-01.3). */
  completedAt: string | null;
}

/** The persisted object written to LocalStorage (AC-DATA-01.5, AC-PERS-01.3). */
export interface StorageEnvelope {
  /** Integer identifying the stored format; 1 in the MVP (AC-PERS-01.3). */
  schemaVersion: number;
  tasks: Task[];
  /** "YYYY-MM-DD" or null; celebration metadata only (AC-GHOST-01.12). */
  lastGoalCelebrationDate: string | null;
}

/** Active filter and search state applied to the current View (REQ-ORG-02). */
export interface Filters {
  search: string;
  category: Category | 'all';
  priority: Priority | 'all';
}

/** Whether the app can persist to LocalStorage (design, Application State). */
export type StorageMode = 'normal' | 'readOnly' | 'memoryOnly';

/** Identifier for the kind of user-facing storage notice (REQ-PERS-02). */
export type NoticeId =
  | 'corrupted'
  | 'discarded'
  | 'newer-version'
  | 'storage-unavailable'
  | 'quota'
  | 'backup-failed';

/** A user-facing message about storage health (AC-PERS-02.3/.5/.6/.8/.9/.15). */
export interface Notice {
  id: NoticeId;
  tone: 'info' | 'warning' | 'error';
  text: string;
  /** When true the notice cannot be dismissed. */
  persistent: boolean;
}

/** The current Ghost_Companion reaction (REQ-GHOST-01). */
export interface GhostState {
  kind: 'idle' | 'summon' | 'celebrate' | 'goal';
  message: string;
  /** Monotonic sequence used so a stale GHOST_IDLE cannot reset a newer reaction. */
  seq: number;
}

/** A message queued for a polite live region (AC-A11Y-01.8). */
export interface Announcement {
  text: string;
  seq: number;
}

/** A pending manor stage-increase announcement (AC-MANOR-01.6). */
export interface ManorNotice {
  stage: ManorStageId;
  seq: number;
}

/** Transient UI state that is never persisted. */
export interface UiState {
  view: ViewId;
  filters: Filters;
  editingId: string | null;
}

/** The complete in-memory application state held by the reducer. */
export interface AppState {
  tasks: Task[];
  /** Also the in-memory celebration fallback when storage cannot persist it (AC-GHOST-01.13). */
  lastGoalCelebrationDate: string | null;
  /** Last known Local_Today (AC-ORG-01.9). */
  today: string;
  storageMode: StorageMode;
  notices: Notice[];
  ghost: GhostState;
  announcement: Announcement | null;
  manorNotice: ManorNotice | null;
  ui: UiState;
}

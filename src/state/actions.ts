// Reducer action types (design, Reducer Actions). Ids and timestamps are passed
// in the payload so the reducer stays pure and testable (design D2).

import type { Task, ViewId, Filters, NoticeId } from '../domain/types.ts';
import type { ValidTaskInput } from '../domain/validation.ts';
import type { SaveResult } from '../storage/storageService.ts';

export type Action =
  | { type: 'CREATE_TASK'; input: ValidTaskInput; id: string; nowIso: string }
  | { type: 'UPDATE_TASK'; id: string; input: ValidTaskInput }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'COMPLETE_TASK'; id: string; nowIso: string; today: string }
  | { type: 'REOPEN_TASK'; id: string }
  | { type: 'LOAD_DEMO'; tasks: Task[] }
  | { type: 'REMOVE_DEMO' }
  | { type: 'DATE_CHECK'; today: string }
  | { type: 'PERSIST_RESULT'; result: SaveResult }
  | { type: 'GHOST_IDLE'; seq: number }
  | { type: 'DISMISS_NOTICE'; id: NoticeId }
  | { type: 'SET_VIEW'; view: ViewId }
  | { type: 'SET_FILTERS'; filters: Partial<Filters> }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'OPEN_EDIT'; id: string }
  | { type: 'CLOSE_EDIT' };

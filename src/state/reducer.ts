// The single pure state transition for Spectral Tasks. All time and id values
// arrive in action payloads (design D2), so this function is deterministic and
// fully testable without a clock. It never performs IO; persistence is a
// separate effect (usePersistence).

import type { AppState, Task, Notice, GhostState } from '../domain/types.ts';
import { DAILY_GOAL } from '../domain/constants.ts';
import { createTask, updateTask, completeTask, reopenTask } from '../domain/tasks.ts';
import { removeDemoTasks } from '../domain/demo.ts';
import { countCompletedOn, getCounts } from '../domain/selectors.ts';
import { getManorStage } from '../domain/manor.ts';
import { decideCompletionReaction, GHOST_MESSAGES } from '../domain/ghost.ts';
import type { Action } from './actions.ts';

/** Advances the ghost to a new reaction, bumping the sequence so a stale
 * GHOST_IDLE cannot reset it (AC-GHOST-01.6). */
function react(state: AppState, kind: GhostState['kind'], message: string): GhostState {
  return { kind, message, seq: state.ghost.seq + 1 };
}

/** Bumps the announcement sequence so repeated identical texts still announce. */
function announce(state: AppState, text: string): { text: string; seq: number } {
  const seq = (state.announcement?.seq ?? 0) + 1;
  return { text, seq };
}

/** Adds a notice unless one with the same id already exists (de-duplicated). */
function addNotice(notices: Notice[], notice: Notice): Notice[] {
  return notices.some((n) => n.id === notice.id) ? notices : [...notices, notice];
}

/** Sets manorNotice only when the stage increased (AC-MANOR-01.6). */
function manorNoticeFor(
  state: AppState,
  before: Task[],
  after: Task[],
): AppState['manorNotice'] {
  const stageBefore = getManorStage(getCounts(before).completed);
  const stageAfter = getManorStage(getCounts(after).completed);
  if (stageAfter > stageBefore) {
    return { stage: stageAfter, seq: (state.manorNotice?.seq ?? 0) + 1 };
  }
  return state.manorNotice;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'CREATE_TASK': {
      const task = createTask(action.input, action.id, action.nowIso);
      return {
        ...state,
        tasks: [...state.tasks, task],
        ghost: react(state, 'summon', GHOST_MESSAGES.summon),
        announcement: announce(state, 'Spirit summoned'),
      };
    }

    case 'UPDATE_TASK': {
      const existing = state.tasks.find((t) => t.id === action.id);
      if (!existing) return state;
      const nextTasks = state.tasks.map((t) =>
        t.id === action.id ? updateTask(t, action.input) : t,
      );
      // An edit can change status only indirectly? No: updateTask preserves
      // status, but a stage recompute is still cheap and correct.
      return {
        ...state,
        tasks: nextTasks,
        manorNotice: manorNoticeFor(state, state.tasks, nextTasks),
        announcement: announce(state, 'Spirit updated'),
      };
    }

    case 'DELETE_TASK': {
      const existing = state.tasks.find((t) => t.id === action.id);
      if (!existing) return state;
      const nextTasks = state.tasks.filter((t) => t.id !== action.id);
      return {
        ...state,
        tasks: nextTasks,
        announcement: announce(state, 'Spirit banished'),
      };
    }

    case 'COMPLETE_TASK': {
      const existing = state.tasks.find((t) => t.id === action.id);
      if (!existing || existing.status === 'completed') return state;

      const progressBefore = countCompletedOn(state.tasks, action.today);
      const nextTasks = state.tasks.map((t) =>
        t.id === action.id ? completeTask(t, action.nowIso) : t,
      );
      const progressAfter = countCompletedOn(nextTasks, action.today);

      const reaction = decideCompletionReaction({
        progressBefore,
        progressAfter,
        lastGoalCelebrationDate: state.lastGoalCelebrationDate,
        today: action.today,
      });

      // The goal celebration replaces the ordinary completion reaction
      // (AC-GHOST-01.16); the completion is always announced (AC-GHOST-01.17).
      const ghost =
        reaction === 'goal'
          ? react(state, 'goal', GHOST_MESSAGES.goal)
          : react(state, 'celebrate', GHOST_MESSAGES.celebrate);
      const lastGoalCelebrationDate =
        reaction === 'goal' ? action.today : state.lastGoalCelebrationDate;

      return {
        ...state,
        tasks: nextTasks,
        today: action.today,
        lastGoalCelebrationDate,
        ghost,
        announcement: announce(state, `Spirit released: ${existing.title}`),
        manorNotice: manorNoticeFor(state, state.tasks, nextTasks),
      };
    }

    case 'REOPEN_TASK': {
      const existing = state.tasks.find((t) => t.id === action.id);
      if (!existing || existing.status !== 'completed') return state;
      const nextTasks = state.tasks.map((t) =>
        t.id === action.id ? reopenTask(t) : t,
      );
      // No celebration on reopen (AC-GHOST-01.7); manor may regress but we never
      // raise a stage-increase notice here.
      return {
        ...state,
        tasks: nextTasks,
        announcement: announce(state, 'Spirit reopened'),
      };
    }

    case 'LOAD_DEMO': {
      // Ignored when tasks already exist (EC-19).
      if (state.tasks.length > 0) return state;
      return {
        ...state,
        tasks: action.tasks,
        announcement: announce(state, 'Demo spirits summoned'),
      };
    }

    case 'REMOVE_DEMO': {
      const nextTasks = removeDemoTasks(state.tasks);
      if (nextTasks.length === state.tasks.length) return state;
      return {
        ...state,
        tasks: nextTasks,
        announcement: announce(state, 'Demo spirits banished'),
      };
    }

    case 'DATE_CHECK': {
      // Passive reconciliation: update today and perform a Silent_Goal_Record if
      // the goal is already met, never playing the celebration (AC-GHOST-01.10,
      // AC-DATE-01.11). The same-interaction rule holds because a prior goal
      // completion already set lastGoalCelebrationDate to today (AC-GHOST-01.15).
      let lastGoalCelebrationDate = state.lastGoalCelebrationDate;
      if (
        countCompletedOn(state.tasks, action.today) >= DAILY_GOAL &&
        lastGoalCelebrationDate !== action.today
      ) {
        lastGoalCelebrationDate = action.today;
      }
      if (action.today === state.today && lastGoalCelebrationDate === state.lastGoalCelebrationDate) {
        return state;
      }
      return { ...state, today: action.today, lastGoalCelebrationDate };
    }

    case 'PERSIST_RESULT': {
      switch (action.result.status) {
        case 'ok':
        case 'skipped':
          return state;
        case 'quota':
          return {
            ...state,
            notices: addNotice(state.notices, {
              id: 'quota',
              tone: 'error',
              text: 'Storage is full, so this change could not be saved. It is kept for now but may be lost.',
              persistent: false,
            }),
          };
        case 'unavailable':
          return {
            ...state,
            storageMode: 'memoryOnly',
            notices: addNotice(state.notices, {
              id: 'storage-unavailable',
              tone: 'error',
              text: 'Storage became unavailable, so changes will not be saved.',
              persistent: true,
            }),
          };
        default: {
          const _exhaustive: never = action.result;
          return _exhaustive;
        }
      }
    }

    case 'GHOST_IDLE': {
      // Only reset to idle if this is the current reaction (AC-GHOST-01.6).
      if (action.seq !== state.ghost.seq) return state;
      return { ...state, ghost: { kind: 'idle', message: GHOST_MESSAGES.idle, seq: state.ghost.seq } };
    }

    case 'DISMISS_NOTICE': {
      const next = state.notices.filter((n) => !(n.id === action.id && !n.persistent));
      if (next.length === state.notices.length) return state;
      return { ...state, notices: next };
    }

    case 'SET_VIEW': {
      // Keeps filters unchanged (AC-ORG-02.8).
      if (state.ui.view === action.view) return state;
      return { ...state, ui: { ...state.ui, view: action.view } };
    }

    case 'SET_FILTERS': {
      return { ...state, ui: { ...state.ui, filters: { ...state.ui.filters, ...action.filters } } };
    }

    case 'CLEAR_FILTERS': {
      return {
        ...state,
        ui: { ...state.ui, filters: { search: '', category: 'all', priority: 'all' } },
      };
    }

    case 'OPEN_EDIT': {
      if (!state.tasks.some((t) => t.id === action.id)) return state;
      return { ...state, ui: { ...state.ui, editingId: action.id } };
    }

    case 'CLOSE_EDIT': {
      if (state.ui.editingId === null) return state;
      return { ...state, ui: { ...state.ui, editingId: null } };
    }

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// React context wiring for the single state container (design D1). Provides the
// state, the dispatch function and the replaceable Clock to the component tree.

import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AppState } from '../domain/types.ts';
import type { Clock } from '../domain/dates.ts';
import { systemClock } from '../domain/dates.ts';
import { reducer } from './reducer.ts';
import type { Action } from './actions.ts';

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<React.Dispatch<Action> | null>(null);
const ClockContext = createContext<Clock>(systemClock);

interface AppProviderProps {
  initialState: AppState;
  clock?: Clock;
  children: ReactNode;
}

export function AppProvider({ initialState, clock = systemClock, children }: AppProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <ClockContext.Provider value={clock}>
      <StateContext.Provider value={state}>
        <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
      </StateContext.Provider>
    </ClockContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = useContext(StateContext);
  if (state === null) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return state;
}

export function useAppDispatch(): React.Dispatch<Action> {
  const dispatch = useContext(DispatchContext);
  if (dispatch === null) {
    throw new Error('useAppDispatch must be used within an AppProvider');
  }
  return dispatch;
}

export function useClock(): Clock {
  return useContext(ClockContext);
}

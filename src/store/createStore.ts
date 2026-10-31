import { useSyncExternalStore } from 'react';

type Listener = () => void;

export interface Store<S> {
  getState(): S;
  setState(patch: Partial<S> | ((s: S) => Partial<S>)): void;
  subscribe(listener: Listener): () => void;
}

/** Küçük, bağımlılıksız global state; seçiciyle yalnızca ilgili dilim değişince render eder. */
export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    setState(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<S extends object, T>(store: Store<S>, selector: (s: S) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()));
}

import {useCallback, useEffect, useRef} from 'react';
import {create} from 'zustand';
import {errorText, isNetworkError} from '../lib/errors';
import {cacheGet, cacheSet} from '../services/secureCache';

/**
 * The data behind each screen: loaded from the database, kept encrypted on the phone (secureCache),
 * and shown again offline with the time it was loaded. Every screen reads one of these and draws its
 * loading, empty, error and offline states from it (components/ui/States.tsx).
 */
export type Status = 'loading' | 'ready' | 'error';

export interface Entry {
  data?: unknown;
  /** When the data was loaded from the server (ms). */
  at?: number;
  status: Status;
  error?: string;
  /** The last refresh failed for lack of a connection. */
  offline: boolean;
  refreshing: boolean;
}

interface ResourcesState {
  entries: Record<string, Entry>;
  patch: (key: string, p: Partial<Entry>) => void;
  reset: () => void;
}

const empty: Entry = {status: 'loading', offline: false, refreshing: false};

export const useResources = create<ResourcesState>(set => ({
  entries: {},
  patch: (key, p) => set(s => ({entries: {...s.entries, [key]: {...(s.entries[key] ?? empty), ...p}}})),
  reset: () => set({entries: {}}),
}));

type Loader = () => Promise<unknown>;
const inflight = new Map<string, Promise<void>>();
const loaders = new Map<string, Loader>();

export interface ResourceOptions {
  /** Keep the data on the phone for offline use (encrypted). Default true. */
  persist?: boolean;
}

export function loadResource(key: string, loader: Loader, opts: ResourceOptions = {}): Promise<void> {
  const running = inflight.get(key);
  if (running) {
    return running;
  }
  const persist = opts.persist !== false;
  const job = (async () => {
    const store = useResources.getState();
    if (persist && store.entries[key]?.data === undefined) {
      const cached = await cacheGet(key);
      if (cached && useResources.getState().entries[key]?.data === undefined) {
        store.patch(key, {data: cached.data, at: cached.at, status: 'ready'});
      }
    }
    const has = useResources.getState().entries[key]?.data !== undefined;
    store.patch(key, has ? {refreshing: true} : {status: 'loading', error: undefined});
    try {
      const data = await loader();
      const at = Date.now();
      useResources.getState().patch(key, {data, at, status: 'ready', error: undefined, offline: false, refreshing: false});
      if (persist) {
        await cacheSet(key, data, at);
      }
    } catch (e) {
      const stillHas = useResources.getState().entries[key]?.data !== undefined;
      useResources.getState().patch(key, {
        status: stillHas ? 'ready' : 'error',
        error: errorText(e),
        offline: isNetworkError(e),
        refreshing: false,
      });
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** Loads the named data again wherever it is shown (after the guard changes something). */
export function invalidate(...keys: string[]): void {
  for (const key of keys) {
    const loader = loaders.get(key);
    if (loader) {
      loadResource(key, loader).catch(() => undefined);
    }
  }
}

/** Changes the kept data in place (a notification marked read), without a reload. */
export function mutateResource<T>(key: string, fn: (data: T) => T): void {
  const entry = useResources.getState().entries[key];
  if (entry?.data !== undefined) {
    const data = fn(entry.data as T);
    useResources.getState().patch(key, {data});
    if (entry.at) {
      cacheSet(key, data, entry.at).catch(() => undefined);
    }
  }
}

export interface Resource<T> {
  data: T | undefined;
  status: Status;
  error?: string;
  offline: boolean;
  updatedAt?: number;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

export function useResource<T>(key: string | null, loader: () => Promise<T>, opts: ResourceOptions = {}): Resource<T> {
  const entry = useResources(s => (key ? s.entries[key] : undefined));
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const persist = opts.persist !== false;
  useEffect(() => {
    if (!key) {
      return;
    }
    loaders.set(key, () => loaderRef.current());
    loadResource(key, () => loaderRef.current(), {persist}).catch(() => undefined);
  }, [key, persist]);
  const refresh = useCallback(
    () => (key ? loadResource(key, () => loaderRef.current(), {persist}) : Promise.resolve()),
    [key, persist],
  );
  return {
    data: entry?.data as T | undefined,
    status: entry?.status ?? 'loading',
    error: entry?.error,
    offline: entry?.offline ?? false,
    updatedAt: entry?.at,
    refreshing: entry?.refreshing ?? false,
    refresh,
  };
}

/** Forgets every loader and in-flight load (sign-out). */
export function resetResources(): void {
  loaders.clear();
  inflight.clear();
  useResources.getState().reset();
}

import {vaultGet, vaultSet, wipeVault} from './vault';

/**
 * The last data each screen loaded, encrypted, so the app shows it offline ("Offline · updated …").
 * Government numbers are never cached: they are fetched each time and shown masked.
 */
export interface Cached<T> {
  data: T;
  /** When it was loaded from the server (ms). */
  at: number;
}

const name = (key: string) => `cache.${key.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export async function cacheGet<T>(key: string): Promise<Cached<T> | null> {
  const raw = await vaultGet(name(key));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Cached<T>;
    return parsed && typeof parsed.at === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T, at: number = Date.now()): Promise<void> {
  await vaultSet(name(key), JSON.stringify({data, at}));
}

export async function cacheWipe(): Promise<void> {
  await wipeVault('cache.');
}

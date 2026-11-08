import {vaultGet, vaultRemove, vaultSet} from './vault';

/**
 * Where supabase-js keeps the session between launches (its `auth.storage`), encrypted in the
 * keychain because a session opens payslips. Like atlas's authStorage: errors read as "nothing
 * stored", so a broken item means signing in again, never a crash.
 */
const name = (key: string) => `auth.${key.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export const authStorage = {
  getItem: (key: string): Promise<string | null> => vaultGet(name(key)),
  setItem: (key: string, value: string): Promise<void> => vaultSet(name(key), value),
  removeItem: (key: string): Promise<void> => vaultRemove(name(key)),
};

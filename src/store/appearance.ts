import {create} from 'zustand';
import {vaultGet, vaultSet} from '../services/vault';

/**
 * Light or dark: the phone's own setting by default, or one the guard picks in Account. Kept in the
 * keychain with the rest of the app's settings (a fresh install starts from the phone's setting).
 */
export type Appearance = 'system' | 'light' | 'dark';
const KEY = 'appearance';

interface AppearanceState {
  appearance: Appearance;
  load: () => Promise<void>;
  setAppearance: (a: Appearance) => Promise<void>;
}

export const useAppearance = create<AppearanceState>(set => ({
  appearance: 'system',
  load: async () => {
    const saved = await vaultGet(KEY).catch(() => null);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      set({appearance: saved});
    }
  },
  setAppearance: async a => {
    set({appearance: a});
    await vaultSet(KEY, a).catch(() => undefined);
  },
}));

/** The scheme to draw: the guard's choice, else the phone's. */
export function resolveScheme(appearance: Appearance, phone: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  return appearance === 'system' ? (phone === 'dark' ? 'dark' : 'light') : appearance;
}

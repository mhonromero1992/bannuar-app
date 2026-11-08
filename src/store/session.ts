import {create} from 'zustand';
import {supabase} from '../config/supabase';
import {isNetworkError, SESSION_ENDED} from '../lib/errors';
import {isLockOn} from '../services/appLock';
import {activate, type ActivationForm, loadAccess, signIn as authSignIn, STAFF_MESSAGE} from '../services/auth';
import {clearDownloadedFiles} from '../services/files';
import {forgetPreviousInstall} from '../services/install';
import {clearShownNotifications, stopPush} from '../services/push';
import {cacheWipe} from '../services/secureCache';
import {vaultGet, vaultSet, wipeVault} from '../services/vault';
import type {Access} from '../types/db';
import {resetResources} from './resources';
import {useUi} from './ui';

/**
 * Where the app is: starting (splash), signed out, forced to set a new password, locked, or ready.
 * The navigator shows only the screens of the current phase (src/app/_layout.tsx).
 */
export type Phase = 'starting' | 'signedOut' | 'mustChange' | 'locked' | 'ready';

interface SessionState {
  phase: Phase;
  access: Access | null;
  /** A message for the sign-in screen: the session ended, staff use the portal, no connection. */
  notice: string | null;
  start: () => Promise<void>;
  signIn: (employeeNo: string, password: string) => Promise<void>;
  activateAndSignIn: (form: ActivationForm) => Promise<void>;
  passwordChanged: () => Promise<void>;
  signOut: (notice?: string | null) => Promise<void>;
  lock: () => void;
  unlocked: () => void;
  clearNotice: () => void;
}

const ACCESS_KEY = 'access';

async function keepAccess(access: Access): Promise<void> {
  await vaultSet(ACCESS_KEY, JSON.stringify(access));
}

async function keptAccess(): Promise<Access | null> {
  const raw = await vaultGet(ACCESS_KEY);
  try {
    return raw ? (JSON.parse(raw) as Access) : null;
  } catch {
    return null;
  }
}

/** must_change_password first (HR's temporary password), then the app lock, then the app. */
async function phaseFor(access: Access): Promise<Phase> {
  if (access.must_change_password) {
    return 'mustChange';
  }
  return (await isLockOn()) ? 'locked' : 'ready';
}

let listening = false;
/** Our own sign-out also makes supabase-js say SIGNED_OUT; that one is not a "session ended". */
let signingOut = false;

export const useSession = create<SessionState>((set, get) => ({
  phase: 'starting',
  access: null,
  notice: null,

  start: async () => {
    await forgetPreviousInstall();
    if (!listening) {
      listening = true;
      // HR's temporary password ends every session: the next token refresh fails and supabase-js signs
      // out here. Wipe everything and say why.
      supabase.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT' && !signingOut && get().phase !== 'signedOut' && get().phase !== 'starting') {
          setTimeout(() => {
            if (!signingOut && get().phase !== 'signedOut') {
              get().signOut(SESSION_ENDED).catch(() => undefined);
            }
          }, 0);
        }
      });
    }
    const {data, error} = await supabase.auth.getSession();
    if (!data.session) {
      // offline with a lapsed token: open on what is kept, and renew once the phone is back online
      const kept = error && isNetworkError(error) ? await keptAccess() : null;
      if (kept?.employee) {
        set({access: kept, phase: await phaseFor(kept)});
        return;
      }
      set({phase: 'signedOut'});
      return;
    }
    try {
      const access = await loadAccess();
      if (!access.employee) {
        await get().signOut(STAFF_MESSAGE);
        return;
      }
      await keepAccess(access);
      set({access, phase: await phaseFor(access)});
    } catch (e) {
      if (isNetworkError(e)) {
        const kept = await keptAccess();
        if (kept?.employee) {
          set({access: kept, phase: await phaseFor(kept)});
          return;
        }
      }
      await get().signOut(isNetworkError(e) ? null : SESSION_ENDED);
    }
  },

  signIn: async (employeeNo, password) => {
    const access = await authSignIn(employeeNo, password);
    await keepAccess(access);
    set({access, notice: null, phase: access.must_change_password ? 'mustChange' : 'ready'});
  },

  activateAndSignIn: async form => {
    const {loginEmail} = await activate(form);
    const access = await authSignIn(form.employeeNo, form.password, loginEmail);
    await keepAccess(access);
    set({access, notice: null, phase: access.must_change_password ? 'mustChange' : 'ready'});
  },

  passwordChanged: async () => {
    const access = await loadAccess();
    await keepAccess(access);
    set({access, phase: 'ready'});
  },

  signOut: async (notice = null) => {
    if (signingOut) {
      return;
    }
    signingOut = true;
    try {
      // while the session still works: this phone's push token goes
      await stopPush().catch(() => undefined);
      await supabase.auth.signOut({scope: 'local'}).catch(() => undefined);
      // everything personal kept on the phone goes too
      await Promise.all([cacheWipe(), wipeVault(), clearDownloadedFiles(), clearShownNotifications()]);
      resetResources();
      useUi.getState().reset();
      set({phase: 'signedOut', access: null, notice});
    } finally {
      signingOut = false;
    }
  },

  lock: () => {
    if (get().phase === 'ready') {
      set({phase: 'locked'});
    }
  },
  unlocked: () => {
    if (get().phase === 'locked') {
      set({phase: get().access?.must_change_password ? 'mustChange' : 'ready'});
    }
  },
  clearNotice: () => set({notice: null}),
}));

/** The signed-in guard's employee id (screens render only when ready, so it is set). */
export const useEmployeeId = (): string => useSession(s => s.access?.employee?.id ?? '');
export const useRoles = (): string[] => useSession(s => s.access?.roles ?? []);

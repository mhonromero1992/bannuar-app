import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import {AppState} from 'react-native';
import {authStorage} from '../services/authStorage';
import {env} from './env';

/**
 * The one Supabase client. The URL and publishable key are public (src/config/env.ts); row level
 * security decides what a signed-in guard may read and write, the same rules the portal runs under.
 */
export const SUPABASE_URL = env.supabaseUrl;

export const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: {
    // The session is saved encrypted on the phone, so closing the app does not sign anyone out. Only
    // Sign out, or HR giving a temporary password (which ends every session), does.
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  // read fetch at call time (tests put their mock in place after this module loads)
  global: {fetch: (...args: Parameters<typeof fetch>) => fetch(...args)},
});

// Renew tokens while the app is open and pause in the background, as supabase-js advises for React
// Native (and as atlas does); a token that lapsed while the app slept is renewed on return.
AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

import {
  EMPLOYEE_LOGIN_DOMAIN,
  PUSH_ENABLED,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  WEBSITE_URL,
} from '@env';

/**
 * Bannuar's Supabase project, the same one the website and the HR portal use. Both values are public
 * by design: the phone holds them, and row level security in the database decides what each guard
 * may see and do. .env overrides them for another project (README: Configuration). The service role
 * (secret) key never goes in the app.
 */
export const DEFAULT_SUPABASE_URL = 'https://bcynizcgdgqznlxuzwjx.supabase.co';
export const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_rwAYUkMVmJxXiT9SnrqlxA_VsMFHK25';
export const DEFAULT_WEBSITE_URL = 'https://bannuar-website.vercel.app';
/** Same default as the activate-employee Edge Function (bannuar-portal supabase/functions/_shared). */
export const DEFAULT_LOGIN_DOMAIN = 'employees.bannuar.invalid';

const clean = (v: string | undefined) => (v ?? '').trim().replace(/\/$/, '');

export const env = {
  supabaseUrl: clean(SUPABASE_URL) || DEFAULT_SUPABASE_URL,
  supabaseKey: clean(SUPABASE_PUBLISHABLE_KEY) || DEFAULT_PUBLISHABLE_KEY,
  websiteUrl: clean(WEBSITE_URL) || DEFAULT_WEBSITE_URL,
  loginDomain: clean(EMPLOYEE_LOGIN_DOMAIN) || DEFAULT_LOGIN_DOMAIN,
  /** Push stays off until Bannuar's Firebase files are in the app (README: Push notifications). */
  pushEnabled: clean(PUSH_ENABLED).toLowerCase() === 'true',
};

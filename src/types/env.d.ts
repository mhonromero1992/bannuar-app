declare module '@env' {
  /** Supabase project URL. Defaults to Bannuar's project (src/config/env.ts). */
  export const SUPABASE_URL: string | undefined;
  /** The publishable (or legacy anon) key. Public by design; never the service role key. */
  export const SUPABASE_PUBLISHABLE_KEY: string | undefined;
  /** The public website, for /privacy and /verify. */
  export const WEBSITE_URL: string | undefined;
  /** Domain of the logins made from employee numbers; the same as the activate-employee function's. */
  export const EMPLOYEE_LOGIN_DOMAIN: string | undefined;
  /** "true" once the Firebase files are in the app. */
  export const PUSH_ENABLED: string | undefined;
}

/**
 * Messages for people. The database's own refusals are written for them already (raised with codes
 * P0001, 22023, 42501, P0002, as the portal shows them); anything else gets a plain line.
 */
export const OFFLINE_MESSAGE = 'No connection. Check your mobile data or Wi-Fi, then try again.';
export const SESSION_ENDED = 'Your session ended. Sign in again.';
export const GENERIC = 'Something went wrong. Try again in a moment.';

type ErrorLike = {code?: string; message?: string; status?: number; name?: string};

/** True when the request never reached the server (no signal, airplane mode, DNS). */
export function isNetworkError(e: unknown): boolean {
  if (!e) {
    return false;
  }
  const err = e as ErrorLike;
  if (err.name === 'AuthRetryableFetchError' || err.name === 'FunctionsFetchError') {
    return true;
  }
  const msg = err.message ?? String(e);
  return /network request failed|failed to fetch|fetch failed|network ?error|timed? ?out|load failed/i.test(msg);
}

export function errorText(e: unknown): string {
  if (!e) {
    return '';
  }
  if (isNetworkError(e)) {
    return OFFLINE_MESSAGE;
  }
  const err = e as ErrorLike;
  const code = err.code ?? '';
  if (['P0001', '22023', '42501', 'P0002'].includes(code) && err.message) {
    return err.message;
  }
  if (code === '23505') {
    return 'That is already on record.';
  }
  if (code === '23514') {
    return 'One of the values is not allowed. Check the form.';
  }
  if (code === 'PGRST301' || code === 'PGRST303' || err.status === 401) {
    return SESSION_ENDED;
  }
  if (err.message && err.message.length < 160 && !/^[A-Z_]+$/.test(err.message)) {
    return err.message;
  }
  return GENERIC;
}

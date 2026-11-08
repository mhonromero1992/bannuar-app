import {FunctionsFetchError, FunctionsHttpError} from '@supabase/supabase-js';
import {supabase} from '../config/supabase';
import {isNetworkError, OFFLINE_MESSAGE} from '../lib/errors';
import type {Access} from '../types/db';
import {run} from './db';
import {loginEmail, normalizeEmployeeNo} from './loginEmail';

// ------------------------------------------------------------------------------- activation
export type ActivationCode =
  | 'no_match'
  | 'already_active'
  | 'rate_limited'
  | 'activation_failed'
  | 'weak_password'
  | 'invalid_input'
  | 'offline'
  | 'server';

/** One plain message for each answer of the activate-employee function. Any mismatch reads the same. */
export const ACTIVATION_MESSAGES: Record<ActivationCode, string> = {
  no_match:
    'These details do not match our records. Check your employee number, birthdate and mobile number. If they are right, ask HR to check your 201 file.',
  already_active:
    'This employee number already has an account. Sign in with your password. If you forgot it, ask HR for a temporary password.',
  rate_limited: 'Too many tries. Wait 30 minutes, then try again.',
  activation_failed: 'We could not activate your account. Ask HR to check your details.',
  weak_password: 'Choose a stronger password: at least 8 characters, with letters and numbers.',
  invalid_input: 'Check the form: every field is needed.',
  offline: OFFLINE_MESSAGE,
  server: 'Something went wrong on our side. Try again in a few minutes.',
};

export class ActivationError extends Error {
  constructor(public code: ActivationCode) {
    super(ACTIVATION_MESSAGES[code]);
    this.name = 'ActivationError';
  }
}

export interface ActivationForm {
  employeeNo: string;
  /** YYYY-MM-DD */
  birthdate: string;
  mobile: string;
  password: string;
}

/** First sign-in: the Edge Function checks the three facts and makes the login. */
export async function activate(form: ActivationForm): Promise<{loginEmail: string}> {
  const {data, error} = await supabase.functions.invoke('activate-employee', {
    body: {
      employee_no: normalizeEmployeeNo(form.employeeNo),
      birthdate: form.birthdate,
      mobile_no: form.mobile.trim(),
      password: form.password,
    },
  });
  if (error) {
    if (error instanceof FunctionsFetchError || isNetworkError(error)) {
      throw new ActivationError('offline');
    }
    if (error instanceof FunctionsHttpError) {
      let code: string | undefined;
      try {
        code = ((await (error.context as Response).json()) as {code?: string}).code;
      } catch {
        code = undefined;
      }
      throw new ActivationError(code && code in ACTIVATION_MESSAGES ? (code as ActivationCode) : 'server');
    }
    throw new ActivationError('server');
  }
  const email = (data as {login_email?: string} | null)?.login_email;
  return {loginEmail: email || loginEmail(form.employeeNo)};
}

// ------------------------------------------------------------------------------- sign-in
export const STAFF_MESSAGE = 'Staff accounts use the HR portal.';

export class SignInError extends Error {
  constructor(message: string, public code = 'sign_in') {
    super(message);
    this.name = 'SignInError';
  }
}

function signInMessage(e: {code?: string; status?: number; message?: string}): string {
  if (isNetworkError(e)) {
    return OFFLINE_MESSAGE;
  }
  if (e.code === 'invalid_credentials' || /invalid login credentials/i.test(e.message ?? '')) {
    return 'The employee number or password is wrong.';
  }
  if (e.code === 'email_not_confirmed') {
    return 'This account is not ready yet. Ask HR to check it.';
  }
  if (e.code === 'user_banned') {
    return 'This account is blocked. Ask HR.';
  }
  if (e.status === 429 || /rate limit/i.test(e.message ?? '')) {
    return 'Too many tries. Wait a few minutes, then try again.';
  }
  return 'We could not sign you in. Try again in a moment.';
}

export async function loadAccess(): Promise<Access> {
  return run(supabase.rpc('my_access')) as Promise<Access>;
}

/** Employee number and password; refuses staff accounts, which use the portal. */
export async function signIn(employeeNo: string, password: string, email?: string): Promise<Access> {
  const {error} = await supabase.auth.signInWithPassword({email: email ?? loginEmail(employeeNo), password});
  if (error) {
    throw new SignInError(signInMessage(error), error.code ?? 'sign_in');
  }
  let access: Access;
  try {
    access = await loadAccess();
  } catch (e) {
    await supabase.auth.signOut({scope: 'local'}).catch(() => undefined);
    throw new SignInError(isNetworkError(e) ? OFFLINE_MESSAGE : 'We could not load your account. Try again in a moment.');
  }
  if (!access.employee) {
    await supabase.auth.signOut({scope: 'local'}).catch(() => undefined);
    throw new SignInError(STAFF_MESSAGE, 'staff_account');
  }
  return access;
}

// ------------------------------------------------------------------------------- passwords
/** At least 8 characters with a letter and a number; the project's own rules may ask for more. */
export function passwordProblem(pw: string, again: string): string | null {
  if (pw.length < 8) {
    return 'Use at least 8 characters.';
  }
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return 'Mix letters and numbers.';
  }
  if (utf8Length(pw) > 72) {
    return 'Use at most 72 characters.';
  }
  if (pw !== again) {
    return 'The two passwords are not the same.';
  }
  return null;
}

/** UTF-8 byte length (passwords are hashed with bcrypt, which reads at most 72 bytes). */
function utf8Length(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

/**
 * Sets a new password. With `current`, it is checked first (Account > Change password); the forced
 * change after HR's temporary password has just signed in and skips that. Then the
 * must_change_password flag is cleared.
 */
export async function changePassword(newPassword: string, opts: {current?: string; employeeNo?: string} = {}): Promise<void> {
  if (opts.current !== undefined && opts.employeeNo) {
    const {error} = await supabase.auth.signInWithPassword({email: loginEmail(opts.employeeNo), password: opts.current});
    if (error) {
      throw new SignInError(
        isNetworkError(error) ? OFFLINE_MESSAGE : error.code === 'invalid_credentials' ? 'Your current password is wrong.' : signInMessage(error),
      );
    }
  }
  const {error} = await supabase.auth.updateUser({password: newPassword});
  if (error) {
    const msg =
      error.code === 'same_password'
        ? 'Choose a password different from the one you have now.'
        : error.code === 'weak_password'
        ? ACTIVATION_MESSAGES.weak_password
        : isNetworkError(error)
        ? OFFLINE_MESSAGE
        : error.code === 'reauthentication_needed'
        ? 'For your safety, sign out and sign in again, then change the password.'
        : 'We could not save the new password. Try again in a moment.';
    throw new SignInError(msg, error.code ?? 'password');
  }
  await run(supabase.rpc('mark_password_changed'));
}

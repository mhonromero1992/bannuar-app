import {supabase} from '../config/supabase';
import {isPhMobile} from '../lib/format';
import type {Me, ProfileChange} from '../types/db';
import {exec, run} from './db';

/**
 * The details a guard may ask HR to change: the keys profile_change_requests_before_insert allows.
 * Anything else ("Ask HR to change position") is refused by the database.
 */
export const CHANGE_FIELDS = [
  'mobile_no',
  'email',
  'present_address',
  'provincial_address',
  'civil_status',
  'emergency_contact_name',
  'emergency_contact_relation',
  'emergency_contact_phone',
] as const;
export type ChangeField = (typeof CHANGE_FIELDS)[number];

export const FIELD_LABEL: Record<ChangeField, string> = {
  mobile_no: 'Mobile number',
  email: 'Email',
  present_address: 'Present address',
  provincial_address: 'Provincial address',
  civil_status: 'Civil status',
  emergency_contact_name: 'Emergency contact',
  emergency_contact_relation: 'Their relation to you',
  emergency_contact_phone: 'Their phone number',
};

export const CHANGE_COLUMNS = 'id,changes,reason,status,decision_note,decided_at,created_at';

export async function loadChanges(employeeId: string): Promise<ProfileChange[]> {
  return ((await run(
    supabase.from('profile_change_requests').select(CHANGE_COLUMNS).eq('employee_id', employeeId).order('created_at', {ascending: false}).limit(20),
  )) ?? []) as ProfileChange[];
}

/** Only the fields that differ from the 201 file, trimmed. */
export function changedFields(me: Partial<Record<ChangeField, string | null>>, form: Partial<Record<ChangeField, string>>): Partial<Record<ChangeField, string>> {
  const out: Partial<Record<ChangeField, string>> = {};
  for (const k of CHANGE_FIELDS) {
    const v = form[k];
    if (v === undefined) {
      continue;
    }
    const next = v.trim();
    if (next !== (me[k] ?? '').trim()) {
      out[k] = next;
    }
  }
  return out;
}

export function changeProblem(changes: Partial<Record<ChangeField, string>>): string | null {
  if (Object.keys(changes).length === 0) {
    return 'Change at least one detail first.';
  }
  if (changes.mobile_no !== undefined && !isPhMobile(changes.mobile_no)) {
    return 'Enter a mobile number like 0917 123 4567.';
  }
  if (changes.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(changes.email)) {
    return 'Enter an email address like name@example.com.';
  }
  return null;
}

export async function requestChange(input: {employeeId: string; changes: Partial<Record<ChangeField, string>>; reason: string | null}): Promise<void> {
  await exec(
    supabase.from('profile_change_requests').insert({
      employee_id: input.employeeId,
      changes: input.changes,
      reason: input.reason?.trim() || null,
    }),
  );
}

/** The current values of the fields a guard may change. */
export function currentValues(me: Me): Record<ChangeField, string> {
  const out = {} as Record<ChangeField, string>;
  for (const k of CHANGE_FIELDS) {
    out[k] = (me[k] as string | null) ?? '';
  }
  return out;
}

import {supabase} from '../config/supabase';
import {daysBetween, todayManila} from '../lib/format';
import type {LeaveBalance, LeaveRequest, LeaveType, Me} from '../types/db';
import {exec, run} from './db';

export const LEAVE_TYPE_COLUMNS =
  'id,code,name,description,days_per_year,max_days_per_request,is_paid,requires_attachment,applies_to_sex,min_service_months,sort_order';
export const LEAVE_REQUEST_COLUMNS =
  'id,employee_id,leave_type_id,start_date,end_date,days,reason,attachment_path,status,reliever_employee_id,' +
  'supervisor_note,supervisor_decided_at,hr_note,hr_decided_at,created_at,type:leave_types(code,name),' +
  'reliever:employees!leave_requests_reliever_employee_id_fkey(first_name,middle_name,last_name,suffix),' +
  'employee:employees!leave_requests_employee_id_fkey(id,employee_no,first_name,middle_name,last_name,suffix)';

export interface LeaveData {
  types: LeaveType[];
  balances: LeaveBalance[];
  requests: LeaveRequest[];
}

/**
 * Balances come from the leave_balances view (credits, used, pending for this year). The view and the
 * requests are filtered to the guard's own rows: a commander can also read their post's.
 */
export async function loadLeave(employeeId: string): Promise<LeaveData> {
  const [types, balances, requests] = await Promise.all([
    run(supabase.from('leave_types').select(LEAVE_TYPE_COLUMNS).eq('is_active', true).order('sort_order')),
    run(supabase.from('leave_balances').select('leave_type_id,code,name,year,credits,used,pending').eq('employee_id', employeeId)),
    run(
      supabase
        .from('leave_requests')
        .select(LEAVE_REQUEST_COLUMNS)
        .eq('employee_id', employeeId)
        .order('start_date', {ascending: false})
        .limit(50),
    ),
  ]);
  return {
    types: (types ?? []) as LeaveType[],
    balances: (balances ?? []) as LeaveBalance[],
    requests: (requests ?? []) as unknown as LeaveRequest[],
  };
}

export async function loadLeaveRequest(id: string): Promise<LeaveRequest | null> {
  return (await run(supabase.from('leave_requests').select(LEAVE_REQUEST_COLUMNS).eq('id', id).maybeSingle())) as LeaveRequest | null;
}

/** Calendar days, first and last day included: what leave_requests_before_insert counts. */
export function leaveDays(start: string, end: string): number {
  return daysBetween(start, end) + 1;
}

/** Leave types this employee can be offered (maternity is not offered to a male guard, and so on). */
export function typesFor(types: LeaveType[], me: Pick<Me, 'sex'> | null): LeaveType[] {
  return types.filter(t => !t.applies_to_sex || !me?.sex || t.applies_to_sex === me.sex);
}

/** A plain note about a type's rules, or null. The database checks them again when the leave is filed. */
export function leaveTypeNote(t: LeaveType, me: Pick<Me, 'date_hired'> | null, today = todayManila()): string | null {
  const notes: string[] = [];
  if (t.min_service_months > 0 && me?.date_hired) {
    const months = monthsBetween(me.date_hired, today);
    if (months < t.min_service_months) {
      notes.push(`Available after ${t.min_service_months} months of service.`);
    }
  }
  if (t.max_days_per_request) {
    notes.push(`Up to ${Number(t.max_days_per_request)} days per request.`);
  }
  if (t.requires_attachment) {
    notes.push('Attach a supporting document.');
  }
  if (!t.is_paid) {
    notes.push('Without pay.');
  }
  return notes.length ? notes.join(' ') : null;
}

function monthsBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am) - (bd < ad ? 1 : 0);
}

/** What the form must check before sending; the database's own refusals come back worded too. */
export function leaveFormProblem(f: {type: LeaveType | null; start: string | null; end: string | null; hasAttachment: boolean}, today = todayManila()): string | null {
  if (!f.type) {
    return 'Choose the kind of leave.';
  }
  if (!f.start || !f.end) {
    return 'Enter the first and last day.';
  }
  if (f.end < f.start) {
    return 'The last day is before the first day.';
  }
  if (f.start < today) {
    return 'The first day has passed. Ask HR to file leave for past days.';
  }
  const days = leaveDays(f.start, f.end);
  if (f.type.max_days_per_request && days > Number(f.type.max_days_per_request)) {
    return `${f.type.name} allows up to ${Number(f.type.max_days_per_request)} days per request.`;
  }
  if (f.type.requires_attachment && !f.hasAttachment) {
    return 'Attach the supporting document.';
  }
  return null;
}

/**
 * Files leave. leave_requests_before_insert fills in the days, the post, the status (with the commander
 * or with HR) and clears every decision field, so the app sends only what the guard chose.
 */
export async function fileLeave(input: {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  attachmentPath: string | null;
}): Promise<void> {
  await exec(
    supabase.from('leave_requests').insert({
      employee_id: input.employeeId,
      leave_type_id: input.leaveTypeId,
      start_date: input.startDate,
      end_date: input.endDate,
      reason: input.reason?.trim() || null,
      attachment_path: input.attachmentPath,
    }),
  );
}

/** Pending leave, or approved leave that has not started, can be cancelled (cancel_leave_request). */
export function canCancel(r: Pick<LeaveRequest, 'status' | 'start_date'>, today = todayManila()): boolean {
  return r.status === 'pending_supervisor' || r.status === 'pending_hr' || (r.status === 'approved' && r.start_date > today);
}

export async function cancelLeave(id: string): Promise<void> {
  await exec(supabase.rpc('cancel_leave_request', {p_request_id: id}));
}

/** Credits left this year, or null for leave types without yearly credits. */
export function daysLeft(b: LeaveBalance): number | null {
  if (b.credits === null || b.credits === undefined) {
    return null;
  }
  return Math.max(0, Number(b.credits) - Number(b.used) - Number(b.pending));
}

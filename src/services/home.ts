import {supabase} from '../config/supabase';
import {COE_PURPOSE, CONCERN_CATEGORY, COE_STATUS, CONCERN_STATUS, LEAVE_STATUS, label, REQUEST_STATUS, tone, type Tone} from '../config/labels';
import {fmtDate, fmtDateRange} from '../lib/format';
import type {Announcement, Me, Num} from '../types/db';
import {loadAnnouncements, waitingForAck} from './announcements';
import {isCommander, supervisedSiteIds} from './commander';
import {run} from './db';
import {loadNotices, waiting} from './discipline';
import {loadMe} from './profile';
import {type DocumentAlert, loadDocumentAlerts} from './records';

export interface OpenRequest {
  key: string;
  kind: 'leave' | 'coe' | 'change' | 'concern';
  id: string;
  title: string;
  detail: string;
  status: string;
  tone: Tone;
}

export interface HomeData {
  me: Me;
  toAcknowledge: Announcement[];
  latestPayslip: {id: string; label: string; payDate: string; netPay: Num} | null;
  openRequests: OpenRequest[];
  documentAlerts: DocumentAlert[];
  /** Leave waiting for this commander's endorsement; null for guards who command no post. */
  toEndorse: number | null;
  /** Notices from HR that wait for the guard (only the count is kept on the phone). */
  noticesWaiting: number;
}

type SlipRow = {id: string; net_pay: Num; period: {label: string; pay_date: string; period_end: string} | null};

/** Everything the Home screen shows, in parallel requests (each limited to the guard's own rows). */
export async function loadHome(employeeId: string, roles: string[]): Promise<HomeData> {
  const [me, announcements, slips, leave, coe, changes, concerns, documentAlerts, toEndorse, notices] = await Promise.all([
    loadMe(employeeId),
    loadAnnouncements(employeeId),
    run(
      supabase
        .from('payslips')
        .select('id,net_pay,period:payroll_periods(label,pay_date,period_end)')
        .eq('employee_id', employeeId)
        .order('created_at', {ascending: false})
        .limit(3),
    ),
    run(
      supabase
        .from('leave_requests')
        .select('id,start_date,end_date,status,type:leave_types(name)')
        .eq('employee_id', employeeId)
        .in('status', ['pending_supervisor', 'pending_hr'])
        .order('start_date'),
    ),
    run(supabase.from('coe_requests').select('id,purpose,status,due_at').eq('employee_id', employeeId).eq('status', 'pending').order('due_at')),
    run(supabase.from('profile_change_requests').select('id,status,created_at').eq('employee_id', employeeId).eq('status', 'pending')),
    run(
      supabase
        .from('payroll_concerns')
        .select('id,category,status,created_at')
        .eq('employee_id', employeeId)
        .in('status', ['open', 'in_review'])
        .order('created_at', {ascending: false}),
    ),
    loadDocumentAlerts(employeeId),
    countToEndorse(employeeId, isCommander(roles)),
    // a database without the discipline section yet answers with an error: Home still shows
    loadNotices().catch(() => []),
  ]);

  const latest = ((slips ?? []) as unknown as SlipRow[]).sort((a, b) => (b.period?.period_end ?? '').localeCompare(a.period?.period_end ?? ''))[0];
  const openRequests: OpenRequest[] = [
    ...((leave ?? []) as unknown as Array<{id: string; start_date: string; end_date: string; status: string; type: {name: string} | null}>).map(r => ({
      key: `leave:${r.id}`,
      kind: 'leave' as const,
      id: r.id,
      title: r.type?.name ?? 'Leave',
      detail: fmtDateRange(r.start_date, r.end_date),
      status: label(LEAVE_STATUS, r.status),
      tone: tone(LEAVE_STATUS, r.status),
    })),
    ...((coe ?? []) as Array<{id: string; purpose: string; status: string; due_at: string}>).map(r => ({
      key: `coe:${r.id}`,
      kind: 'coe' as const,
      id: r.id,
      title: 'Certificate of employment',
      detail: `${label(COE_PURPOSE, r.purpose)} · due ${fmtDate(r.due_at)}`,
      status: label(COE_STATUS, r.status),
      tone: tone(COE_STATUS, r.status),
    })),
    ...((changes ?? []) as Array<{id: string; status: string; created_at: string}>).map(r => ({
      key: `change:${r.id}`,
      kind: 'change' as const,
      id: r.id,
      title: 'Change of details',
      detail: `Sent ${fmtDate(r.created_at)}`,
      status: label(REQUEST_STATUS, r.status),
      tone: tone(REQUEST_STATUS, r.status),
    })),
    ...((concerns ?? []) as Array<{id: string; category: string; status: string; created_at: string}>).map(r => ({
      key: `concern:${r.id}`,
      kind: 'concern' as const,
      id: r.id,
      title: `Payroll concern: ${label(CONCERN_CATEGORY, r.category).toLowerCase()}`,
      detail: `Sent ${fmtDate(r.created_at)}`,
      status: label(CONCERN_STATUS, r.status),
      tone: tone(CONCERN_STATUS, r.status),
    })),
  ];
  return {
    me,
    toAcknowledge: waitingForAck(announcements),
    latestPayslip: latest?.period ? {id: latest.id, label: latest.period.label, payDate: latest.period.pay_date, netPay: latest.net_pay} : null,
    openRequests,
    documentAlerts,
    toEndorse,
    noticesWaiting: waiting(notices).length,
  };
}

/**
 * A commander is whoever operations names on a post (site_supervisors): that is what the database's
 * rules follow. The "supervisor" role counts too, though the portal has no screen that gives it to an
 * employee login (README: To confirm with Bannuar).
 */
async function countToEndorse(myEmployeeId: string, hasRole: boolean): Promise<number | null> {
  const ids = await supervisedSiteIds();
  if (!ids.length) {
    return hasRole ? 0 : null;
  }
  const {count, error} = await supabase
    .from('leave_requests')
    .select('id', {count: 'exact', head: true})
    .eq('status', 'pending_supervisor')
    .in('site_id', ids)
    .neq('employee_id', myEmployeeId);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

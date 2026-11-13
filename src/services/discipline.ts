import {supabase} from '../config/supabase';
import {exec, run} from './db';

/**
 * Notices from HR (schema.sql section 16): a notice to explain, the guard's written explanation, a
 * hearing, and HR's decision. The app reads them only through my_disciplinary_cases(), which gives the
 * guard what was issued to them and never HR's working notes. The database enforces the steps: at
 * least five calendar days to answer, an answer until HR decides, a hearing when asked for.
 */
export interface Notice {
  id: string;
  case_no: string;
  status: 'nte_issued' | 'explained' | 'hearing_set' | 'decided' | 'withdrawn';
  rule: {ref: string; title: string} | null;
  offense_no: number | null;
  nte_text: string;
  nte_issued_at: string;
  explain_by: string;
  nte_received_at: string | null;
  explanation: string | null;
  explained_at: string | null;
  wants_hearing: boolean;
  hearing_at: string | null;
  hearing_place: string | null;
  hearing_held_at: string | null;
  decision: 'no_violation' | 'warning' | 'reprimand' | 'suspension' | 'dismissal' | null;
  suspension_days: number | null;
  suspension_from: string | null;
  decision_text: string | null;
  decided_at: string | null;
  decision_received_at: string | null;
  preventive_from: string | null;
  preventive_to: string | null;
  preventive_reason: string | null;
  withdrawn_reason: string | null;
}

export async function loadNotices(): Promise<Notice[]> {
  return ((await run(supabase.rpc('my_disciplinary_cases'))) as Notice[] | null) ?? [];
}

/** What the guard should do next, or null when nothing waits for them. */
export function noticeAction(n: Notice): 'acknowledge' | 'explain' | 'hearing' | 'read_decision' | null {
  if (n.status === 'nte_issued') {
    return n.nte_received_at ? 'explain' : 'acknowledge';
  }
  if (n.status === 'hearing_set' && !n.hearing_held_at) {
    return 'hearing';
  }
  if (n.status === 'decided' && !n.decision_received_at) {
    return 'read_decision';
  }
  return null;
}

export const waiting = (notices: Notice[] | undefined) => (notices ?? []).filter(n => noticeAction(n) !== null);

export async function acknowledgeNotice(caseId: string, which: 'nte' | 'decision'): Promise<void> {
  await exec(supabase.rpc('acknowledge_case_notice', {p_case_id: caseId, p_which: which}));
}

export async function submitExplanation(caseId: string, text: string, wantsHearing: boolean): Promise<void> {
  await exec(supabase.rpc('submit_case_explanation', {p_case_id: caseId, p_text: text.trim(), p_wants_hearing: wantsHearing}));
}

/** A commander's report of an incident at their post (file_incident_report checks the post is theirs). */
export async function fileIncidentReport(input: {
  siteId: string;
  guardId: string | null;
  occurredAt: string;
  title: string;
  details: string;
}): Promise<{id: string; report_no: string}> {
  return (await run(
    supabase.rpc('file_incident_report', {
      p_site_id: input.siteId,
      p_employee_id: input.guardId,
      p_occurred_at: input.occurredAt,
      p_title: input.title.trim(),
      p_details: input.details.trim(),
      p_guard_described: null,
    }),
  )) as {id: string; report_no: string};
}

/** The Code of Discipline in force, which every employee may read; null before HR puts one in force. */
export async function activeCode(): Promise<{title: string; effective_on: string | null; file_key: string} | null> {
  return (await run(supabase.rpc('active_discipline_code'))) as {title: string; effective_on: string | null; file_key: string} | null;
}

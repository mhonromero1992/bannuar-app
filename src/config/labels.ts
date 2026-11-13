/**
 * Status and option wording, copied from the HR portal (bannuar-portal src/lib/labels.ts) so HR and
 * employees read the same words. __tests__/labels.test.ts compares them with the portal's file when
 * it is checked out next to this one (npm run sync:portal keeps a copy for CI).
 */
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';
type ToneMap = Record<string, [string, Tone]>;

export const EMPLOYEE_STATUS: ToneMap = {
  active: ['Active', 'ok'],
  floating: ['Floating', 'warn'],
  on_leave: ['On leave', 'info'],
  suspended: ['Suspended', 'bad'],
  awol: ['AWOL', 'bad'],
  resigned: ['Resigned', 'neutral'],
  terminated: ['Terminated', 'neutral'],
  end_of_contract: ['End of contract', 'neutral'],
  retired: ['Retired', 'neutral'],
};
export const EMPLOYMENT_TYPE: Record<string, string> = {probationary: 'Probationary', regular: 'Regular', contractual: 'Contractual', project: 'Project'};
export const LEAVE_STATUS: ToneMap = {
  pending_supervisor: ['With the commander', 'warn'],
  pending_hr: ['With HR', 'warn'],
  approved: ['Approved', 'ok'],
  rejected: ['Not approved', 'bad'],
  cancelled: ['Cancelled', 'neutral'],
};
export const ATTENDANCE_KIND: Record<string, string> = {time_in: 'Time in', time_out: 'Time out'};
/** log_attendance's check of the phone's location against the post. */
export const LOCATION_CHECK: ToneMap = {
  at_post: ['At the post', 'ok'],
  unsure: ['GPS too rough to tell', 'warn'],
  away: ['Away from the post', 'bad'],
  no_location: ['No location', 'warn'],
  post_not_set: ['Post location not set', 'neutral'],
  no_post: ['No post assigned', 'neutral'],
  manual: ['Entered by hand', 'info'],
};
export const CASE_STATUS: ToneMap = {
  draft: ['Draft', 'neutral'], nte_issued: ['Waiting for explanation', 'warn'], explained: ['Explained', 'info'],
  hearing_set: ['Hearing set', 'info'], decided: ['Decided', 'ok'], withdrawn: ['Withdrawn', 'neutral'],
};
export const CASE_DECISION: ToneMap = {
  no_violation: ['No violation', 'ok'], warning: ['Warning', 'warn'], reprimand: ['Reprimand', 'warn'], suspension: ['Suspension', 'bad'], dismissal: ['Dismissal', 'bad'],
};
/** Who logged it: the guard's own phone, the post's commander (the guard had no phone), or HR by hand. */
export const ATTENDANCE_SOURCE: ToneMap = {self: ['Own phone', 'neutral'], commander: ['By the commander', 'info'], manual: ['By hand', 'warn']};
export const COE_STATUS: ToneMap = {pending: ['Pending', 'warn'], issued: ['Issued', 'ok'], rejected: ['Declined', 'bad'], cancelled: ['Cancelled', 'neutral']};
export const COE_PURPOSE: Record<string, string> = {
  employment: 'New employment', bank_loan: 'Bank or loan', government: 'Government requirement',
  travel_visa: 'Travel or visa', school: 'School', other: 'Other',
};
export const REQUEST_STATUS: ToneMap = {pending: ['Pending', 'warn'], approved: ['Approved', 'ok'], rejected: ['Not approved', 'bad'], cancelled: ['Cancelled', 'neutral']};
export const CONCERN_STATUS: ToneMap = {open: ['Open', 'warn'], in_review: ['In review', 'info'], resolved: ['Resolved', 'ok'], closed: ['Closed', 'neutral']};
export const CONCERN_CATEGORY: Record<string, string> = {
  missing_pay: 'Missing pay', overtime: 'Overtime', night_differential: 'Night differential', holiday_pay: 'Holiday pay',
  deduction: 'Deduction', contribution: 'Contribution', tax: 'Tax', other: 'Other',
};
export const DOC_STATUS: ToneMap = {pending_review: ['To review', 'warn'], verified: ['Verified', 'ok'], rejected: ['Rejected', 'bad']};
export const ANN_PRIORITY: ToneMap = {normal: ['Normal', 'neutral'], important: ['Important', 'info'], urgent: ['Urgent', 'bad']};
export const ANN_CATEGORY: Record<string, string> = {memo: 'Memo', advisory: 'Advisory', policy: 'Policy', payroll: 'Payroll', event: 'Event', emergency: 'Emergency'};

/** App-only wording (fields the portal shows as form options). */
export const CIVIL_STATUS: Record<string, string> = {single: 'Single', married: 'Married', widowed: 'Widowed', separated: 'Separated', annulled: 'Annulled'};
export const SEX: Record<string, string> = {male: 'Male', female: 'Female'};

export const label = (m: ToneMap | Record<string, string>, v?: string | null): string => {
  if (!v) {
    return '';
  }
  const entry = (m as Record<string, unknown>)[v];
  if (Array.isArray(entry)) {
    return entry[0] as string;
  }
  return typeof entry === 'string' ? entry : v;
};
export const tone = (m: ToneMap, v?: string | null): Tone => (v && m[v] ? m[v][1] : 'neutral');
export const options = (m: ToneMap | Record<string, string>) =>
  Object.entries(m).map(([value, v]) => ({value, label: Array.isArray(v) ? v[0] : (v as string)}));

import {SUPABASE_URL, supabase} from '../config/supabase';
import type {PayrollConcern, Payslip} from '../types/db';
import {exec, run} from './db';
import {downloadAndOpen, functionHeaders} from './files';

/**
 * A guard sees a payslip only once payroll publishes its cutoff (the "read payslips" policy), and only
 * their own; the filter on employee_id keeps a detachment commander's list to their own pay too.
 */
export const PAYSLIP_COLUMNS =
  'id,payroll_period_id,site_name,days_worked,hours_worked,overtime_hours,night_diff_hours,basic_pay,overtime_pay,' +
  'night_diff_pay,holiday_pay,allowances,other_earnings,gross_pay,sss,philhealth,pagibig,withholding_tax,loans,' +
  'other_deductions,total_deductions,net_pay,earnings_detail,deductions_detail,remarks,created_at,' +
  'period:payroll_periods(id,label,period_start,period_end,pay_date)';

const byPeriod = (a: Payslip, b: Payslip) => (b.period?.period_end ?? '').localeCompare(a.period?.period_end ?? '');

export async function loadPayslips(employeeId: string): Promise<Payslip[]> {
  const rows = (await run(
    supabase.from('payslips').select(PAYSLIP_COLUMNS).eq('employee_id', employeeId).order('created_at', {ascending: false}).limit(24),
  )) as unknown as Payslip[];
  return (rows ?? []).sort(byPeriod);
}

export async function loadPayslip(id: string): Promise<Payslip | null> {
  return (await run(supabase.from('payslips').select(PAYSLIP_COLUMNS).eq('id', id).maybeSingle())) as unknown as Payslip | null;
}

export interface PayRow {
  label: string;
  amount: number;
}

const n = (v: unknown) => Number(v ?? 0) || 0;

/**
 * The lines of a payslip as the import wrote them. Extra "earning:" and "deduction:" lines are part of
 * other_earnings and other_deductions, so those totals show only what the extra lines do not explain.
 */
export function payslipLines(p: Payslip): {earnings: PayRow[]; deductions: PayRow[]} {
  const extraE = (p.earnings_detail ?? []).map(l => ({label: l.label, amount: n(l.amount)}));
  const extraD = (p.deductions_detail ?? []).map(l => ({label: l.label, amount: n(l.amount)}));
  const restE = n(p.other_earnings) - extraE.reduce((s, l) => s + l.amount, 0);
  const restD = n(p.other_deductions) - extraD.reduce((s, l) => s + l.amount, 0);
  const earnings: PayRow[] = [
    {label: 'Basic pay', amount: n(p.basic_pay)},
    {label: 'Overtime', amount: n(p.overtime_pay)},
    {label: 'Night differential', amount: n(p.night_diff_pay)},
    {label: 'Holiday pay', amount: n(p.holiday_pay)},
    {label: 'Allowances', amount: n(p.allowances)},
    ...extraE,
    {label: 'Other earnings', amount: Math.round(restE * 100) / 100},
  ];
  const deductions: PayRow[] = [
    {label: 'SSS', amount: n(p.sss)},
    {label: 'PhilHealth', amount: n(p.philhealth)},
    {label: 'Pag-IBIG', amount: n(p.pagibig)},
    {label: 'Withholding tax', amount: n(p.withholding_tax)},
    {label: 'Loans', amount: n(p.loans)},
    ...extraD,
    {label: 'Other deductions', amount: Math.round(restD * 100) / 100},
  ];
  return {earnings: earnings.filter(l => l.amount !== 0), deductions: deductions.filter(l => l.amount !== 0)};
}

/**
 * The payslip as a PDF, made on the spot by the payslip-pdf Edge Function (with the guard's own token,
 * so only their own published payslip) and opened in the phone's viewer to save, share or print.
 * Nothing is stored anywhere; the copy in the app's cache is deleted at sign-out.
 */
export async function openPayslipPdf(p: Pick<Payslip, 'id' | 'period'>): Promise<void> {
  await downloadAndOpen(
    {
      method: 'POST',
      url: `${SUPABASE_URL}/functions/v1/payslip-pdf`,
      headers: {...(await functionHeaders()), 'Content-Type': 'application/json'},
      body: JSON.stringify({payslip_id: p.id}),
    },
    `payslip-${p.period?.period_start ?? ''}-to-${p.period?.period_end ?? p.id}.pdf`,
  );
}

// ------------------------------------------------------------------------------- concerns
/** The categories payroll_concerns allows (its check constraint). */
export const CONCERN_CATEGORIES = [
  'missing_pay',
  'overtime',
  'night_differential',
  'holiday_pay',
  'deduction',
  'contribution',
  'tax',
  'other',
] as const;
export type ConcernCategory = (typeof CONCERN_CATEGORIES)[number];

export const CONCERN_COLUMNS = 'id,payslip_id,category,description,status,resolution,resolved_at,created_at';

export async function loadConcerns(employeeId: string): Promise<PayrollConcern[]> {
  return ((await run(
    supabase.from('payroll_concerns').select(CONCERN_COLUMNS).eq('employee_id', employeeId).order('created_at', {ascending: false}).limit(30),
  )) ?? []) as PayrollConcern[];
}

/** The trigger opens it as "open" and tells payroll; the guard hears back in Notifications. */
export async function reportConcern(input: {
  employeeId: string;
  payslipId: string | null;
  category: ConcernCategory;
  description: string;
}): Promise<void> {
  await exec(
    supabase.from('payroll_concerns').insert({
      employee_id: input.employeeId,
      payslip_id: input.payslipId,
      category: input.category,
      description: input.description.trim(),
    }),
  );
}

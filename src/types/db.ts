/**
 * The rows the app reads, as bannuar-portal/supabase/schema.sql defines them (only the columns the app
 * selects). __tests__/contract.test.ts checks every request against tests/schema-snapshot.json.
 * Postgres numeric columns arrive as numbers or strings; format them with lib/format.ts.
 */
export type Num = number | string;

export type Role = 'super_admin' | 'hr_admin' | 'hr_staff' | 'payroll' | 'operations' | 'management' | 'supervisor' | 'employee';

/** rpc('my_access') */
export interface Access {
  user_id: string;
  roles: Role[];
  full_name: string | null;
  email: string | null;
  must_change_password: boolean;
  employee: {id: string; employee_no: string; full_name: string; position: string; status: string; site_id: string | null} | null;
}

export interface Site {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  /** The point time in and out are checked against, and how far from it counts as at the post. */
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_m?: number | null;
}

export interface Me {
  id: string;
  employee_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birthdate: string | null;
  sex: 'male' | 'female' | null;
  civil_status: string | null;
  mobile_no: string | null;
  email: string | null;
  present_address: string | null;
  provincial_address: string | null;
  position: string;
  employment_type: string;
  status: string;
  date_hired: string | null;
  date_regularized: string | null;
  floating_since: string | null;
  site_id: string | null;
  area_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  site: Site | null;
  area: {id: string; name: string} | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: 'normal' | 'important' | 'urgent';
  requires_ack: boolean;
  pinned: boolean;
  published_at: string | null;
  expires_at: string | null;
}

export interface Receipt {
  announcement_id: string;
  read_at: string;
  acknowledged_at: string | null;
}

export interface PayLine {
  label: string;
  amount: Num;
}

export interface Payslip {
  id: string;
  payroll_period_id: string;
  site_name: string | null;
  days_worked: Num;
  hours_worked: Num;
  overtime_hours: Num;
  night_diff_hours: Num;
  basic_pay: Num;
  overtime_pay: Num;
  night_diff_pay: Num;
  holiday_pay: Num;
  allowances: Num;
  other_earnings: Num;
  gross_pay: Num;
  sss: Num;
  philhealth: Num;
  pagibig: Num;
  withholding_tax: Num;
  loans: Num;
  other_deductions: Num;
  total_deductions: Num;
  net_pay: Num;
  earnings_detail: PayLine[];
  deductions_detail: PayLine[];
  remarks: string | null;
  created_at: string;
  period: {id: string; label: string; period_start: string; period_end: string; pay_date: string} | null;
}

export interface PayrollConcern {
  id: string;
  payslip_id: string | null;
  category: string;
  description: string;
  status: string;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  days_per_year: Num | null;
  max_days_per_request: Num | null;
  is_paid: boolean;
  requires_attachment: boolean;
  applies_to_sex: 'male' | 'female' | null;
  min_service_months: number;
  sort_order: number;
}

export interface LeaveBalance {
  leave_type_id: string;
  code: string;
  name: string;
  year: number;
  credits: Num | null;
  used: Num;
  pending: Num;
}

export interface PersonName {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  suffix?: string | null;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: Num;
  reason: string | null;
  attachment_path: string | null;
  status: 'pending_supervisor' | 'pending_hr' | 'approved' | 'rejected' | 'cancelled';
  reliever_employee_id: string | null;
  supervisor_note: string | null;
  supervisor_decided_at: string | null;
  hr_note: string | null;
  hr_decided_at: string | null;
  created_at: string;
  type: {code: string; name: string} | null;
  reliever: PersonName | null;
  employee?: (PersonName & {id: string; employee_no: string}) | null;
}

export interface CertificateSummary {
  id: string;
  certificate_no: string;
  verification_code: string;
  file_path: string | null;
  issued_at: string;
  revoked_at: string | null;
}

export interface CoeRequest {
  id: string;
  purpose: string;
  purpose_details: string | null;
  include_compensation: boolean;
  addressee: string | null;
  status: 'pending' | 'issued' | 'rejected' | 'cancelled';
  due_at: string;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  certificate_id: string | null;
  certificate: CertificateSummary | null;
}

export interface Certificate extends CertificateSummary {
  purpose: string | null;
  include_compensation: boolean;
  revoked_reason: string | null;
  coe_request_id: string | null;
}

export interface DocumentType {
  id: string;
  code: string;
  name: string;
  category: string;
  has_expiry: boolean;
  employee_can_upload: boolean;
  sort_order: number;
  /** Claude reads it at upload (the LESP to start with; HR sets it in the portal). */
  ai_check?: boolean;
}

export interface EmployeeDocument {
  id: string;
  document_type_id: string;
  document_no: string | null;
  issued_on: string | null;
  expires_on: string | null;
  file_path: string | null;
  status: 'pending_review' | 'verified' | 'rejected';
  review_note: string | null;
  created_at: string;
  type: {id: string; code: string; name: string; has_expiry: boolean; employee_can_upload: boolean} | null;
}

export interface GovernmentIds {
  sss_no: string | null;
  philhealth_no: string | null;
  pagibig_no: string | null;
  tin: string | null;
  updated_at: string | null;
}

export interface ProfileChange {
  id: string;
  changes: Record<string, string>;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface NotificationLink {
  screen?: string;
  id?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  link: NotificationLink | null;
  read_at: string | null;
  created_at: string;
}

export interface Guard extends PersonName {
  id: string;
  employee_no: string;
  position: string;
  status: string;
  site_id: string | null;
}

import {supabase} from '../config/supabase';
import {env} from '../config/env';
import type {Certificate, CoeRequest} from '../types/db';
import {exec, run} from './db';
import {openPrivateFile} from './files';

/** coe_requests has two links to certificates; the request's own certificate is coe_requests_certificate_fk. */
export const COE_REQUEST_COLUMNS =
  'id,purpose,purpose_details,include_compensation,addressee,status,due_at,decision_note,decided_at,created_at,certificate_id,' +
  'certificate:certificates!coe_requests_certificate_fk(id,certificate_no,verification_code,file_path,issued_at,revoked_at)';
export const CERTIFICATE_COLUMNS =
  'id,certificate_no,verification_code,purpose,include_compensation,file_path,issued_at,revoked_at,revoked_reason,coe_request_id';

/** The purposes coe_requests allows (its check constraint). */
export const COE_PURPOSES = ['employment', 'bank_loan', 'government', 'travel_visa', 'school', 'other'] as const;
export type CoePurpose = (typeof COE_PURPOSES)[number];

export interface CoeData {
  requests: CoeRequest[];
  certificates: Certificate[];
}

export async function loadCoe(employeeId: string): Promise<CoeData> {
  const [requests, certificates] = await Promise.all([
    run(supabase.from('coe_requests').select(COE_REQUEST_COLUMNS).eq('employee_id', employeeId).order('created_at', {ascending: false}).limit(30)),
    run(supabase.from('certificates').select(CERTIFICATE_COLUMNS).eq('employee_id', employeeId).order('issued_at', {ascending: false}).limit(30)),
  ]);
  return {requests: (requests ?? []) as unknown as CoeRequest[], certificates: (certificates ?? []) as Certificate[]};
}

/**
 * The trigger sets the due date (three days, DOLE Labor Advisory 06-20), the status and clears every
 * decision field; one pending request per purpose.
 */
export async function requestCoe(input: {
  employeeId: string;
  purpose: CoePurpose;
  purposeDetails: string | null;
  includeCompensation: boolean;
  addressee: string | null;
}): Promise<void> {
  await exec(
    supabase.from('coe_requests').insert({
      employee_id: input.employeeId,
      purpose: input.purpose,
      purpose_details: input.purposeDetails?.trim() || null,
      include_compensation: input.includeCompensation,
      addressee: input.addressee?.trim() || null,
    }),
  );
}

export async function cancelCoe(id: string): Promise<void> {
  await exec(supabase.rpc('cancel_coe_request', {p_request_id: id}));
}

export function isOverdue(r: Pick<CoeRequest, 'status' | 'due_at'>, now: Date = new Date()): boolean {
  return r.status === 'pending' && Date.parse(r.due_at) < now.getTime();
}

/** The PDF is at certificates/<employee_id>/<certificate_id>.pdf (the portal records the path). */
export function certificatePath(cert: Pick<Certificate, 'id' | 'file_path'>, employeeId: string): string {
  return cert.file_path || `${employeeId}/${cert.id}.pdf`;
}

export async function openCertificate(cert: Pick<Certificate, 'id' | 'file_path' | 'certificate_no'>, employeeId: string): Promise<void> {
  await openPrivateFile('certificates', certificatePath(cert, employeeId), `${cert.certificate_no}.pdf`);
}

/** Anyone holding the paper checks its code on the website's /verify page. */
export const verifyUrl = () => `${env.websiteUrl}/verify`;

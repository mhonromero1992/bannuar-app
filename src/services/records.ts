import {supabase} from '../config/supabase';
import type {DocumentType, EmployeeDocument, GovernmentIds} from '../types/db';
import {exec, run} from './db';
import {type PickedFile, uploadEmployeeFile} from './files';

export const DOCUMENT_TYPE_COLUMNS = 'id,code,name,category,has_expiry,employee_can_upload,sort_order';
export const DOCUMENT_COLUMNS =
  'id,document_type_id,document_no,issued_on,expires_on,file_path,status,review_note,created_at,' +
  'type:document_types(id,code,name,has_expiry,employee_can_upload)';

export interface DocumentsData {
  types: DocumentType[];
  documents: EmployeeDocument[];
}

/** Only the types HR marks visible to employees; the "read documents" policy applies the same rule. */
export async function loadDocuments(employeeId: string): Promise<DocumentsData> {
  const [types, documents] = await Promise.all([
    run(supabase.from('document_types').select(DOCUMENT_TYPE_COLUMNS).eq('is_active', true).eq('visible_to_employee', true).order('sort_order')),
    run(supabase.from('employee_documents').select(DOCUMENT_COLUMNS).eq('employee_id', employeeId).order('created_at', {ascending: false})),
  ]);
  return {types: (types ?? []) as DocumentType[], documents: (documents ?? []) as unknown as EmployeeDocument[]};
}

export interface DocumentAlert {
  id: string;
  type_name: string;
  expires_on: string;
  days_left: number;
  state: 'expired' | 'expiring';
}

/** Expired and soon-expiring licenses and clearances, with each type's own reminder window (as HR sees them). */
export async function loadDocumentAlerts(employeeId: string): Promise<DocumentAlert[]> {
  return ((await run(
    supabase.from('document_alerts').select('id,type_name,expires_on,days_left,state').eq('employee_id', employeeId).order('expires_on'),
  )) ?? []) as DocumentAlert[];
}

/** Read through get_government_ids(); fetched each time, never kept on the phone. */
export async function loadGovernmentIds(employeeId: string): Promise<GovernmentIds | null> {
  const rows = (await run(supabase.rpc('get_government_ids', {p_employee_id: employeeId}))) as GovernmentIds[] | null;
  return rows?.[0] ?? null;
}

/**
 * A renewal from the phone: the file goes to employee-files/<id>/uploads/, then the row. The
 * employee_documents_before_write trigger makes it "pending_review" for HR whatever the app sends.
 */
export async function uploadRenewal(input: {
  employeeId: string;
  documentTypeId: string;
  documentNo: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  file: PickedFile;
}): Promise<void> {
  const path = await uploadEmployeeFile(input.employeeId, input.file);
  await exec(
    supabase.from('employee_documents').insert({
      employee_id: input.employeeId,
      document_type_id: input.documentTypeId,
      document_no: input.documentNo?.trim() || null,
      issued_on: input.issuedOn,
      expires_on: input.expiresOn,
      file_path: path,
    }),
  );
}

/** The newest document of each type, newest first: what the guard has on file now. */
export function latestByType(docs: EmployeeDocument[]): EmployeeDocument[] {
  const seen = new Set<string>();
  return docs.filter(d => (seen.has(d.document_type_id) ? false : (seen.add(d.document_type_id), true)));
}

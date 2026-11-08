import {supabase} from '../config/supabase';
import type {Me} from '../types/db';
import {run} from './db';

/**
 * The guard's own 201 record. Row level security lets an employee read only their own row; the post
 * is named through employees_site_id_fkey because site_supervisors also links employees and sites.
 */
export const ME_COLUMNS =
  'id,employee_no,first_name,middle_name,last_name,suffix,birthdate,sex,civil_status,mobile_no,email,' +
  'present_address,provincial_address,position,employment_type,status,date_hired,date_regularized,floating_since,' +
  'site_id,area_id,emergency_contact_name,emergency_contact_relation,emergency_contact_phone,' +
  'site:sites!employees_site_id_fkey(id,name,code,address,city,province),area:areas(id,name)';

export async function loadMe(employeeId: string): Promise<Me> {
  return run(supabase.from('employees').select(ME_COLUMNS).eq('id', employeeId).single()) as Promise<Me>;
}

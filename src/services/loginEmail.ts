import {env} from '../config/env';

/**
 * Guards have no company email, so each login uses an address made from the employee number, the same
 * way the activate-employee Edge Function makes it (bannuar-portal supabase/functions/_shared/
 * loginEmail.ts). The .invalid domain can never receive mail; nothing is ever sent to it.
 *
 * "G-001" -> "g-001@employees.bannuar.invalid". Letters, digits and "-" stay; every other character
 * becomes "_" and its four-digit hex code, so two employee numbers never share a login.
 */
export function loginEmail(employeeNo: string, domain: string = env.loginDomain): string {
  const no = employeeNo.trim().toUpperCase().toLowerCase();
  let local = '';
  for (let i = 0; i < no.length; i++) {
    const ch = no[i];
    local += /[a-z0-9-]/.test(ch) ? ch : `_${no.charCodeAt(i).toString(16).padStart(4, '0')}`;
  }
  return `${local}@${domain}`;
}

/** The employee number as the database stores it: trimmed, in capitals. */
export function normalizeEmployeeNo(v: string): string {
  return v.trim().toUpperCase();
}

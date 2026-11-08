import {loginEmail, normalizeEmployeeNo} from '../src/services/loginEmail';

// The same table as bannuar-portal supabase/functions/_shared/shared_test.ts: the app signs in with the
// address the activate-employee function made.
const LOGIN_EMAILS: Array<[string, string]> = [
  ['G-001', 'g-001@employees.bannuar.invalid'],
  [' g-001 ', 'g-001@employees.bannuar.invalid'],
  ['2019-0001', '2019-0001@employees.bannuar.invalid'],
  ['BSA 2024/001', 'bsa_00202024_002f001@employees.bannuar.invalid'],
  ['A_1', 'a_005f1@employees.bannuar.invalid'],
  ['A.1', 'a_002e1@employees.bannuar.invalid'],
  ['DEMO-0002', 'demo-0002@employees.bannuar.invalid'],
];

describe('login email from the employee number', () => {
  it.each(LOGIN_EMAILS)('%s -> %s', (no, email) => {
    expect(loginEmail(no)).toBe(email);
  });
  it('uses the configured domain', () => {
    expect(loginEmail('G-001', 'staff.bannuar.ph')).toBe('g-001@staff.bannuar.ph');
  });
  it('never gives two employee numbers the same login', () => {
    const nos = ['A-1', 'A_1', 'A 1', 'A/1', 'A.1', 'A1', 'A_0020 1', 'A__1'];
    expect(new Set(nos.map(n => loginEmail(n))).size).toBe(nos.length);
  });
  it('stores numbers as the database does', () => {
    expect(normalizeEmployeeNo(' g-002 ')).toBe('G-002');
  });
});

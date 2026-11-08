import {existsSync, readFileSync} from 'fs';
import path from 'path';
import {supabase} from '../src/config/supabase';
import {announcementImages, loadAnnouncements, markAnnouncementRead} from '../src/services/announcements';
import {activate, changePassword, loadAccess, signIn} from '../src/services/auth';
import {changedFields, loadChanges, requestChange} from '../src/services/changes';
import {cancelCoe, loadCoe, openCertificate, requestCoe} from '../src/services/coe';
import {decideLeave, loadPost} from '../src/services/commander';
import {openPrivateFile, uploadEmployeeFile} from '../src/services/files';
import {loadHome} from '../src/services/home';
import {cancelLeave, fileLeave, loadLeave, loadLeaveRequest} from '../src/services/leave';
import {loadNotifications, markAllNotificationsRead, markNotificationRead, subscribeToNotifications, unreadCount} from '../src/services/notifications';
import {loadConcerns, loadPayslip, loadPayslips, reportConcern} from '../src/services/payslips';
import {loadMe} from '../src/services/profile';
import {saveToken, stopPush} from '../src/services/push';
import {loadDocumentAlerts, loadDocuments, loadGovernmentIds, uploadRenewal} from '../src/services/records';
import {checkRequests, relationships, type Snapshot} from './support/contract';
import {access, clearKeychain, EMPLOYEE_ID, installMockApi, type Recorded} from './support/mockApi';

const snapshot = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/schema-snapshot.json'), 'utf8')) as Snapshot;
const portalSnapshot = path.join(__dirname, '../../bannuar-portal/tests/schema-snapshot.json');

describe('every request the app makes matches the real schema', () => {
  it('the snapshot is the portal\'s current one (npm run sync:portal)', () => {
    expect(snapshot.buckets).toEqual(['announcement-media', 'applications', 'certificates', 'employee-files']);
    expect(snapshot.functions.begin_employee_activation).toBeDefined();
    if (existsSync(portalSnapshot)) {
      expect(snapshot).toEqual(JSON.parse(readFileSync(portalSnapshot, 'utf8')));
    }
  });

  it('runs every service and checks each request (tables, columns, embeds, filters, functions, storage)', async () => {
    const api = installMockApi();
    clearKeychain();
    api.rpc.my_access = () => access({roles: ['employee', 'supervisor']});
    api.rpc.my_supervised_site_ids = () => ['s1'];
    api.tables.leave_requests = [{id: 'lr1', employee_id: 'e3', status: 'pending_supervisor', site_id: 's1'}];
    api.tables.payslips = [{id: 'ps1', employee_id: EMPLOYEE_ID, period: {period_end: '2026-10-31'}}];
    api.tables.employees = [{id: EMPLOYEE_ID, employee_no: 'G-002', first_name: 'Bea', last_name: 'Lim', status: 'active', site_id: 's1'}];
    const file = {uri: 'file:///tmp/x.jpg', name: 'x.jpg', type: 'image/jpeg', size: 1000};

    await activate({employeeNo: 'G-002', birthdate: '1992-02-02', mobile: '09171110002', password: 'right-password-1'});
    await signIn('G-002', 'right-password-1');
    await loadAccess();
    await loadMe(EMPLOYEE_ID);
    await loadHome(EMPLOYEE_ID, ['employee', 'supervisor']);
    await loadAnnouncements(EMPLOYEE_ID);
    await markAnnouncementRead('a1');
    await markAnnouncementRead('a1', true);
    await announcementImages('a1');
    await loadPayslips(EMPLOYEE_ID);
    await loadPayslip('ps1');
    await loadConcerns(EMPLOYEE_ID);
    await reportConcern({employeeId: EMPLOYEE_ID, payslipId: 'ps1', category: 'overtime', description: 'Missing OT'});
    await loadLeave(EMPLOYEE_ID);
    await loadLeaveRequest('lr1');
    const attachment = await uploadEmployeeFile(EMPLOYEE_ID, file);
    await fileLeave({employeeId: EMPLOYEE_ID, leaveTypeId: 'lt1', startDate: '2026-11-20', endDate: '2026-11-21', reason: 'Family', attachmentPath: attachment});
    await cancelLeave('lr1');
    await loadCoe(EMPLOYEE_ID);
    await requestCoe({employeeId: EMPLOYEE_ID, purpose: 'bank_loan', purposeDetails: null, includeCompensation: true, addressee: 'BDO'});
    await cancelCoe('cr1');
    await openCertificate({id: 'cert1', file_path: null, certificate_no: 'COE-2026-000001'}, EMPLOYEE_ID);
    await loadDocuments(EMPLOYEE_ID);
    await loadDocumentAlerts(EMPLOYEE_ID);
    await loadGovernmentIds(EMPLOYEE_ID);
    await uploadRenewal({employeeId: EMPLOYEE_ID, documentTypeId: 'dt1', documentNo: 'LIC-2', issuedOn: null, expiresOn: '2028-11-01', file});
    await openPrivateFile('employee-files', attachment, 'x.jpg');
    await loadChanges(EMPLOYEE_ID);
    await requestChange({employeeId: EMPLOYEE_ID, changes: changedFields({mobile_no: '0917'}, {mobile_no: '09179998888', emergency_contact_name: 'Ana Lim'}), reason: null});
    await loadNotifications();
    await unreadCount();
    await markNotificationRead('n1');
    await markAllNotificationsRead();
    await saveToken('fcm-test-token');
    await loadPost(EMPLOYEE_ID);
    await decideLeave({requestId: 'lr1', approve: true, note: 'Covered', relieverId: 'e4'});
    await changePassword('a-new-pass-2');
    await stopPush();

    const problems = checkRequests(api.requests, snapshot, EMPLOYEE_ID);
    expect(problems).toEqual([]);
    const kinds = new Set(api.requests.map((r: Recorded) => r.path.split('/').slice(0, 3).join('/')));
    expect([...kinds].sort()).toEqual(['/auth/v1', '/functions/v1', '/rest/v1', '/storage/v1']);
    const rest = api.requests.filter(r => r.path.startsWith('/rest/v1/'));
    // a floor, so the check never silently runs on nothing
    expect(rest.length).toBeGreaterThan(50);
    console.log(`${api.requests.length} requests checked against the schema (${rest.length} REST and RPC)`);
  });

  it('live notifications listen to the guard\'s own rows of public.notifications', () => {
    const spy = jest.spyOn(supabase, 'channel');
    const stop = subscribeToNotifications('u-bea', () => undefined);
    expect(spy).toHaveBeenCalledWith('notifications:u-bea');
    const channel = spy.mock.results[0].value as {bindings: Record<string, Array<{filter: Record<string, string>}>>};
    expect(channel.bindings.postgres_changes[0].filter).toMatchObject({event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.u-bea'});
    stop();
  });
});

describe('the contract check itself catches mistakes', () => {
  const req = (method: string, url: string, body: unknown = null): Recorded => {
    const u = new URL(`https://mock.supabase.test${url}`);
    return {method, url: u.toString(), path: decodeURIComponent(u.pathname), query: u.searchParams, headers: {}, body};
  };
  it('an embed with two paths (PGRST201), a missing column, a wrong argument, an upload outside uploads/', () => {
    const problems = checkRequests(
      [
        req('GET', '/rest/v1/employees?select=id,site:sites(name)'),
        req('GET', '/rest/v1/leave_requests?select=id,reliever:employees(first_name)'),
        req('GET', '/rest/v1/payslips?select=id,net_salary&employee_id=eq.x'),
        req('POST', '/rest/v1/rpc/cancel_leave_request', {request_id: 'x'}),
        req('POST', '/rest/v1/leave_requests', {employee_id: 'x', approved: true}),
        req('POST', `/storage/v1/object/employee-files/${EMPLOYEE_ID}/contracts/x.pdf`),
        req('POST', '/storage/v1/object/sign/certificates/someone-else/c.pdf', {expiresIn: 60}),
        req('POST', '/functions/v1/make-me-admin', {}),
      ],
      snapshot,
      EMPLOYEE_ID,
    );
    expect(problems.join('\n')).toMatch(/employees and sites are linked 2 ways/);
    expect(problems.join('\n')).toMatch(/leave_requests and employees are linked 2 ways/);
    expect(problems.join('\n')).toMatch(/no column payslips.net_salary/);
    expect(problems.join('\n')).toMatch(/cancel_leave_request has no argument request_id/);
    expect(problems.join('\n')).toMatch(/cancel_leave_request needs p_request_id/);
    expect(problems.join('\n')).toMatch(/writes missing column leave_requests.approved/);
    expect(problems.join('\n')).toMatch(/only upload to employee-files\/<their id>\/uploads/);
    expect(problems.join('\n')).toMatch(/outside the employee's own folder/);
    expect(problems.join('\n')).toMatch(/no Edge Function make-me-admin/);
  });
  it('finds the relationships PostgREST sees', () => {
    expect(relationships(snapshot, 'employees', 'sites')).toEqual(['employees_site_id_fkey', 'site_supervisors']);
    expect(relationships(snapshot, 'payslips', 'payroll_periods')).toEqual(['payslips_payroll_period_id_fkey']);
  });
});

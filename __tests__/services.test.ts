import {Platform} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {env} from '../src/config/env';
import {announcementImages, loadAnnouncements, markAnnouncementRead, sortAnnouncements, waitingForAck} from '../src/services/announcements';
import {changedFields, changeProblem, currentValues, requestChange} from '../src/services/changes';
import {cancelCoe, isOverdue, loadCoe, openCertificate, requestCoe, verifyUrl} from '../src/services/coe';
import {fileProblem, uploadEmployeeFile} from '../src/services/files';
import {cancelLeave, fileLeave, loadLeave} from '../src/services/leave';
import {loadNotifications, markAllNotificationsRead, markNotificationRead, unreadCount} from '../src/services/notifications';
import {loadConcerns, loadPayslips, payslipLines, reportConcern} from '../src/services/payslips';
import {loadMe} from '../src/services/profile';
import {loadDocumentAlerts, loadDocuments, loadGovernmentIds, uploadRenewal} from '../src/services/records';
import type {Announcement, Me, Payslip} from '../src/types/db';
import {clearKeychain, EMPLOYEE_ID, installMockApi, type MockApi} from './support/mockApi';

let api: MockApi;
beforeEach(() => {
  api = installMockApi();
  clearKeychain();
});

const sel = (r: {query: URLSearchParams}) => r.query.get('select');

describe('tests never reach the live project', () => {
  it('the app under test points at the mock', () => {
    expect(env.supabaseUrl).toBe('https://mock.supabase.test');
  });
  it('a request to a real *.supabase.co host is refused (and fails the test that made it)', async () => {
    await expect(fetch('https://bcynizcgdgqznlxuzwjx.supabase.co/rest/v1/employees')).rejects.toThrow(/live Supabase project/);
    // the refusal is recorded; jest.after.js fails the test, so clear it for this deliberate one
    expect((global as unknown as {__liveHits: string[]}).__liveHits.splice(0)).toEqual(['https://bcynizcgdgqznlxuzwjx.supabase.co/rest/v1/employees']);
  });
});

describe('my record', () => {
  it('reads the own row with the post named through employees_site_id_fkey', async () => {
    api.tables.employees = [{id: EMPLOYEE_ID, employee_no: 'G-002', first_name: 'Bea', last_name: 'Lim'}];
    const me = await loadMe(EMPLOYEE_ID);
    expect(me.employee_no).toBe('G-002');
    const r = api.rest('GET', 'employees')[0];
    expect(r.query.get('id')).toBe(`eq.${EMPLOYEE_ID}`);
    expect(sel(r)).toContain('site:sites!employees_site_id_fkey(');
    expect(r.headers.accept).toContain('vnd.pgrst.object');
  });
});

describe('announcements', () => {
  const a = (id: string, over: Partial<Announcement> = {}): Announcement => ({
    id, title: id, body: '', category: 'memo', priority: 'normal', requires_ack: false, pinned: false, published_at: '2026-11-01T00:00:00Z', expires_at: null, ...over,
  });
  it('pinned first, then urgent, important, normal, then newest', () => {
    const sorted = sortAnnouncements([
      a('old-normal', {published_at: '2026-10-01T00:00:00Z'}),
      a('new-normal', {published_at: '2026-11-05T00:00:00Z'}),
      a('important', {priority: 'important'}),
      a('pinned', {pinned: true}),
      a('urgent', {priority: 'urgent'}),
    ]);
    expect(sorted.map(x => x.id)).toEqual(['pinned', 'urgent', 'important', 'new-normal', 'old-normal']);
  });
  it('loads the visible ones and the guard\'s own receipts; finds those waiting for acknowledgment', async () => {
    api.tables.announcements = [a('a1', {requires_ack: true}), a('a2', {requires_ack: true}), a('a3')];
    api.tables.announcement_receipts = [
      {announcement_id: 'a1', employee_id: EMPLOYEE_ID, read_at: 'x', acknowledged_at: 'y'},
      {announcement_id: 'a2', employee_id: EMPLOYEE_ID, read_at: 'x', acknowledged_at: null},
    ];
    const data = await loadAnnouncements(EMPLOYEE_ID);
    expect(waitingForAck(data).map(x => x.id)).toEqual(['a2']);
    expect(api.rest('GET', 'announcements')[0].query.get('order')).toBe('published_at.desc');
    expect(api.rest('GET', 'announcement_receipts')[0].query.get('employee_id')).toBe(`eq.${EMPLOYEE_ID}`);
  });
  it('opening and acknowledging go through mark_announcement_read', async () => {
    await markAnnouncementRead('a1');
    await markAnnouncementRead('a1', true);
    expect(api.rpcCalls('mark_announcement_read').map(r => r.body)).toEqual([{p_announcement_id: 'a1'}, {p_announcement_id: 'a1', p_acknowledge: true}]);
  });
  it('pictures come from announcement-media/<id>/ through signed links', async () => {
    expect(await announcementImages('a1')).toEqual([]);
    const list = api.requests.find(r => r.path === '/storage/v1/object/list/announcement-media');
    expect(list?.body).toMatchObject({prefix: 'a1'});
  });
});

describe('payslips and concerns', () => {
  const slip = (over: Partial<Payslip> = {}) => ({
    id: 'ps1', payroll_period_id: 'p1', employee_id: EMPLOYEE_ID, site_name: 'Post A', days_worked: 13, hours_worked: 104, overtime_hours: 52, night_diff_hours: 56,
    basic_pay: 7020, overtime_pay: 3510, night_diff_pay: 378, holiday_pay: 540, allowances: 0, other_earnings: 0, gross_pay: 11448,
    sss: 450, philhealth: 250, pagibig: 100, withholding_tax: 0, loans: 0, other_deductions: 200, total_deductions: 1000, net_pay: 10448,
    earnings_detail: [], deductions_detail: [{label: 'Uniform', amount: 200}], remarks: null, created_at: '2026-11-05T00:00:00Z',
    period: {id: 'p1', label: 'Oct 16 to 31, 2026', period_start: '2026-10-16', period_end: '2026-10-31', pay_date: '2026-11-05'},
    ...over,
  });
  it('reads the guard\'s own published payslips, newest cutoff first', async () => {
    api.tables.payslips = [
      slip({id: 'older', period: {id: 'p0', label: 'Oct 1 to 15', period_start: '2026-10-01', period_end: '2026-10-15', pay_date: '2026-10-20'}, created_at: '2026-11-06T00:00:00Z'}),
      slip(),
    ];
    const list = await loadPayslips(EMPLOYEE_ID);
    expect(list.map(p => p.id)).toEqual(['ps1', 'older']);
    const r = api.rest('GET', 'payslips')[0];
    expect(r.query.get('employee_id')).toBe(`eq.${EMPLOYEE_ID}`);
    expect(sel(r)).toContain('period:payroll_periods(');
    expect(r.query.get('limit')).toBe('24');
  });
  it('lists every line; extra deduction lines are not counted twice', () => {
    const {earnings, deductions} = payslipLines(slip() as unknown as Payslip);
    expect(earnings.map(l => l.label)).toEqual(['Basic pay', 'Overtime', 'Night differential', 'Holiday pay']);
    expect(deductions).toEqual([
      {label: 'SSS', amount: 450},
      {label: 'PhilHealth', amount: 250},
      {label: 'Pag-IBIG', amount: 100},
      {label: 'Uniform', amount: 200},
    ]);
  });
  it('a concern sends only what the guard chose; the trigger opens it', async () => {
    await reportConcern({employeeId: EMPLOYEE_ID, payslipId: 'ps1', category: 'overtime', description: '  Missing 4 hours OT  '});
    expect(api.rest('POST', 'payroll_concerns')[0].body).toEqual({employee_id: EMPLOYEE_ID, payslip_id: 'ps1', category: 'overtime', description: 'Missing 4 hours OT'});
    await loadConcerns(EMPLOYEE_ID);
    expect(api.rest('GET', 'payroll_concerns')[0].query.get('employee_id')).toBe(`eq.${EMPLOYEE_ID}`);
  });
});

describe('leave', () => {
  it('reads types, the guard\'s balances and requests (reliever named by its own foreign key)', async () => {
    await loadLeave(EMPLOYEE_ID);
    expect(api.rest('GET', 'leave_types')[0].query.get('is_active')).toBe('eq.true');
    expect(api.rest('GET', 'leave_balances')[0].query.get('employee_id')).toBe(`eq.${EMPLOYEE_ID}`);
    const req = api.rest('GET', 'leave_requests')[0];
    expect(req.query.get('employee_id')).toBe(`eq.${EMPLOYEE_ID}`);
    expect(sel(req)).toContain('reliever:employees!leave_requests_reliever_employee_id_fkey(');
    expect(sel(req)).toContain('employee:employees!leave_requests_employee_id_fkey(');
  });
  it('filing sends no days, status or decision: leave_requests_before_insert fills them', async () => {
    await fileLeave({employeeId: EMPLOYEE_ID, leaveTypeId: 'lt1', startDate: '2026-11-20', endDate: '2026-11-21', reason: ' Family ', attachmentPath: null});
    expect(api.rest('POST', 'leave_requests')[0].body).toEqual({
      employee_id: EMPLOYEE_ID, leave_type_id: 'lt1', start_date: '2026-11-20', end_date: '2026-11-21', reason: 'Family', attachment_path: null,
    });
  });
  it('cancelling goes through cancel_leave_request', async () => {
    await cancelLeave('lr1');
    expect(api.rpcCalls('cancel_leave_request')[0].body).toEqual({p_request_id: 'lr1'});
  });
});

describe('certificates of employment', () => {
  it('a request sends purpose, details, compensation and addressee; the trigger sets the due date', async () => {
    await requestCoe({employeeId: EMPLOYEE_ID, purpose: 'bank_loan', purposeDetails: 'Housing loan', includeCompensation: true, addressee: ''});
    expect(api.rest('POST', 'coe_requests')[0].body).toEqual({employee_id: EMPLOYEE_ID, purpose: 'bank_loan', purpose_details: 'Housing loan', include_compensation: true, addressee: null});
    await cancelCoe('cr1');
    expect(api.rpcCalls('cancel_coe_request')[0].body).toEqual({p_request_id: 'cr1'});
  });
  it('requests name their certificate through coe_requests_certificate_fk', async () => {
    await loadCoe(EMPLOYEE_ID);
    expect(sel(api.rest('GET', 'coe_requests')[0])).toContain('certificate:certificates!coe_requests_certificate_fk(');
    expect(api.rest('GET', 'certificates')[0].query.get('employee_id')).toBe(`eq.${EMPLOYEE_ID}`);
  });
  it('overdue after three days while pending', () => {
    expect(isOverdue({status: 'pending', due_at: '2026-11-07T00:00:00Z'}, new Date('2026-11-08T00:00:00Z'))).toBe(true);
    expect(isOverdue({status: 'issued', due_at: '2026-11-07T00:00:00Z'}, new Date('2026-11-08T00:00:00Z'))).toBe(false);
  });
  it('the PDF: a one-minute signed link, downloaded to the app cache, handed to the phone\'s viewer', async () => {
    Platform.OS = 'android';
    const blob = global as unknown as {__blob: {fetched: Array<{url: string; path: string}>; opened: Array<{path: string; mime?: string}>}};
    blob.__blob.fetched.length = 0;
    blob.__blob.opened.length = 0;
    await openCertificate({id: 'cert1', file_path: `${EMPLOYEE_ID}/cert1.pdf`, certificate_no: 'COE-2026-000001'}, EMPLOYEE_ID);
    const sign = api.requests.find(r => r.path === `/storage/v1/object/sign/certificates/${EMPLOYEE_ID}/cert1.pdf`);
    expect(sign?.body).toEqual({expiresIn: 60});
    expect(blob.__blob.fetched[0].path).toBe('/cache/bannuar-files/COE-2026-000001.pdf');
    expect(blob.__blob.fetched[0].url).toContain('https://mock.supabase.test/storage/v1/object/sign/certificates/');
    expect(blob.__blob.opened[0]).toEqual({path: '/cache/bannuar-files/COE-2026-000001.pdf', mime: 'application/pdf'});
    expect(ReactNativeBlobUtil.android.actionViewIntent).toHaveBeenCalled();
  });
  it('anyone checks the code on the website\'s /verify page', () => {
    expect(verifyUrl()).toBe('https://bannuar.example/verify');
  });
});

describe('my records', () => {
  it('government numbers come only through get_government_ids', async () => {
    const ids = await loadGovernmentIds(EMPLOYEE_ID);
    expect(ids?.sss_no).toBe('02-2345678-9');
    expect(api.rpcCalls('get_government_ids')[0].body).toEqual({p_employee_id: EMPLOYEE_ID});
    expect(api.requests.some(r => r.path === '/rest/v1/employee_government_ids')).toBe(false);
  });
  it('documents: only types visible to employees; alerts from document_alerts', async () => {
    await loadDocuments(EMPLOYEE_ID);
    expect(api.rest('GET', 'document_types')[0].query.get('visible_to_employee')).toBe('eq.true');
    expect(api.rest('GET', 'employee_documents')[0].query.get('employee_id')).toBe(`eq.${EMPLOYEE_ID}`);
    await loadDocumentAlerts(EMPLOYEE_ID);
    expect(api.rest('GET', 'document_alerts')[0].query.get('employee_id')).toBe(`eq.${EMPLOYEE_ID}`);
  });
  it('a renewal: the file to <id>/uploads/<uuid>.<ext>, then the row without a status (the trigger sets pending_review)', async () => {
    await uploadRenewal({
      employeeId: EMPLOYEE_ID,
      documentTypeId: 'dt1',
      documentNo: ' LIC-2 ',
      issuedOn: '2026-11-01',
      expiresOn: '2028-11-01',
      file: {uri: 'file:///tmp/lic.jpg', name: 'lic.jpg', type: 'image/jpeg', size: 200_000},
    });
    const up = api.requests.find(r => r.method === 'POST' && r.path.startsWith('/storage/v1/object/employee-files/'));
    expect(up?.path).toMatch(new RegExp(`^/storage/v1/object/employee-files/${EMPLOYEE_ID}/uploads/[0-9a-f-]{36}\\.jpg$`));
    const row = api.rest('POST', 'employee_documents')[0].body as Record<string, unknown>;
    expect(row).toEqual({
      employee_id: EMPLOYEE_ID, document_type_id: 'dt1', document_no: 'LIC-2', issued_on: '2026-11-01', expires_on: '2028-11-01',
      file_path: expect.stringMatching(new RegExp(`^${EMPLOYEE_ID}/uploads/`)),
    });
    expect(row).not.toHaveProperty('status');
  });
  it('files the bucket refuses are stopped on the phone', async () => {
    expect(fileProblem({uri: 'x', name: 'a.docx', type: 'application/msword', size: 10})).toMatch(/PDF or a photo/);
    expect(fileProblem({uri: 'x', name: 'a.pdf', type: 'application/pdf', size: 11 * 1024 * 1024})).toMatch(/too big/);
    await expect(uploadEmployeeFile(EMPLOYEE_ID, {uri: 'x', name: 'a.zip', type: 'application/zip', size: 1})).rejects.toThrow(/PDF or a photo/);
    expect(api.requests.length).toBe(0);
  });
});

describe('change my details', () => {
  const me = {mobile_no: '09171110002', email: null, present_address: 'Bauang, La Union', provincial_address: null, civil_status: 'single',
    emergency_contact_name: null, emergency_contact_relation: null, emergency_contact_phone: null} as unknown as Me;
  it('sends only what changed, with the keys the trigger allows', async () => {
    const changes = changedFields(currentValues(me), {...currentValues(me), mobile_no: '0917 999 8888', present_address: ' Bauang, La Union '});
    expect(changes).toEqual({mobile_no: '0917 999 8888'});
    expect(changeProblem(changes)).toBeNull();
    await requestChange({employeeId: EMPLOYEE_ID, changes, reason: 'New SIM'});
    expect(api.rest('POST', 'profile_change_requests')[0].body).toEqual({employee_id: EMPLOYEE_ID, changes: {mobile_no: '0917 999 8888'}, reason: 'New SIM'});
  });
  it('checks the mobile and the email, and that something changed', () => {
    expect(changeProblem({})).toMatch(/at least one/);
    expect(changeProblem({mobile_no: '12345'})).toMatch(/0917 123 4567/);
    expect(changeProblem({email: 'nope'})).toMatch(/email/);
  });
});

describe('notifications', () => {
  it('lists, counts unread and marks read (own rows only, by policy)', async () => {
    api.tables.notifications = [{id: 'n1', read_at: null}, {id: 'n2', read_at: '2026-11-01T00:00:00Z'}];
    await loadNotifications();
    expect(api.rest('GET', 'notifications')[0].query.get('order')).toBe('created_at.desc');
    expect(await unreadCount()).toBe(1);
    const head = api.rest('HEAD', 'notifications')[0];
    expect(head.query.get('read_at')).toBe('is.null');
    expect(head.headers.prefer).toContain('count=exact');
    await markNotificationRead('n1', new Date('2026-11-08T00:00:00Z'));
    const patch = api.rest('PATCH', 'notifications')[0];
    expect(patch.body).toEqual({read_at: '2026-11-08T00:00:00.000Z'});
    expect(patch.query.get('id')).toBe('eq.n1');
    expect(patch.query.get('read_at')).toBe('is.null');
    await markAllNotificationsRead();
    expect(api.rest('PATCH', 'notifications')[1].query.get('id')).toBeNull();
  });
});

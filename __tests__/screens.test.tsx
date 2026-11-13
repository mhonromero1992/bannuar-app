import {Alert, NativeModules, PermissionsAndroid, Platform} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {launchCamera} from 'react-native-image-picker';
import React from 'react';
import ReactTestRenderer, {act, type ReactTestInstance} from 'react-test-renderer';
import App from '../App';
import {navigationRef} from '../src/app/_layout';
import LogAttendance from '../src/app/attendance/LogAttendance';
import Activate from '../src/app/auth/Activate';
import PayslipDetail from '../src/app/payslips/PayslipDetail';
import Payslips from '../src/app/payslips/Payslips';
import {supabase} from '../src/config/supabase';
import {ACTIVATION_MESSAGES} from '../src/services/auth';
import {resetResources} from '../src/store/resources';
import {useSession} from '../src/store/session';
import {useUi} from '../src/store/ui';
import {access, clearKeychain, EMPLOYEE_ID, formFields, installMockApi, type MockApi} from './support/mockApi';

let api: MockApi;
let tree: ReactTestRenderer.ReactTestRenderer | null = null;

const settle = async (rounds = 6) => {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
  }
};
const root = () => tree!.root;
/** Screens below the focused one stay mounted: queries look inside one screen when given it. */
const screen = (component: React.ComponentType<object>) => root().findByType(component);
const texts = (from: ReactTestInstance = root()) =>
  from
    .findAll(n => String(n.type) === 'Text')
    .map(n => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')));
const hasText = (t: string, from: ReactTestInstance = root()) => texts(from).some(x => x.includes(t));
const byTestId = (id: string, from: ReactTestInstance = root()) => from.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0];
const pressable = (pred: (label: string) => boolean, from: ReactTestInstance = root()) =>
  from.findAll(n => typeof n.props.onPress === 'function' && typeof n.props.accessibilityLabel === 'string' && pred(n.props.accessibilityLabel))[0];
async function press(node: ReactTestInstance | undefined) {
  expect(node).toBeDefined();
  await act(async () => {
    node!.props.onPress();
  });
  await settle();
}
async function type(label: string, value: string, from: ReactTestInstance = root()) {
  const input = from.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onChangeText === 'function')[0];
  expect(input).toBeDefined();
  await act(async () => {
    input.props.onChangeText(value);
  });
}
async function choose(fieldLabel: string, option: string, from: ReactTestInstance = root()) {
  await press(pressable(l => l.startsWith(`${fieldLabel}:`), from));
  await press(root().findAll(n => n.props.accessibilityRole === 'radio' && String(n.props.accessibilityLabel).startsWith(option) && typeof n.props.onPress === 'function')[0]);
}
async function date(label: string, iso: string, from: ReactTestInstance = root()) {
  const field = from.findAll(n => n.props.accessibilityLabel === label && String(n.type) === 'View')[0];
  const [y, m, d] = iso.split('-');
  await type(`${label}, day`, String(Number(d)), field);
  await type(`${label}, year`, y, field);
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(m) - 1];
  await choose('Month', month, field);
}
async function go(name: string, params?: object) {
  await act(async () => {
    (navigationRef.navigate as (n: string, p?: object) => void)(name, params);
  });
  await settle();
}

async function start(signedIn: boolean) {
  if (signedIn) {
    await supabase.auth.signInWithPassword({email: 'g-002@employees.bannuar.invalid', password: 'right-password-1'});
  }
  await act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await settle();
}

beforeEach(async () => {
  api = installMockApi();
  useSession.setState({phase: 'starting', access: null, notice: null});
  await supabase.auth.signOut({scope: 'local'}).catch(() => undefined);
  clearKeychain();
  resetResources();
  useUi.getState().reset();
  (global as unknown as {__blob: {files: Set<string>}}).__blob.files.add('/docs/.bannuar-installed');
  useSession.setState({phase: 'starting', access: null, notice: null});
  Platform.OS = 'android';
  api.tables.employees = [
    {id: EMPLOYEE_ID, employee_no: 'G-002', first_name: 'Bea', middle_name: null, last_name: 'Lim', suffix: null, sex: 'female', status: 'active', position: 'Lady Guard', date_hired: '2020-01-10', site_id: 's1', site: {id: 's1', name: 'Post A'}},
  ];
});

afterEach(async () => {
  await act(async () => {
    tree?.unmount();
  });
  tree = null;
});

describe('activation, on screen', () => {
  it('checks the form, then shows the plain message the function answered', async () => {
    await start(false);
    await press(pressable(l => l === 'First time? Activate your account'));
    const form = () => screen(Activate as React.ComponentType<object>);
    await press(byTestId('activate-submit', form()));
    expect(hasText('Enter your employee number.', form())).toBe(true);
    expect(hasText('Enter a mobile number like 0917 123 4567.', form())).toBe(true);
    expect(api.requests.some(r => r.path.startsWith('/functions/'))).toBe(false);

    api.activate = () => ({status: 400, body: {code: 'no_match'}});
    await type('Employee number', 'G-002', form());
    await date('Birthdate', '1992-02-02', form());
    await type('Mobile number', '0917 111 0002', form());
    await type('New password', 'a-good-pass-1', form());
    await type('New password again', 'a-good-pass-1', form());
    await press(byTestId('activate-submit', form()));
    expect(hasText(ACTIVATION_MESSAGES.no_match, form())).toBe(true);
    const call = api.requests.find(r => r.path === '/functions/v1/activate-employee');
    expect(call?.body).toMatchObject({employee_no: 'G-002', birthdate: '1992-02-02', mobile_no: '0917 111 0002'});

    api.activate = () => ({status: 'activated', login_email: 'g-002@employees.bannuar.invalid'});
    api.password = 'a-good-pass-1';
    await press(byTestId('activate-submit', form()));
    expect(useSession.getState().phase).toBe('ready');
  });
});

describe('payslips, on screen', () => {
  it('blocks screenshots and keeps amounts hidden until asked; offers "Report a concern"', async () => {
    api.tables.payslips = [
      {
        id: 'ps1', employee_id: EMPLOYEE_ID, site_name: 'Post A', days_worked: 13, hours_worked: 104, overtime_hours: 0, night_diff_hours: 0,
        basic_pay: 7020, overtime_pay: 0, night_diff_pay: 0, holiday_pay: 0, allowances: 0, other_earnings: 0, gross_pay: 7020,
        sss: 450, philhealth: 250, pagibig: 100, withholding_tax: 0, loans: 0, other_deductions: 0, total_deductions: 800, net_pay: 6220,
        earnings_detail: [], deductions_detail: [], remarks: null, created_at: '2026-11-05T00:00:00Z',
        period: {id: 'p1', label: 'Oct 16 to 31, 2026', period_start: '2026-10-16', period_end: '2026-10-31', pay_date: '2026-11-05'},
      },
    ];
    await start(true);
    const secure = NativeModules.BannuarSecureWindow.setSecure as jest.Mock;
    secure.mockClear();
    await press(byTestId('tab-Payslips'));
    expect(secure).toHaveBeenLastCalledWith(true);
    const list = screen(Payslips as React.ComponentType<object>);
    expect(hasText('Oct 16 to 31, 2026', list)).toBe(true);
    expect(hasText('6,220', list)).toBe(false);
    await press(pressable(l => l === 'Show the amounts', list));
    expect(hasText('₱6,220.00', list)).toBe(true);
    await go('PayslipDetail', {id: 'ps1'});
    const detail = () => screen(PayslipDetail as React.ComponentType<object>);
    expect(hasText('Oct 16 to 31, 2026', detail())).toBe(true);
    expect(hasText('₱6,220.00', detail())).toBe(false);
    await press(pressable(l => l === 'Show the amounts', detail()));
    expect(hasText('₱6,220.00', detail())).toBe(true);
    expect(hasText('PhilHealth', detail())).toBe(true);
    expect(byTestId('concern-submit')).toBeUndefined();
    await press(pressable(l => l === 'Report a concern', detail()));
    expect(navigationRef.getCurrentRoute()?.name).toBe('ReportConcern');
    await go('Main', {screen: 'Home'});
    expect(secure).toHaveBeenLastCalledWith(false);
  });
});

describe('leave, on screen', () => {
  it('files leave with the type and dates the guard chose', async () => {
    api.tables.leave_types = [{id: 'lt1', code: 'SIL', name: 'Service incentive leave', description: 'Five days with pay a year.', days_per_year: 5, max_days_per_request: null, is_paid: true, requires_attachment: false, applies_to_sex: null, min_service_months: 12, sort_order: 10, is_active: true}];
    api.tables.leave_balances = [{employee_id: EMPLOYEE_ID, leave_type_id: 'lt1', code: 'SIL', name: 'Service incentive leave', year: 2026, credits: 5, used: 1, pending: 0}];
    await start(true);
    await press(byTestId('tab-Leave'));
    expect(hasText('4 days left')).toBe(true);
    await press(byTestId('file-leave'));
    await choose('Kind of leave', 'Service incentive leave');
    await date('First day', '2099-11-20');
    await date('Last day', '2099-11-21');
    expect(hasText('2 days, first and last day included')).toBe(true);
    await press(byTestId('file-leave-submit'));
    expect(api.rest('POST', 'leave_requests')[0]?.body).toEqual({
      employee_id: EMPLOYEE_ID, leave_type_id: 'lt1', start_date: '2099-11-20', end_date: '2099-11-21', reason: null, attachment_path: null,
    });
    expect(useUi.getState().toast?.message).toMatch(/Leave filed/);
  });
});

describe('announcements and notifications, on screen', () => {
  it('opening records the read; "I acknowledge" records the acknowledgment', async () => {
    api.tables.announcements = [{id: 'a1', title: 'Fire drill Friday', body: 'Every post joins.', category: 'advisory', priority: 'important', requires_ack: true, pinned: false, published_at: '2026-11-07T00:00:00Z', expires_at: null}];
    await start(true);
    await go('AnnouncementDetail', {id: 'a1'});
    expect(hasText('Fire drill Friday')).toBe(true);
    expect(api.rpcCalls('mark_announcement_read')[0].body).toEqual({p_announcement_id: 'a1'});
    await press(byTestId('acknowledge'));
    expect(api.rpcCalls('mark_announcement_read')[1].body).toEqual({p_announcement_id: 'a1', p_acknowledge: true});
    expect(hasText('You acknowledged this on')).toBe(true);
  });
  it('a notification opens its screen and is marked read', async () => {
    api.tables.notifications = [{id: 'n1', title: 'Your certificate of employment is ready', body: 'COE-2026-000001', kind: 'coe', link: {screen: 'Certificate', id: 'cert1'}, read_at: null, created_at: '2026-11-08T00:00:00Z'}];
    api.tables.certificates = [{id: 'cert1', employee_id: EMPLOYEE_ID, certificate_no: 'COE-2026-000001', verification_code: 'K7QM-3XPD-8RTA', purpose: 'bank_loan', include_compensation: false, file_path: `${EMPLOYEE_ID}/cert1.pdf`, issued_at: '2026-11-08T00:00:00Z', revoked_at: null, revoked_reason: null, coe_request_id: null}];
    await start(true);
    expect(useUi.getState().unread).toBe(1);
    await press(pressable(l => l.startsWith('Notifications')));
    await press(root().findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function' && n.findAll(t => String(t.type) === 'Text' && t.props.children === 'Your certificate of employment is ready').length > 0)[0]);
    expect(api.rest('PATCH', 'notifications')[0].query.get('id')).toBe('eq.n1');
    expect(navigationRef.getCurrentRoute()?.name).toBe('CertificateDetail');
    expect(hasText('K7QM-3XPD-8RTA')).toBe(true);
    expect(useUi.getState().unread).toBe(0);
  });
});

describe('the commander, on screen', () => {
  it('endorses a guard\'s leave to HR with a reliever', async () => {
    api.rpc.my_access = () => access({roles: ['employee', 'supervisor']});
    api.rpc.my_supervised_site_ids = () => ['s1'];
    api.tables.sites = [{id: 's1', name: 'Post A'}];
    api.tables.employees.push(
      {id: 'e3', employee_no: 'G-003', first_name: 'Carlo', last_name: 'Diaz', position: 'Security Guard', status: 'active', site_id: 's1'},
      {id: 'e4', employee_no: 'G-004', first_name: 'Edu', last_name: 'Tan', position: 'Security Guard', status: 'active', site_id: 's1'},
    );
    api.tables.leave_requests = [{id: 'lr1', employee_id: 'e3', status: 'pending_supervisor', site_id: 's1', start_date: '2099-11-20', end_date: '2099-11-21', days: 2, created_at: '2026-11-08T00:00:00Z', type: {name: 'Service incentive leave'}, employee: {id: 'e3', employee_no: 'G-003', first_name: 'Carlo', last_name: 'Diaz'}}];
    await start(true);
    expect(hasText('1 leave request to endorse')).toBe(true);
    await go('MyPost');
    await go('Endorse', {id: 'lr1'});
    expect(hasText('Carlo Diaz')).toBe(true);
    await choose('Reliever', 'Edu Tan');
    await press(byTestId('endorse-yes'));
    expect(api.rpcCalls('decide_leave_request')[0].body).toEqual({p_request_id: 'lr1', p_approve: true, p_note: null, p_reliever_id: 'e4'});
  });
});

describe('notices from HR, on screen', () => {
  const notice = {
    id: 'case1', case_no: 'DC-2026-000001', status: 'nte_issued', rule: {ref: 'A-1', title: 'Sleeping on post'}, offense_no: 1,
    nte_text: 'This notice is about 2 AM at the main gate, where you were found asleep. This may violate A-1 Sleeping on post.',
    nte_issued_at: '2026-11-12T01:00:00Z', explain_by: '2099-11-18T09:00:00Z', nte_received_at: null as string | null, explanation: null, explained_at: null,
    wants_hearing: false, hearing_at: null, hearing_place: null, hearing_held_at: null, decision: null, suspension_days: null, suspension_from: null,
    decision_text: null, decided_at: null, decision_received_at: null, preventive_from: null, preventive_to: null, preventive_reason: null, withdrawn_reason: null,
  };
  afterEach(() => jest.restoreAllMocks());

  it('Home says a notice waits; the guard acknowledges it and answers, asking for a meeting; screenshots are blocked', async () => {
    const n = {...notice};
    api.rpc.my_disciplinary_cases = () => [n];
    api.rpc.acknowledge_case_notice = () => {
      n.nte_received_at = '2026-11-12T02:00:00Z';
      return null;
    };
    await start(true);
    expect(hasText('A notice waits for you')).toBe(true);
    await go('Notices');
    expect(useUi.getState().secureScreen).toBe(true);
    expect(hasText('Open it and say you received it')).toBe(true);
    await press(byTestId('notice-case1'));
    expect(hasText('A-1 Sleeping on post')).toBe(true);
    await press(byTestId('notice-ack'));
    expect(api.rpcCalls('acknowledge_case_notice')[0].body).toEqual({p_case_id: 'case1', p_which: 'nte'});
    expect(hasText('You said you received it')).toBe(true);

    await type('What happened, in your words', 'I was on my break at the guard house and not asleep at the gate.');
    const hearing = root().findAll(n2 => n2.props.testID === 'notice-hearing' && typeof n2.props.onValueChange === 'function')[0];
    await act(async () => {
      hearing.props.onValueChange(true);
    });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Send')?.onPress?.();
    });
    await press(byTestId('notice-send'));
    await settle();
    expect(api.rpcCalls('submit_case_explanation')[0].body).toEqual({
      p_case_id: 'case1',
      p_text: 'I was on my break at the guard house and not asleep at the gate.',
      p_wants_hearing: true,
    });
  });

  it('a decision is read and acknowledged; the Code of Discipline in force opens', async () => {
    const decided = {...notice, status: 'decided', nte_received_at: '2026-11-12T02:00:00Z', explanation: 'I was on my break.', explained_at: '2026-11-13T00:00:00Z', decision: 'suspension', suspension_days: 7, suspension_from: '2026-11-20', decision_text: 'After hearing both sides, seven days under A-1.', decided_at: '2026-11-19T00:00:00Z'};
    api.rpc.my_disciplinary_cases = () => [decided];
    api.rpc.active_discipline_code = () => ({title: 'Code of Discipline 2026', effective_on: '2026-01-01', file_key: 'company/code-of-discipline/2026-01-01_code-of-discipline_0a1b2c3d4e.pdf'});
    await start(true);
    await go('NoticeDetail', {id: 'case1'});
    expect(hasText('A suspension without pay of 7 days')).toBe(true);
    await press(byTestId('decision-ack'));
    expect(api.rpcCalls('acknowledge_case_notice')[0].body).toEqual({p_case_id: 'case1', p_which: 'decision'});
    await go('Notices');
    await press(byTestId('read-code'));
    const sign = api.requests.find(r => r.path === '/functions/v1/files' && (r.body as {action?: string})?.action === 'sign');
    expect((sign?.body as {keys: string[]}).keys).toEqual(['company/code-of-discipline/2026-01-01_code-of-discipline_0a1b2c3d4e.pdf']);
  });

  it('a commander reports an incident at his post, with the guard and the time in Manila', async () => {
    api.rpc.my_access = () => access({roles: ['employee', 'supervisor']});
    api.rpc.my_supervised_site_ids = () => ['s1'];
    api.tables.sites = [{id: 's1', name: 'Post A'}];
    api.tables.employees.push({id: 'e3', employee_no: 'G-003', first_name: 'Carlo', last_name: 'Diaz', position: 'Security Guard', status: 'active', site_id: 's1'});
    await start(true);
    await go('MyPost');
    await press(byTestId('report-incident'));
    expect(navigationRef.getCurrentRoute()?.name).toBe('ReportIncident');
    await choose('Guard involved (optional)', 'Carlo Diaz');
    await type('Time', '02:30');
    await type('Title', 'Asleep on post');
    await type('What happened', 'Found asleep at the main gate during my 2 AM round.');
    await press(byTestId('incident-send'));
    const body = api.rpcCalls('file_incident_report')[0].body as Record<string, unknown>;
    expect(body).toMatchObject({p_site_id: 's1', p_employee_id: 'e3', p_title: 'Asleep on post', p_details: 'Found asleep at the main gate during my 2 AM round.', p_guard_described: null});
    expect(String(body.p_occurred_at)).toMatch(/T18:30:00\.000Z$/);
    expect(hasText('Report IR-2026-000007 sent to HR.')).toBe(true);
  });
});

describe('the four states', () => {
  // postgrest-js tries a failed read three more times (after 1, 2 and 4 s) before giving up
  it('offline with nothing kept: says so and offers to try again', async () => {
    await start(true);
    api.offline = true;
    await press(byTestId('tab-Leave'));
    expect(hasText('Loading…')).toBe(true);
    await act(async () => {
      await new Promise(r => setTimeout(r, 7500));
    });
    await settle();
    expect(hasText('You are offline')).toBe(true);
    api.offline = false;
    await press(pressable(l => l === 'Try again'));
    expect(hasText('No leave filed')).toBe(true);
  }, 20000);
});

describe('time in and out, on screen', () => {
  const {ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE} = PermissionsAndroid.PERMISSIONS;
  const allow = (answer: string) =>
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({[FINE]: answer, [COARSE]: answer} as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
  const geo = () => (global as unknown as {__geo: {fix: unknown; error: number | null}}).__geo;
  const form = () => screen(LogAttendance as React.ComponentType<object>);
  const selfie = 'file:///cache/rn_image_picker_lib_temp_9.jpg';
  beforeEach(() => {
    (api.tables.employees[0] as Record<string, unknown>).site = {id: 's1', name: 'Post A', latitude: 14.5547, longitude: 121.0244, geofence_radius_m: 150};
    api.tables.attendance_logs = [];
    geo().fix = {coords: {latitude: 14.5552, longitude: 121.0244, accuracy: 12}, mocked: false, timestamp: 0};
    geo().error = null;
    (launchCamera as jest.Mock).mockResolvedValue({assets: [{uri: selfie, fileName: 'selfie.jpg', type: 'image/jpeg', fileSize: 150000}]});
  });
  afterEach(() => {
    (launchCamera as jest.Mock).mockResolvedValue({didCancel: true});
    jest.restoreAllMocks();
  });

  it('from Home: the location checked against the post, a selfie, then the log with the server\'s time', async () => {
    allow(PermissionsAndroid.RESULTS.GRANTED);
    await start(true);
    expect(hasText('Not timed in today')).toBe(true);
    await press(byTestId('attendance-next'));
    expect(navigationRef.getCurrentRoute()?.name).toBe('LogAttendance');
    expect(hasText('At the post', form())).toBe(true);
    expect(hasText('About 56 m from Post A. GPS accurate to 12 m.', form())).toBe(true);
    expect(byTestId('attendance-send', form()).props.disabled).toBe(true);

    await press(byTestId('attendance-photo', form()));
    expect((launchCamera as jest.Mock).mock.calls.at(-1)[0]).toMatchObject({cameraType: 'front', saveToPhotos: false});
    expect(byTestId('attendance-send', form()).props.disabled).toBe(false);
    await press(byTestId('attendance-send', form()));

    const upload = api.requests.find(r => r.path === '/functions/v1/files');
    expect(formFields(upload?.body)).toEqual({purpose: 'attendance', kind: 'time_in', file: '[file]'});
    expect(api.rpcCalls('log_attendance')[0].body).toEqual({
      p_kind: 'time_in',
      p_photo_path: expect.stringMatching(/^employees\/G-002\/attendance\/2026\/11\/2026-11-11_0802_time-in_mock\d+\.jpg$/),
      p_latitude: 14.5552,
      p_longitude: 121.0244,
      p_accuracy_m: 12,
      p_mock_location: false,
    });
    expect(hasText('Time in logged')).toBe(true);
    expect(hasText('8:02 AM')).toBe(true);
    expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith('/cache/rn_image_picker_lib_temp_9.jpg');
    await press(byTestId('attendance-done'));
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  });

  it('location refused for good: says how to allow it, and still logs, without a location', async () => {
    allow(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
    await start(true);
    await go('LogAttendance', {kind: 'time_out'});
    expect(hasText('Location is turned off for Bannuar', form())).toBe(true);
    expect(hasText('HR will see that the log has no location', form())).toBe(true);
    expect(pressable(l => l === 'Open Settings', form())).toBeDefined();
    await press(byTestId('attendance-photo', form()));
    await press(byTestId('attendance-send', form()));
    expect(api.rpcCalls('log_attendance')[0].body).toMatchObject({p_kind: 'time_out', p_latitude: null, p_longitude: null, p_accuracy_m: null, p_mock_location: null});
    expect(hasText('Time out logged')).toBe(true);
    expect(hasText('HR will look at this log')).toBe(true);
  });

  it('away from the post with a mock location app: shown before sending, as HR will see it', async () => {
    allow(PermissionsAndroid.RESULTS.GRANTED);
    geo().fix = {coords: {latitude: 14.5647, longitude: 121.0244, accuracy: 20}, mocked: true, timestamp: 0};
    api.rpc.log_attendance = () => ({id: 'at-2', kind: 'time_in', logged_at: '2026-11-11T00:02:00Z', location_check: 'away', distance_m: 1112, accuracy_m: 20, radius_m: 150, site_name: 'Post A'});
    await start(true);
    await go('LogAttendance', {kind: 'time_in'});
    expect(hasText('Away from the post', form())).toBe(true);
    expect(hasText('About 1.1 km from Post A', form())).toBe(true);
    expect(hasText('A mock location app is on', form())).toBe(true);
    await press(byTestId('attendance-photo', form()));
    await press(byTestId('attendance-send', form()));
    expect(api.rpcCalls('log_attendance')[0].body).toMatchObject({p_mock_location: true});
    expect(hasText('HR will look at this log')).toBe(true);
  });

  it('a failed send keeps the photo; the retry reuses the same upload, so nothing is logged twice', async () => {
    allow(PermissionsAndroid.RESULTS.GRANTED);
    const ok = api.rpc.log_attendance;
    api.rpc.log_attendance = () => ({status: 503, body: {message: 'Service unavailable'}});
    await start(true);
    await go('LogAttendance', {kind: 'time_in'});
    await press(byTestId('attendance-photo', form()));
    await press(byTestId('attendance-send', form()));
    expect(hasText('Not logged yet', form())).toBe(true);
    api.rpc.log_attendance = ok;
    await press(byTestId('attendance-send', form()));
    const uploads = api.requests.filter(r => r.path === '/functions/v1/files');
    expect(uploads).toHaveLength(1);
    const calls = api.rpcCalls('log_attendance');
    expect(calls).toHaveLength(2);
    expect((calls[1].body as {p_photo_path: string}).p_photo_path).toBe((calls[0].body as {p_photo_path: string}).p_photo_path);
    expect(hasText('Time in logged')).toBe(true);
  });

  it('a commander logs for a guard with no phone: the guard\'s photo in the guard\'s folder, the commander\'s location', async () => {
    allow(PermissionsAndroid.RESULTS.GRANTED);
    api.rpc.my_access = () => access({roles: ['employee', 'supervisor']});
    api.rpc.my_supervised_site_ids = () => ['s1'];
    api.tables.sites = [{id: 's1', name: 'Post A', latitude: 14.5547, longitude: 121.0244, geofence_radius_m: 150}];
    api.tables.employees.push({id: 'e3', employee_no: 'G-003', first_name: 'Carlo', last_name: 'Diaz', position: 'Security Guard', status: 'active', site_id: 's1'});
    await start(true);
    await go('MyPost');
    await press(byTestId('guard-e3'));
    expect(navigationRef.getCurrentRoute()?.name).toBe('GuardAttendance');
    expect(api.rest('GET', 'attendance_logs').at(-1)?.query.get('employee_id')).toBe('eq.e3');
    await press(byTestId('guard-in'));
    expect(navigationRef.getCurrentRoute()?.params).toEqual({kind: 'time_in', guardId: 'e3'});
    expect(hasText('For Carlo Diaz (G-003)', form())).toBe(true);
    expect(hasText('At the post', form())).toBe(true);

    await press(byTestId('attendance-photo', form()));
    expect((launchCamera as jest.Mock).mock.calls.at(-1)[0]).toMatchObject({cameraType: 'back', saveToPhotos: false});
    await press(byTestId('attendance-send', form()));
    const upload = api.requests.find(r => r.path === '/functions/v1/files');
    expect(formFields(upload?.body)).toEqual({purpose: 'attendance', kind: 'time_in', employee_id: 'e3', file: '[file]'});
    expect(api.rpcCalls('log_attendance')).toHaveLength(0);
    expect(api.rpcCalls('log_attendance_for')[0].body).toEqual({
      p_employee_id: 'e3',
      p_kind: 'time_in',
      p_photo_path: expect.stringMatching(/^employees\/G-003\/attendance\/2026\/11\/2026-11-11_0802_time-in_mock\d+\.jpg$/),
      p_latitude: 14.5552,
      p_longitude: 121.0244,
      p_accuracy_m: 12,
      p_mock_location: false,
    });
    expect(hasText('Time in logged')).toBe(true);
    expect(hasText('For Carlo Diaz')).toBe(true);
  });

  it('the guard\'s list says when the commander or HR logged it', async () => {
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    api.tables.attendance_logs = [
      {id: 'at1', employee_id: EMPLOYEE_ID, kind: 'time_in', logged_at: hourAgo, location_check: 'at_post', distance_m: 30, accuracy_m: 10, radius_m: 150, mock_location: false, source: 'commander', manual_reason: null, site: {name: 'Post A'}},
      {id: 'at0', employee_id: EMPLOYEE_ID, kind: 'time_out', logged_at: '2026-11-01T10:00:00Z', location_check: 'manual', distance_m: null, accuracy_m: null, radius_m: null, mock_location: null, source: 'manual', manual_reason: 'Phone lost; from the post logbook', site: null},
    ];
    await start(true);
    await go('Attendance');
    expect(hasText('About 30 m from Post A. Logged by your commander')).toBe(true);
    expect(hasText('Entered by HR: Phone lost; from the post logbook')).toBe(true);
    expect(hasText('Entered by hand')).toBe(true);
  });

  it('after a time in, Home offers time out; the list shows the day with each check', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    api.tables.attendance_logs = [
      {id: 'at1', employee_id: EMPLOYEE_ID, kind: 'time_in', logged_at: twoHoursAgo, location_check: 'at_post', distance_m: 40, accuracy_m: 10, radius_m: 150, mock_location: false, site: {name: 'Post A'}},
    ];
    await start(true);
    expect(hasText('Timed in')).toBe(true);
    expect(byTestId('attendance-next').props.title).toBe('Time out');
    await go('Attendance');
    expect(hasText('About 40 m from Post A')).toBe(true);
    expect(hasText('At the post')).toBe(true);
  });
});

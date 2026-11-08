import ReactNativeBlobUtil from 'react-native-blob-util';
import notifee from '@notifee/react-native';
import {deleteToken} from '@react-native-firebase/messaging';
import {supabase} from '../src/config/supabase';
import {SESSION_ENDED} from '../src/lib/errors';
import {ACTIVATION_MESSAGES, activate, ActivationError, changePassword, passwordProblem, signIn, STAFF_MESSAGE} from '../src/services/auth';
import {cacheGet, cacheSet} from '../src/services/secureCache';
import {saveToken} from '../src/services/push';
import {useResources} from '../src/store/resources';
import {useSession} from '../src/store/session';
import {access, clearKeychain, EMPLOYEE_ID, installMockApi, keychainServices, type MockApi} from './support/mockApi';

let api: MockApi;
beforeEach(async () => {
  api = installMockApi();
  useSession.setState({phase: 'starting', access: null, notice: null});
  await supabase.auth.signOut({scope: 'local'}).catch(() => undefined);
  clearKeychain();
  (global as unknown as {__blob: {files: Set<string>}}).__blob.files.add('/docs/.bannuar-installed');
  api.requests.length = 0;
  useSession.setState({phase: 'signedOut', access: null, notice: null});
});

const form = {employeeNo: ' g-002 ', birthdate: '1992-02-02', mobile: '0917 111 0002', password: 'right-password-1'};

describe('activation: the three facts, then a password of the guard\'s own', () => {
  it('calls the activate-employee Edge Function with the employee number as stored', async () => {
    const res = await activate(form);
    expect(res.loginEmail).toBe('g-002@employees.bannuar.invalid');
    const call = api.requests.find(r => r.path === '/functions/v1/activate-employee');
    expect(call?.method).toBe('POST');
    expect(call?.body).toEqual({employee_no: 'G-002', birthdate: '1992-02-02', mobile_no: '0917 111 0002', password: 'right-password-1'});
  });

  it.each([
    ['no_match', 400],
    ['already_active', 409],
    ['rate_limited', 429],
    ['activation_failed', 400],
    ['weak_password', 400],
    ['invalid_input', 400],
    ['server', 500],
  ] as const)('%s gets its plain message', async (code, status) => {
    api.activate = () => ({status, body: {code, message: 'from the server'}});
    const e = await activate(form).catch(x => x);
    expect(e).toBeInstanceOf(ActivationError);
    expect(e.code).toBe(code);
    expect(e.message).toBe(ACTIVATION_MESSAGES[code]);
  });

  it('a mismatch never says which fact was wrong', () => {
    expect(ACTIVATION_MESSAGES.no_match).not.toMatch(/birthdate is|mobile number is|not found|does not exist/i);
  });

  it('no connection says so; an unknown answer is the server message', async () => {
    api.offline = true;
    expect((await activate(form).catch(x => x)).code).toBe('offline');
    api.offline = false;
    api.activate = () => ({status: 502, body: {code: 'something_else'}});
    expect((await activate(form).catch(x => x)).code).toBe('server');
  });

  it('after activating, the guard is signed in with the login the function made', async () => {
    await useSession.getState().activateAndSignIn(form);
    expect(useSession.getState().phase).toBe('ready');
    const token = api.requests.find(r => r.path === '/auth/v1/token');
    expect(token?.query.get('grant_type')).toBe('password');
    expect(token?.body).toMatchObject({email: 'g-002@employees.bannuar.invalid', password: 'right-password-1'});
    expect(api.rpcCalls('my_access').length).toBe(1);
  });
});

describe('sign-in with the employee number', () => {
  it('turns the number into the login email, then asks my_access', async () => {
    const a = await signIn('g-002', 'right-password-1');
    expect(a.employee?.employee_no).toBe('G-002');
    expect(api.requests.find(r => r.path === '/auth/v1/token')?.body).toMatchObject({email: 'g-002@employees.bannuar.invalid'});
  });
  it('a wrong password reads plainly', async () => {
    await expect(signIn('G-002', 'wrong')).rejects.toThrow('The employee number or password is wrong.');
  });
  it('staff accounts are signed out again: they use the HR portal', async () => {
    api.rpc.my_access = () => access({roles: ['hr_admin'], employee: null});
    await expect(signIn('G-002', 'right-password-1')).rejects.toThrow(STAFF_MESSAGE);
    expect(api.requests.some(r => r.path === '/auth/v1/logout')).toBe(true);
    expect((await supabase.auth.getSession()).data.session).toBeNull();
  });
  it('HR\'s temporary password leads to "Set a new password" and nothing else', async () => {
    api.rpc.my_access = () => access({must_change_password: true});
    await useSession.getState().signIn('G-002', 'right-password-1');
    expect(useSession.getState().phase).toBe('mustChange');
  });
});

describe('passwords', () => {
  it('the app asks for 8+ characters with letters and numbers, typed twice', () => {
    expect(passwordProblem('short1', 'short1')).toMatch(/8 characters/);
    expect(passwordProblem('onlyletters', 'onlyletters')).toMatch(/letters and numbers/);
    expect(passwordProblem('letters123', 'letters124')).toMatch(/not the same/);
    expect(passwordProblem('letters123', 'letters123')).toBeNull();
  });
  it('the forced change: auth.updateUser, then mark_password_changed, then the app', async () => {
    api.rpc.my_access = () => access({must_change_password: true});
    await useSession.getState().signIn('G-002', 'right-password-1');
    api.rpc.my_access = () => access();
    await changePassword('a-new-pass-2');
    await useSession.getState().passwordChanged();
    const put = api.requests.find(r => r.path === '/auth/v1/user' && r.method === 'PUT');
    expect(put?.body).toMatchObject({password: 'a-new-pass-2'});
    expect(api.rpcCalls('mark_password_changed').length).toBe(1);
    expect(useSession.getState().phase).toBe('ready');
  });
  it('a change from Account checks the current password first', async () => {
    await useSession.getState().signIn('G-002', 'right-password-1');
    await expect(changePassword('a-new-pass-2', {current: 'wrong', employeeNo: 'G-002'})).rejects.toThrow('Your current password is wrong.');
    expect(api.requests.some(r => r.path === '/auth/v1/user' && r.method === 'PUT')).toBe(false);
  });
});

describe('sign-out ends the session, removes this phone and wipes what was kept', () => {
  it('device token row, Firebase token, session, encrypted cache and downloaded files', async () => {
    await useSession.getState().signIn('G-002', 'right-password-1');
    await saveToken('fcm-test-token');
    await cacheSet('payslips', [{id: 'ps1', net_pay: 10448}]);
    expect(keychainServices().some(s => s.includes('cache.payslips'))).toBe(true);
    useResources.getState().patch('payslips', {data: [{id: 'ps1'}], status: 'ready'});

    await useSession.getState().signOut();

    const del = api.rest('DELETE', 'device_tokens')[0];
    expect(del.query.get('token')).toBe('eq.fcm-test-token');
    expect(deleteToken).toHaveBeenCalled();
    const logout = api.requests.find(r => r.path === '/auth/v1/logout');
    expect(logout?.query.get('scope')).toBe('local');
    expect(keychainServices()).toEqual([]);
    expect(await cacheGet('payslips')).toBeNull();
    expect(useResources.getState().entries).toEqual({});
    expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith('/cache/bannuar-files');
    expect(notifee.cancelAllNotifications).toHaveBeenCalled();
    expect(useSession.getState().phase).toBe('signedOut');
    expect(useSession.getState().access).toBeNull();
  });
  it('signed out before push started in this launch: the phone\'s token is still removed', async () => {
    await useSession.getState().signIn('G-002', 'right-password-1');
    await useSession.getState().signOut();
    await useSession.getState().signIn('G-002', 'right-password-1');
    api.requests.length = 0;
    await useSession.getState().signOut();
    expect(api.rest('DELETE', 'device_tokens')[0]?.query.get('token')).toBe('eq.fcm-test-token');
  });
  it('a sign-out the guard chose does not say "session ended"', async () => {
    await useSession.getState().signIn('G-002', 'right-password-1');
    await useSession.getState().start();
    await useSession.getState().signOut();
    await new Promise(r => setTimeout(r, 10));
    expect(useSession.getState().notice).toBeNull();
    expect(useSession.getState().phase).toBe('signedOut');
  });
});

describe('starting the app', () => {
  it('no session: sign-in', async () => {
    await useSession.getState().start();
    expect(useSession.getState().phase).toBe('signedOut');
  });
  it('a kept session: my_access decides, and the access is kept encrypted for offline starts', async () => {
    await supabase.auth.signInWithPassword({email: 'g-002@employees.bannuar.invalid', password: 'right-password-1'});
    useSession.setState({phase: 'starting'});
    await useSession.getState().start();
    expect(useSession.getState().phase).toBe('ready');
    expect(useSession.getState().access?.employee?.id).toBe(EMPLOYEE_ID);
    expect(keychainServices()).toContain('ph.bannuar.employee.access');
  });
  it('offline with a kept session: opens on what was kept', async () => {
    await useSession.getState().signIn('G-002', 'right-password-1');
    useSession.setState({phase: 'starting', access: null});
    api.offline = true;
    await useSession.getState().start();
    expect(useSession.getState().phase).toBe('ready');
    expect(useSession.getState().access?.employee?.employee_no).toBe('G-002');
  });
  it('a session the server no longer accepts (HR reset the password): signed out, with the reason', async () => {
    await useSession.getState().signIn('G-002', 'right-password-1');
    useSession.setState({phase: 'starting'});
    api.rpc.my_access = () => ({status: 401, body: {code: 'PGRST301', message: 'JWT expired'}});
    await useSession.getState().start();
    expect(useSession.getState().phase).toBe('signedOut');
    expect(useSession.getState().notice).toBe(SESSION_ENDED);
    expect(keychainServices()).toEqual([]);
  });
});

describe('a fresh install', () => {
  it('wipes what an earlier install left in the keychain (iOS keeps it), once', async () => {
    (global as unknown as {__blob: {files: Set<string>}}).__blob.files.clear();
    await supabase.auth.signInWithPassword({email: 'g-002@employees.bannuar.invalid', password: 'right-password-1'});
    expect(keychainServices().length).toBeGreaterThan(0);
    useSession.setState({phase: 'starting'});
    await useSession.getState().start();
    expect(keychainServices().filter(s => s.includes('.auth.'))).toEqual([]);
    expect(useSession.getState().phase).toBe('signedOut');
    // the next launch is not a fresh install
    await useSession.getState().signIn('G-002', 'right-password-1');
    useSession.setState({phase: 'starting'});
    await useSession.getState().start();
    expect(useSession.getState().phase).toBe('ready');
  });
});

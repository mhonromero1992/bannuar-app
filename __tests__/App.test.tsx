import React from 'react';
import ReactTestRenderer, {act, type ReactTestInstance} from 'react-test-renderer';
import App from '../App';
import {supabase} from '../src/config/supabase';
import {resetResources} from '../src/store/resources';
import {useSession} from '../src/store/session';
import {access, clearKeychain, EMPLOYEE_ID, installMockApi, type MockApi} from './support/mockApi';

let api: MockApi;
let tree: ReactTestRenderer.ReactTestRenderer | null = null;

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
  }
};
const texts = (root: ReactTestInstance) =>
  root
    .findAll(n => String(n.type) === 'Text')
    .map(n => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')));
const byTestId = (root: ReactTestInstance, id: string) => root.findAll(n => n.props.testID === id);

async function renderApp() {
  await act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await settle();
  return tree!.root;
}

beforeEach(async () => {
  api = installMockApi();
  useSession.setState({phase: 'starting', access: null, notice: null});
  await supabase.auth.signOut({scope: 'local'}).catch(() => undefined);
  clearKeychain();
  resetResources();
  // not a fresh install (that case is in auth.test.ts)
  (global as unknown as {__blob: {files: Set<string>}}).__blob.files.add('/docs/.bannuar-installed');
  useSession.setState({phase: 'starting', access: null, notice: null});
});

afterEach(async () => {
  await act(async () => {
    tree?.unmount();
  });
  tree = null;
});

describe('the app opens on the right screen', () => {
  it('signed out: Sign in, with Activate and Forgot password', async () => {
    const root = await renderApp();
    expect(useSession.getState().phase).toBe('signedOut');
    expect(byTestId(root, 'signin-submit').length).toBeGreaterThan(0);
    const all = texts(root);
    expect(all).toContain('First time? Activate your account');
    expect(all).toContain('Forgot your password?');
  });

  it('HR gave a temporary password: only "Set a new password"', async () => {
    api.rpc.my_access = () => access({must_change_password: true});
    await supabase.auth.signInWithPassword({email: 'g-002@employees.bannuar.invalid', password: 'right-password-1'});
    const root = await renderApp();
    expect(useSession.getState().phase).toBe('mustChange');
    expect(texts(root)).toContain('Set a new password');
    expect(byTestId(root, 'set-password-submit').length).toBeGreaterThan(0);
    expect(byTestId(root, 'tab-Home')).toEqual([]);
  });

  it('signed in: Home with the post, the hidden pay and the tabs', async () => {
    api.tables.employees = [
      {id: EMPLOYEE_ID, employee_no: 'G-002', first_name: 'Bea', middle_name: null, last_name: 'Lim', suffix: null, status: 'active', position: 'Lady Guard', site: {id: 's1', name: 'Post A · Main Gate', city: 'San Fernando'}},
    ];
    api.tables.payslips = [{id: 'ps1', employee_id: EMPLOYEE_ID, net_pay: 10448, period: {label: 'Oct 16 to 31, 2026', pay_date: '2026-11-05', period_end: '2026-10-31'}}];
    await supabase.auth.signInWithPassword({email: 'g-002@employees.bannuar.invalid', password: 'right-password-1'});
    const root = await renderApp();
    await settle();
    expect(useSession.getState().phase).toBe('ready');
    const all = texts(root);
    expect(all).toContain('Post A · Main Gate');
    expect(all).toContain('Oct 16 to 31, 2026');
    expect(all).toContain('₱ ••••••');
    expect(all.join(' ')).not.toContain('10,448');
    expect(byTestId(root, 'tab-Payslips').length).toBeGreaterThan(0);
  });
});

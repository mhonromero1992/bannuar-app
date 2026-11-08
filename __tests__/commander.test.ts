import {decideLeave, isCommander, loadPost, relieverCandidates} from '../src/services/commander';
import {loadHome} from '../src/services/home';
import {clearKeychain, EMPLOYEE_ID, installMockApi, type MockApi} from './support/mockApi';

let api: MockApi;
const DC = 'e-dc';
beforeEach(() => {
  api = installMockApi();
  clearKeychain();
  api.rpc.my_supervised_site_ids = () => ['s1', 's2'];
  api.tables.sites = [{id: 's1', name: 'Post A'}, {id: 's2', name: 'Post B'}];
  api.tables.employees = [
    {id: DC, employee_no: 'G-001', first_name: 'Dante', last_name: 'Cruz', position: 'Detachment Commander', status: 'active', site_id: 's1'},
    {id: EMPLOYEE_ID, employee_no: 'G-002', first_name: 'Bea', last_name: 'Lim', position: 'Lady Guard', status: 'active', site_id: 's1'},
    {id: 'e3', employee_no: 'G-003', first_name: 'Carlo', last_name: 'Diaz', position: 'Security Guard', status: 'active', site_id: 's1'},
    {id: 'e4', employee_no: 'G-004', first_name: 'Edu', last_name: 'Tan', position: 'Security Guard', status: 'active', site_id: 's2'},
    {id: 'e5', employee_no: 'G-005', first_name: 'Fe', last_name: 'Go', position: 'Lady Guard', status: 'on_leave', site_id: 's1'},
  ];
  api.tables.leave_requests = [
    {id: 'lr1', employee_id: EMPLOYEE_ID, status: 'pending_supervisor', site_id: 's1', start_date: '2026-11-20', end_date: '2026-11-21', days: 2},
    {id: 'lr-own', employee_id: DC, status: 'pending_supervisor', site_id: 's1', start_date: '2026-11-25', end_date: '2026-11-25', days: 1},
  ];
});

describe('a detachment commander\'s post', () => {
  it('only the supervisor role gets "My post"', () => {
    expect(isCommander(['employee', 'supervisor'])).toBe(true);
    expect(isCommander(['employee'])).toBe(false);
  });
  it('finds the posts through my_supervised_site_ids(), then their guards and leave waiting for endorsement', async () => {
    const data = await loadPost(DC);
    expect(api.rpcCalls('my_supervised_site_ids').length).toBe(1);
    expect(api.rest('GET', 'sites')[0].query.get('id')).toBe('in.(s1,s2)');
    const guards = api.rest('GET', 'employees')[0];
    expect(guards.query.get('site_id')).toBe('in.(s1,s2)');
    expect(guards.query.get('status')).toBe('in.(active,on_leave,suspended)');
    const pending = api.rest('GET', 'leave_requests')[0];
    expect(pending.query.get('status')).toBe('eq.pending_supervisor');
    expect(pending.query.get('employee_id')).toBe(`neq.${DC}`);
    expect(data.pending.map(r => r.id)).toEqual(['lr1']);
  });
  it('no posts: nothing else is asked', async () => {
    api.rpc.my_supervised_site_ids = () => [];
    expect(await loadPost(DC)).toEqual({sites: [], guards: [], pending: []});
    expect(api.requests.length).toBe(1);
  });
  it('relievers: active guards of the same post, not the one going on leave', async () => {
    const data = await loadPost(DC);
    const names = relieverCandidates(data, {employee_id: EMPLOYEE_ID}, DC).map(g => g.employee_no);
    expect(names).toEqual(['G-001', 'G-003']);
  });
  it('endorse with a reliever, or decline with a note, through decide_leave_request', async () => {
    await decideLeave({requestId: 'lr1', approve: true, note: ' Covered ', relieverId: 'e3'});
    await decideLeave({requestId: 'lr1', approve: false, note: 'Short of guards that week', relieverId: null});
    expect(api.rpcCalls('decide_leave_request').map(r => r.body)).toEqual([
      {p_request_id: 'lr1', p_approve: true, p_note: 'Covered', p_reliever_id: 'e3'},
      {p_request_id: 'lr1', p_approve: false, p_note: 'Short of guards that week', p_reliever_id: null},
    ]);
  });
  it('a database refusal comes back worded (another post\'s guard)', async () => {
    api.rpc.decide_leave_request = () => ({status: 403, body: {code: '42501', message: 'You do not supervise this employee'}});
    await expect(decideLeave({requestId: 'lr9', approve: true, note: null, relieverId: null})).rejects.toMatchObject({message: 'You do not supervise this employee'});
  });
  it('Home counts the leave waiting for the commander', async () => {
    api.tables.employees.push({id: 'x'});
    api.rpc.my_supervised_site_ids = () => ['s1'];
    const home = await loadHome(DC, ['employee', 'supervisor']);
    expect(home.toEndorse).toBe(1);
    const guardHome = await loadHome(EMPLOYEE_ID, ['employee']);
    expect(guardHome.toEndorse).toBeNull();
  });
});

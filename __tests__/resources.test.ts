import {cacheGet} from '../src/services/secureCache';
import {invalidate, loadResource, mutateResource, resetResources, useResources} from '../src/store/resources';
import {clearKeychain, keychainServices} from './support/mockApi';

const entry = (k: string) => useResources.getState().entries[k];

beforeEach(() => {
  resetResources();
  clearKeychain();
});

describe('what each screen shows: loading, data, error, offline', () => {
  it('keeps loaded data encrypted on the phone, with when it was loaded', async () => {
    await loadResource('payslips', async () => [{id: 'ps1'}]);
    expect(entry('payslips')).toMatchObject({status: 'ready', data: [{id: 'ps1'}], offline: false});
    expect(keychainServices()).toContain('ph.bannuar.employee.cache.payslips');
    expect((await cacheGet('payslips'))?.data).toEqual([{id: 'ps1'}]);
  });
  it('offline: the kept data stays on screen, marked offline with its time', async () => {
    await loadResource('leave', async () => ({requests: [1]}));
    const at = entry('leave').at;
    await loadResource('leave', async () => {
      throw new TypeError('Network request failed');
    });
    expect(entry('leave')).toMatchObject({status: 'ready', data: {requests: [1]}, offline: true, at});
  });
  it('a fresh start offline shows what was kept from before', async () => {
    await loadResource('coe', async () => ({requests: ['kept']}));
    resetResources(); // the app restarts: memory is empty, the encrypted cache is not
    await loadResource('coe', async () => {
      throw new TypeError('Network request failed');
    });
    expect(entry('coe')).toMatchObject({status: 'ready', data: {requests: ['kept']}, offline: true});
  });
  it('nothing kept and no connection: the offline state', async () => {
    await loadResource('documents', async () => {
      throw new TypeError('Network request failed');
    });
    expect(entry('documents')).toMatchObject({status: 'error', offline: true});
  });
  it('a refusal from the database: the error state with its words', async () => {
    await loadResource('me', async () => {
      throw {code: '42501', message: 'Not allowed'};
    });
    expect(entry('me')).toMatchObject({status: 'error', offline: false, error: 'Not allowed'});
  });
  it('one load at a time per screen; invalidate reloads; mutate edits in place', async () => {
    let calls = 0;
    const loader = async () => ++calls;
    await Promise.all([loadResource('n', loader), loadResource('n', loader)]);
    expect(calls).toBe(1);
    mutateResource<number>('n', v => v + 100);
    expect(entry('n').data).toBe(101);
    invalidate('not-registered');
    expect(calls).toBe(1);
  });
  it('government numbers are never cached (they load with persist off)', async () => {
    await loadResource('gov', async () => ({sss_no: '02-2345678-9'}), {persist: false});
    expect(keychainServices()).toEqual([]);
  });
});

import {resolveScheme, useAppearance} from '../src/store/appearance';
import {clearKeychain, keychainServices} from './support/mockApi';

describe('appearance', () => {
  beforeEach(() => {
    clearKeychain();
    useAppearance.setState({appearance: 'system'});
  });
  it('follows the phone unless the guard picks light or dark', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
  it('the choice is kept on the phone and read back at launch', async () => {
    await useAppearance.getState().setAppearance('light');
    expect(keychainServices()).toContain('ph.bannuar.employee.appearance');
    useAppearance.setState({appearance: 'system'});
    await useAppearance.getState().load();
    expect(useAppearance.getState().appearance).toBe('light');
  });
});

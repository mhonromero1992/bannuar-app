import * as Keychain from 'react-native-keychain';
import {NativeModules, Platform} from 'react-native';
import {isLockOn, turnLockOff, turnLockOn, unlock} from '../src/services/appLock';
import {setSecure} from '../src/services/secureScreen';
import {useUi} from '../src/store/ui';
import {clearKeychain} from './support/mockApi';

beforeEach(() => clearKeychain());

describe('app lock: off by default, the phone\'s own fingerprint, face or PIN', () => {
  it('is off until the guard turns it on', async () => {
    expect(await isLockOn()).toBe(false);
  });
  it('turning it on stores an item the phone releases only after its own check', async () => {
    expect(await turnLockOn()).toBe(true);
    expect(Keychain.setGenericPassword).toHaveBeenLastCalledWith(
      'lock',
      'on',
      expect.objectContaining({
        service: 'ph.bannuar.employee.lock',
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      }),
    );
    expect(await isLockOn()).toBe(true);
    expect(await unlock()).toBe(true);
    await turnLockOff();
    expect(await isLockOn()).toBe(false);
  });
  it('a phone without a screen lock cannot turn it on', async () => {
    (Keychain.isPasscodeAuthAvailable as jest.Mock).mockResolvedValueOnce(false);
    expect(await turnLockOn()).toBe(false);
    expect(await isLockOn()).toBe(false);
  });
  it('a failed or cancelled check keeps the app locked', async () => {
    await turnLockOn();
    (Keychain.getGenericPassword as jest.Mock).mockRejectedValueOnce(new Error('cancelled'));
    expect(await unlock()).toBe(false);
  });
});

describe('screenshots: FLAG_SECURE on Android, a cover in the iOS app switcher', () => {
  it('Android: the window flag', () => {
    Platform.OS = 'android';
    setSecure(true);
    expect(NativeModules.BannuarSecureWindow.setSecure).toHaveBeenLastCalledWith(true);
    setSecure(false);
    expect(NativeModules.BannuarSecureWindow.setSecure).toHaveBeenLastCalledWith(false);
  });
  it('iOS: no native call, the app knows a secure screen is open', () => {
    Platform.OS = 'ios';
    (NativeModules.BannuarSecureWindow.setSecure as jest.Mock).mockClear();
    setSecure(true);
    expect(NativeModules.BannuarSecureWindow.setSecure).not.toHaveBeenCalled();
    expect(useUi.getState().secureScreen).toBe(true);
    setSecure(false);
    Platform.OS = 'android';
  });
});

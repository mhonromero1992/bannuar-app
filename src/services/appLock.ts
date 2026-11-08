import * as Keychain from 'react-native-keychain';
import {SERVICE_PREFIX} from './vault';

/**
 * App lock, off by default (README: To confirm with Bannuar). When on, the app asks for the phone's own
 * fingerprint, face or screen-lock PIN when it opens and after a minute in the background. It uses the
 * keychain module the session already needs: an item that the phone only releases after that check.
 * No PIN of the app's own to forget or to reset at HR.
 */
const LOCK = `${SERVICE_PREFIX}lock`;
/** Back from the background after this long: ask again. */
export const RELOCK_AFTER_MS = 60_000;

export async function lockSupported(): Promise<boolean> {
  try {
    return await Keychain.isPasscodeAuthAvailable();
  } catch {
    return false;
  }
}

export async function isLockOn(): Promise<boolean> {
  try {
    return await Keychain.hasGenericPassword({service: LOCK});
  } catch {
    return false;
  }
}

export async function turnLockOn(): Promise<boolean> {
  if (!(await lockSupported())) {
    return false;
  }
  try {
    await Keychain.setGenericPassword('lock', 'on', {
      service: LOCK,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      storage: Keychain.STORAGE_TYPE.AES_GCM,
      authenticationPrompt: {title: 'Turn on the app lock', cancel: 'Cancel'},
    });
    return true;
  } catch {
    return false;
  }
}

export async function turnLockOff(): Promise<void> {
  await Keychain.resetGenericPassword({service: LOCK}).catch(() => false);
}

/** Shows the phone's own check; true once it passes. */
export async function unlock(): Promise<boolean> {
  try {
    const item = await Keychain.getGenericPassword({
      service: LOCK,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      authenticationPrompt: {title: 'Unlock Bannuar', cancel: 'Cancel'},
    });
    return Boolean(item);
  } catch {
    return false;
  }
}

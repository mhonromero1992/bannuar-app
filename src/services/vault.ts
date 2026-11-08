import * as Keychain from 'react-native-keychain';

/**
 * Everything personal the app keeps on the phone goes through here: the sign-in session and the
 * last-loaded data shown offline. react-native-keychain encrypts each item with a key held by the
 * phone's secure hardware (Android Keystore, iOS Keychain); "this device only" keeps items out of
 * backups and other devices. wipeVault() removes all of it at sign-out.
 */
export const SERVICE_PREFIX = 'ph.bannuar.employee.';

const BASE: Keychain.SetOptions = {
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
};

export async function vaultGet(name: string): Promise<string | null> {
  try {
    const item = await Keychain.getGenericPassword({service: SERVICE_PREFIX + name});
    return item ? item.password : null;
  } catch {
    // an item that cannot be decrypted (the phone's lock was removed, a restored backup) reads as empty
    return null;
  }
}

export async function vaultSet(name: string, value: string): Promise<void> {
  try {
    await Keychain.setGenericPassword('bannuar', value, {...BASE, service: SERVICE_PREFIX + name});
  } catch {
    // not kept: the app still works for this launch
  }
}

export async function vaultRemove(name: string): Promise<void> {
  try {
    await Keychain.resetGenericPassword({service: SERVICE_PREFIX + name});
  } catch {
    // already gone
  }
}

/** Removes every item whose name starts with `prefix` (all of them by default). */
export async function wipeVault(prefix = ''): Promise<void> {
  let services: string[] = [];
  try {
    services = await Keychain.getAllGenericPasswordServices();
  } catch {
    services = [];
  }
  await Promise.all(
    services
      .filter(s => s.startsWith(SERVICE_PREFIX + prefix))
      .map(s => Keychain.resetGenericPassword({service: s}).catch(() => false)),
  );
}

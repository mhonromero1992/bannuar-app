/* eslint-env jest */
/**
 * Tests never touch Bannuar's live project. The app is built against https://mock.supabase.test
 * (__mocks__/env.js); __tests__/support/mockApi.ts answers like Supabase. On top of that, every
 * request or socket to a real *.supabase.co host is refused here and fails the test (jest.after.js).
 */
const LIVE = /^(https?|wss?):\/\/[^/]*\.supabase\.co(?::\d+)?(\/|$)/i;
global.__liveHits = [];
global.__fetchImpl = null;

global.fetch = jest.fn(async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (LIVE.test(url)) {
    global.__liveHits.push(url);
    throw new Error(`A test tried to reach the live Supabase project: ${url}`);
  }
  if (!global.__fetchImpl) {
    throw new TypeError(`Network request failed (no mock for ${url})`);
  }
  return global.__fetchImpl(input, init);
});

global.WebSocket = class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  constructor(url) {
    if (LIVE.test(String(url))) {
      global.__liveHits.push(String(url));
      throw new Error(`A test tried to open a socket to the live project: ${url}`);
    }
    this.url = url;
    this.readyState = 0;
  }
  send() {}
  close() {
    this.readyState = 3;
  }
};

// ---------------------------------------------------------------------------- native modules
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-screens', () => ({...jest.requireActual('react-native-screens'), enableScreens: jest.fn()}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const {NativeModules} = require('react-native');
NativeModules.BannuarSecureWindow = {setSecure: jest.fn()};

// Encrypted storage: an in-memory keychain the tests can look into (global.__keychain).
global.__keychain = new Map();
jest.mock('react-native-keychain', () => {
  const store = global.__keychain;
  return {
    ACCESSIBLE: {WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly', AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly', WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'AccessibleWhenPasscodeSetThisDeviceOnly'},
    ACCESS_CONTROL: {BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BiometryAnyOrDevicePasscode', DEVICE_PASSCODE: 'DevicePasscode'},
    STORAGE_TYPE: {AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth', AES_GCM: 'KeystoreAESGCM'},
    SECURITY_LEVEL: {ANY: 2, SECURE_SOFTWARE: 0, SECURE_HARDWARE: 1},
    setGenericPassword: jest.fn(async (username, password, options = {}) => {
      store.set(options.service ?? 'default', {username, password, options});
      return {service: options.service, storage: 'KeystoreAESGCM_NoAuth'};
    }),
    getGenericPassword: jest.fn(async (options = {}) => {
      const item = store.get(options.service ?? 'default');
      return item ? {username: item.username, password: item.password, service: options.service, storage: 'KeystoreAESGCM_NoAuth'} : false;
    }),
    hasGenericPassword: jest.fn(async (options = {}) => store.has(options.service ?? 'default')),
    resetGenericPassword: jest.fn(async (options = {}) => store.delete(options.service ?? 'default')),
    getAllGenericPasswordServices: jest.fn(async () => [...store.keys()]),
    getSupportedBiometryType: jest.fn(async () => 'Fingerprint'),
    isPasscodeAuthAvailable: jest.fn(async () => true),
  };
});

jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {hide: jest.fn(async () => undefined), isVisible: jest.fn(async () => false)},
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async ({id}) => id),
    requestPermission: jest.fn(async () => ({authorizationStatus: 1})),
    setBadgeCount: jest.fn(async () => undefined),
    displayNotification: jest.fn(async () => 'n'),
    cancelAllNotifications: jest.fn(async () => undefined),
    onForegroundEvent: jest.fn(() => () => undefined),
    onBackgroundEvent: jest.fn(),
    getInitialNotification: jest.fn(async () => null),
  },
  AndroidImportance: {DEFAULT: 3, HIGH: 4},
  AuthorizationStatus: {DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2},
  EventType: {PRESS: 1, DISMISSED: 0},
}));

global.__firebase = {apps: [{name: '[DEFAULT]'}], token: 'fcm-test-token', listeners: {}};
jest.mock('@react-native-firebase/app', () => ({
  getApps: jest.fn(() => global.__firebase.apps),
  getApp: jest.fn(() => global.__firebase.apps[0]),
}));
jest.mock('@react-native-firebase/messaging', () => ({
  AuthorizationStatus: {NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2},
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(async () => global.__firebase.token),
  deleteToken: jest.fn(async () => undefined),
  requestPermission: jest.fn(async () => 1),
  registerDeviceForRemoteMessages: jest.fn(async () => undefined),
  onMessage: jest.fn((_m, l) => { global.__firebase.listeners.message = l; return () => undefined; }),
  onNotificationOpenedApp: jest.fn((_m, l) => { global.__firebase.listeners.opened = l; return () => undefined; }),
  onTokenRefresh: jest.fn((_m, l) => { global.__firebase.listeners.refresh = l; return () => undefined; }),
  getInitialNotification: jest.fn(async () => null),
  setBackgroundMessageHandler: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: {pdf: 'application/pdf', images: 'image/*'},
  errorCodes: {OPERATION_CANCELED: 'OPERATION_CANCELED'},
  isErrorWithCode: e => Boolean(e && e.code),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({didCancel: true})),
  launchCamera: jest.fn(async () => ({didCancel: true})),
}));

// The phone's location: tests set global.__geo (a position, an error code, or no answer at all).
global.__geo = {fix: {coords: {latitude: 14.5552, longitude: 121.0244, accuracy: 12}, mocked: false, timestamp: 0}, error: null, silent: false, authorized: true};
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    setRNConfiguration: jest.fn(),
    requestAuthorization: jest.fn((ok, fail) => (global.__geo.authorized ? ok() : fail({code: 1, message: 'denied'}))),
    getCurrentPosition: jest.fn((ok, fail) => {
      if (global.__geo.silent) {
        return;
      }
      if (global.__geo.error) {
        fail({code: global.__geo.error, message: 'no location'});
      } else {
        ok(global.__geo.fix);
      }
    }),
  },
}));

// A small file system: the files the app wrote (the install marker) and what it deleted.
global.__blob = {fetched: [], opened: [], removed: [], files: new Set()};
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: {CacheDir: '/cache', DocumentDir: '/docs'},
      exists: jest.fn(async p => global.__blob.files.has(p)),
      unlink: jest.fn(async p => {
        global.__blob.removed.push(p);
        for (const f of [...global.__blob.files]) {
          if (f === p || f.startsWith(`${p}/`)) {
            global.__blob.files.delete(f);
          }
        }
      }),
      mkdir: jest.fn(async () => undefined),
      writeFile: jest.fn(async p => {
        global.__blob.files.add(p);
      }),
    },
    config: jest.fn(options => ({
      fetch: jest.fn(async (method, url) => {
        global.__blob.fetched.push({method, url, path: options.path});
        return {info: () => ({status: 200}), path: () => options.path};
      }),
    })),
    android: {actionViewIntent: jest.fn(async (path, mime) => { global.__blob.opened.push({path, mime}); })},
    ios: {previewDocument: jest.fn(p => { global.__blob.opened.push({path: p}); })},
  },
}));

import notifee from '@notifee/react-native';
import {getToken, requestPermission} from '@react-native-firebase/messaging';
import {Platform} from 'react-native';
import {CHANNELS, pushAvailable, saveToken, setBadge, startPush} from '../src/services/push';
import {APP_VERSION} from '../src/services/version';
import {clearKeychain, installMockApi, type MockApi} from './support/mockApi';

let api: MockApi;
const fb = (global as unknown as {__firebase: {apps: unknown[]; listeners: Record<string, (x: unknown) => void>}}).__firebase;
beforeEach(() => {
  api = installMockApi();
  clearKeychain();
  fb.apps = [{name: '[DEFAULT]'}];
  Platform.OS = 'android';
});

describe('push through Firebase, only when it is set up', () => {
  it('stays off without Firebase files: nothing touches Firebase', async () => {
    fb.apps = [];
    expect(pushAvailable()).toBe(false);
    const stop = await startPush({onForeground: jest.fn(), onOpen: jest.fn()});
    stop();
    expect(getToken).not.toHaveBeenCalled();
    expect(api.requests.length).toBe(0);
  });
  it('registers the token with register_device_token (platform and app version), creates the channels', async () => {
    const onOpen = jest.fn();
    const stop = await startPush({onForeground: jest.fn(), onOpen});
    expect(notifee.createChannel).toHaveBeenCalledTimes(CHANNELS.length);
    expect(CHANNELS.map(c => c.id)).toEqual(['bannuar-updates', 'bannuar-urgent']);
    expect(requestPermission).toHaveBeenCalled();
    expect(notifee.requestPermission).toHaveBeenCalled();
    expect(api.rpcCalls('register_device_token')[0].body).toEqual({p_token: 'fcm-test-token', p_platform: 'android', p_app_version: APP_VERSION});
    // a refreshed token is saved again; a tapped push opens its screen
    fb.listeners.refresh('fcm-token-2');
    await new Promise(r => setTimeout(r, 0));
    expect(api.rpcCalls('register_device_token')[1].body).toMatchObject({p_token: 'fcm-token-2'});
    fb.listeners.opened({data: {link: '{"screen":"Payslip","id":"ps1"}', notification_id: 'n1'}});
    expect(onOpen).toHaveBeenCalledWith({link: '{"screen":"Payslip","id":"ps1"}', notification_id: 'n1'});
    stop();
  });
  it('iOS sends its platform', async () => {
    Platform.OS = 'ios';
    await saveToken('apns-backed-token');
    expect(api.rpcCalls('register_device_token')[0].body).toMatchObject({p_platform: 'ios'});
  });
  it('the app icon badge shows the unread count', async () => {
    await setBadge(3);
    expect(notifee.setBadgeCount).toHaveBeenCalledWith(3);
  });
});

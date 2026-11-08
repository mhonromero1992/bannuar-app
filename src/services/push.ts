import notifee, {AndroidImportance} from '@notifee/react-native';
import {getApps} from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
} from '@react-native-firebase/messaging';
import {Platform} from 'react-native';
import {env} from '../config/env';
import {supabase} from '../config/supabase';
import type {NotificationLink} from '../types/db';
import {exec} from './db';
import {APP_VERSION} from './version';

/**
 * Push notifications through Firebase Cloud Messaging. Off until Bannuar's google-services.json and
 * GoogleService-Info.plist are in the app and PUSH_ENABLED=true (README: Push notifications); until then
 * nothing here touches Firebase, and notifications still arrive in the app (Realtime) while it is open.
 *
 * The send-push Edge Function sends each new row of public.notifications to the user's phones, with no
 * amount or personal number in the text, and the link of the screen to open in `data.link`.
 */
export const CHANNELS = [
  {id: 'bannuar-updates', name: 'Updates', importance: AndroidImportance.DEFAULT},
  {id: 'bannuar-urgent', name: 'Urgent announcements', importance: AndroidImportance.HIGH},
];

export function pushAvailable(): boolean {
  return env.pushEnabled && getApps().length > 0;
}

export async function createChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Promise.all(CHANNELS.map(c => notifee.createChannel(c)));
  }
}

/** The screen a push opens, from its data. */
export function linkFromPush(data?: Record<string, unknown> | null): {link: NotificationLink | null; notificationId: string | null} {
  let link: NotificationLink | null = null;
  const raw = data?.link;
  if (typeof raw === 'string' && raw) {
    try {
      link = JSON.parse(raw) as NotificationLink;
    } catch {
      link = null;
    }
  } else if (raw && typeof raw === 'object') {
    link = raw as NotificationLink;
  }
  const id = data?.notification_id;
  return {link, notificationId: typeof id === 'string' && id ? id : null};
}

let currentToken: string | null = null;

/** Saves this phone's token for the signed-in user (register_device_token upserts it). */
export async function saveToken(token: string): Promise<void> {
  currentToken = token;
  await exec(
    supabase.rpc('register_device_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
      p_app_version: APP_VERSION,
    }),
  );
}

export interface PushHandlers {
  /** A push arrived while the app was open. */
  onForeground: (title: string | undefined, data: Record<string, unknown>) => void;
  /** The guard tapped a push. */
  onOpen: (data: Record<string, unknown>) => void;
}

/**
 * After sign-in: asks permission once, registers the token, refreshes last_seen_at, and listens.
 * Returns the function that stops listening.
 */
export async function startPush(handlers: PushHandlers): Promise<() => void> {
  if (!pushAvailable()) {
    return () => undefined;
  }
  const messaging = getMessaging();
  await createChannels();
  if (Platform.OS === 'ios') {
    await registerDeviceForRemoteMessages(messaging);
  }
  const status = await requestPermission(messaging);
  if (Platform.OS === 'android') {
    // Android 13+ asks for POST_NOTIFICATIONS; notifee shows the system question
    await notifee.requestPermission();
  } else if (status === AuthorizationStatus.DENIED) {
    return () => undefined;
  }
  await saveToken(await getToken(messaging));
  const stops = [
    onTokenRefresh(messaging, t => {
      saveToken(t).catch(() => undefined);
    }),
    onMessage(messaging, m => handlers.onForeground(m.notification?.title, (m.data ?? {}) as Record<string, unknown>)),
    onNotificationOpenedApp(messaging, m => handlers.onOpen((m.data ?? {}) as Record<string, unknown>)),
  ];
  const initial = await getInitialNotification(messaging);
  if (initial) {
    handlers.onOpen((initial.data ?? {}) as Record<string, unknown>);
  }
  return () => stops.forEach(stop => stop());
}

/**
 * Sign-out: this phone stops receiving the guard's notifications. The row goes while the session still
 * works; the token itself is deleted at Firebase too, so a stale row could never reach the phone.
 */
export async function stopPush(): Promise<void> {
  let token = currentToken;
  currentToken = null;
  if (!token && pushAvailable()) {
    // signed out before push started in this launch: ask Firebase which token this phone has
    token = await getToken(getMessaging()).catch(() => null);
  }
  if (token) {
    await supabase.from('device_tokens').delete().eq('token', token);
  }
  if (pushAvailable()) {
    await deleteToken(getMessaging()).catch(() => undefined);
  }
}

/** The number on the app icon: unread notifications (iOS; most Android launchers count notifications). */
export async function setBadge(count: number): Promise<void> {
  await notifee.setBadgeCount(Math.max(0, count)).catch(() => undefined);
}

export async function clearShownNotifications(): Promise<void> {
  await notifee.cancelAllNotifications().catch(() => undefined);
  await setBadge(0);
}

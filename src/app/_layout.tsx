import {createNavigationContainerRef, NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import React, {useEffect, useRef, useState} from 'react';
import {AppState, Image, Platform, StyleSheet, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {Toast} from '../components/ui';
import {navTheme} from '../config/theme';
import * as Screens from '../navigations';
import {routeForLink} from '../navigations/linking';
import {Tabs} from '../navigations/Tabs';
import type {RootStackParamList} from '../navigations/types';
import {isLockOn, RELOCK_AFTER_MS, relockHeld} from '../services/appLock';
import {hideBootSplash} from '../services/bootSplash';
import {markNotificationRead, subscribeToNotifications, unreadCount} from '../services/notifications';
import {linkFromPush, setBadge, startPush} from '../services/push';
import {KEYS} from '../store/keys';
import {invalidate} from '../store/resources';
import {type Phase, useSession} from '../store/session';
import {toast, useUi} from '../store/ui';
import type {AppNotification, NotificationLink} from '../types/db';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
const Stack = createStackNavigator<RootStackParamList>();
const BADGE = require('../assets/brand/badge.png');

/** A screen to open once the app is ready (a push tapped while signed out or locked). */
let pendingLink: NotificationLink | null = null;

export function openLink(link: NotificationLink | null | undefined): void {
  if (useSession.getState().phase !== 'ready' || !navigationRef.isReady()) {
    pendingLink = link ?? null;
    return;
  }
  const route = routeForLink(link);
  (navigationRef.navigate as (name: string, params?: object) => void)(route.name, route.params);
}

/** Which kept data a new notification makes stale. */
const STALE_BY_KIND: Record<string, string[]> = {
  payslip: [KEYS.payslips, KEYS.home],
  announcement: [KEYS.announcements, KEYS.home],
  leave: [KEYS.leave, KEYS.home],
  reliever: [KEYS.leave],
  leave_request: [KEYS.post, KEYS.home],
  coe: [KEYS.coe, KEYS.home],
  profile_change: [KEYS.me, KEYS.changes, KEYS.home],
  payroll_concern: [KEYS.concerns, KEYS.home],
  document_expiry: [KEYS.documents, KEYS.home],
  deployment: [KEYS.me, KEYS.home],
};

function refreshUnread() {
  unreadCount()
    .then(n => {
      useUi.getState().setUnread(n);
      setBadge(n).catch(() => undefined);
    })
    .catch(() => undefined);
}

/** While signed in: the unread count, live notifications (Realtime), and push when it is set up. */
function useSignedIn(phase: Phase) {
  const userId = useSession(s => s.access?.user_id);
  useEffect(() => {
    if (phase !== 'ready' || !userId) {
      return;
    }
    refreshUnread();
    const stopLive = subscribeToNotifications(userId, (n: AppNotification) => {
      useUi.getState().setUnread(useUi.getState().unread + 1);
      setBadge(useUi.getState().unread).catch(() => undefined);
      invalidate(KEYS.notifications, ...(STALE_BY_KIND[n.kind] ?? [KEYS.home]));
      toast(n.title, 'info', () => {
        markNotificationRead(n.id).catch(() => undefined);
        openLink(n.link);
      });
    });
    let stopPush: () => void = () => undefined;
    startPush({
      onForeground: () => refreshUnread(),
      onOpen: data => {
        const {link, notificationId} = linkFromPush(data);
        if (notificationId) {
          markNotificationRead(notificationId).then(refreshUnread).catch(() => undefined);
        }
        openLink(link);
      },
    })
      .then(stop => {
        stopPush = stop;
      })
      .catch(() => undefined);
    if (pendingLink) {
      const link = pendingLink;
      pendingLink = null;
      setTimeout(() => openLink(link), 0);
    }
    return () => {
      stopLive();
      stopPush();
    };
  }, [phase, userId]);
}

/** App lock: ask again after a minute in the background. */
function useRelock(phase: Phase) {
  const away = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      if (state !== 'active') {
        away.current = away.current ?? Date.now();
        return;
      }
      const since = away.current;
      away.current = null;
      if (phase === 'ready' && since && Date.now() - since > RELOCK_AFTER_MS && !relockHeld() && (await isLockOn())) {
        useSession.getState().lock();
      }
      if (phase === 'ready') {
        refreshUnread();
      }
    });
    return () => sub.remove();
  }, [phase]);
}

/** iOS cannot block screenshots; it can keep the app switcher from showing payslips and records. */
function usePrivacyCover(phase: Phase): boolean {
  const [cover, setCover] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    const sub = AppState.addEventListener('change', state => setCover(state !== 'active' && phase !== 'signedOut'));
    return () => sub.remove();
  }, [phase]);
  return cover;
}

export default function RootLayout() {
  const phase = useSession(s => s.phase);
  const {colors} = useTheme();
  useEffect(() => {
    useSession
      .getState()
      .start()
      .catch(() => useSession.setState({phase: 'signedOut'}));
  }, []);
  useSignedIn(phase);
  useRelock(phase);
  const cover = usePrivacyCover(phase);

  if (phase === 'starting') {
    // the splash stays up until the first real screen
    return null;
  }
  return (
    <>
      <NavigationContainer ref={navigationRef} theme={navTheme(colors)} onReady={hideBootSplash}>
        <Stack.Navigator screenOptions={{headerShown: false, cardStyle: {backgroundColor: colors.ground}}}>
          {phase === 'signedOut' ? (
            <>
              <Stack.Screen name="SignIn" component={Screens.SignIn} />
              <Stack.Screen name="Activate" component={Screens.Activate} />
              <Stack.Screen name="ForgotPassword" component={Screens.ForgotPassword} />
            </>
          ) : phase === 'mustChange' ? (
            <Stack.Screen name="SetPassword" component={Screens.SetPassword} />
          ) : phase === 'locked' ? (
            <Stack.Screen name="Locked" component={Screens.Locked} />
          ) : (
            <>
              <Stack.Screen name="Main" component={Tabs} />
              <Stack.Screen name="Notifications" component={Screens.Notifications} />
              <Stack.Screen name="Announcements" component={Screens.Announcements} />
              <Stack.Screen name="AnnouncementDetail" component={Screens.AnnouncementDetail} />
              <Stack.Screen name="PayslipDetail" component={Screens.PayslipDetail} />
              <Stack.Screen name="ReportConcern" component={Screens.ReportConcern} />
              <Stack.Screen name="Concerns" component={Screens.Concerns} />
              <Stack.Screen name="FileLeave" component={Screens.FileLeave} />
              <Stack.Screen name="LeaveDetail" component={Screens.LeaveDetail} />
              <Stack.Screen name="Coe" component={Screens.Coe} />
              <Stack.Screen name="RequestCoe" component={Screens.RequestCoe} />
              <Stack.Screen name="CertificateDetail" component={Screens.CertificateDetail} />
              <Stack.Screen name="Records" component={Screens.Records} />
              <Stack.Screen name="GovernmentIds" component={Screens.GovernmentIds} />
              <Stack.Screen name="Documents" component={Screens.Documents} />
              <Stack.Screen name="UploadDocument" component={Screens.UploadDocument} />
              <Stack.Screen name="ChangeDetails" component={Screens.ChangeDetails} />
              <Stack.Screen name="Attendance" component={Screens.Attendance} />
              <Stack.Screen name="LogAttendance" component={Screens.LogAttendance} />
              <Stack.Screen name="MyPost" component={Screens.MyPost} />
              <Stack.Screen name="Endorse" component={Screens.Endorse} />
              <Stack.Screen name="GuardAttendance" component={Screens.GuardAttendance} />
              <Stack.Screen name="Account" component={Screens.Account} />
              <Stack.Screen name="ChangePassword" component={Screens.ChangePassword} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <Toast />
      {cover ? (
        <View style={[StyleSheet.absoluteFill, styles.cover, {backgroundColor: colors.band}]}>
          <Image source={BADGE} style={styles.badge} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cover: {alignItems: 'center', justifyContent: 'center', zIndex: 20},
  badge: {width: 120, height: 120},
});
